export type GeoLocationResult = {
  latitude: number;
  longitude: number;
  locationName: string;
  accuracy?: number;
};

const geocodeCache = new Map<string, string>();

async function fetchNominatim(lat: number, lng: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      {
        headers: { "User-Agent": "BITracker-App/1.0" },
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error("Nominatim failed");
    const json = await response.json();
    if (!json?.address) throw new Error("No address");
    const addr = json.address;
    const subArea =
      addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || addr.road || "";
    const city =
      addr.city || addr.town || addr.city_district || addr.municipality || addr.county || "";
    const state = addr.state || addr.region || "";
    const country = addr.country || "";

    const parts: string[] = [];
    if (subArea) parts.push(subArea);
    if (city && city.toLowerCase() !== subArea.toLowerCase()) parts.push(city);
    if (state) parts.push(state);
    if (country) parts.push(country);

    const unique = Array.from(new Set(parts));
    if (unique.length === 0) throw new Error("Empty address");
    return unique.join(", ");
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBigDataCloud(lat: number, lng: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal },
    );
    if (!res.ok) throw new Error("BigDataCloud failed");
    const d = await res.json();
    const adminList: any[] = d.localityInfo?.administrative || [];
    const sub = adminList
      .slice()
      .reverse()
      .find((a) => a.adminLevel === 9 || a.adminLevel === 8 || a.adminLevel === 10)?.name;
    const place = sub || d.city || d.locality || "";
    const city = d.city || "";
    const state = d.principalSubdivision || "";
    const country = d.countryName || "";
    const parts = [place, city !== place ? city : "", state, country].filter(Boolean);
    const unique = Array.from(new Set(parts));
    if (unique.length === 0) throw new Error("Empty address");
    return unique.join(", ");
  } finally {
    clearTimeout(timer);
  }
}

export async function reverseGeocodeLocation(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  const coordFallback = `${lat >= 0 ? `${lat.toFixed(4)}° N` : `${Math.abs(lat).toFixed(4)}° S`}, ${
    lng >= 0 ? `${lng.toFixed(4)}° E` : `${Math.abs(lng).toFixed(4)}° W`
  }`;

  try {
    // Race both providers in parallel (max ~2.2s instead of 8.5s sequential)
    const resolved = await Promise.any([fetchNominatim(lat, lng), fetchBigDataCloud(lat, lng)]);
    geocodeCache.set(cacheKey, resolved);
    return resolved;
  } catch {
    return coordFallback;
  }
}

function getPositionPromise(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function getCurrentLocation(): Promise<GeoLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Device GPS is not available. Enable location services to continue.");
  }

  let position: GeolocationPosition;
  try {
    // Try fast high-accuracy fix (allows 30s cached fix, 4.5s timeout)
    position = await getPositionPromise({
      enableHighAccuracy: true,
      timeout: 4500,
      maximumAge: 30000,
    });
  } catch (err: any) {
    if (err?.code === 1 /* PERMISSION_DENIED */) {
      throw new Error("Location permission denied. Allow browser location access to clock in or out.");
    }
    try {
      // Fallback immediately to fast network/Wi-Fi accuracy (3s timeout)
      position = await getPositionPromise({
        enableHighAccuracy: false,
        timeout: 3000,
        maximumAge: 60000,
      });
    } catch (fallbackErr: any) {
      let message = "Could not retrieve current GPS location.";
      if (fallbackErr?.code === 1) {
        message = "Location permission denied. Allow browser location access to clock in or out.";
      } else if (fallbackErr?.code === 2) {
        message = "Device GPS position is unavailable. Enable location services and try again.";
      } else if (fallbackErr?.code === 3) {
        message = "GPS request timed out. Please try clocking in or out again.";
      }
      throw new Error(message);
    }
  }

  const latitude = Number(position.coords.latitude.toFixed(6));
  const longitude = Number(position.coords.longitude.toFixed(6));
  const locationName = await reverseGeocodeLocation(latitude, longitude);

  return {
    latitude,
    longitude,
    locationName,
    accuracy: Math.round(position.coords.accuracy || 0),
  };
}
