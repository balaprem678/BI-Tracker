export type GeoLocationResult = {
  latitude: number;
  longitude: number;
  locationName: string;
  accuracy?: number;
  isLowAccuracy?: boolean;
  source?: "gps" | "ip";
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

export async function getIpLocationFallback(): Promise<GeoLocationResult> {
  // Primary IP Geolocation: ipapi.co
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        const parts = [data.city, data.region, data.country_name].filter(Boolean);
        const place = parts.length > 0 ? parts.join(", ") : "Desktop";
        return {
          latitude: Number(data.latitude.toFixed(6)),
          longitude: Number(data.longitude.toFixed(6)),
          locationName: `${place} · Verified via IP (Desktop)`,
          accuracy: 10000,
          isLowAccuracy: true,
          source: "ip",
        };
      }
    }
  } catch {
    // Fallback to secondary IP provider
  }

  // Secondary IP Geolocation: ipwho.is
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("https://ipwho.is/", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data.success !== false && typeof data.latitude === "number" && typeof data.longitude === "number") {
        const parts = [data.city, data.region, data.country].filter(Boolean);
        const place = parts.length > 0 ? parts.join(", ") : "Desktop";
        return {
          latitude: Number(data.latitude.toFixed(6)),
          longitude: Number(data.longitude.toFixed(6)),
          locationName: `${place} · Verified via IP (Desktop)`,
          accuracy: 10000,
          isLowAccuracy: true,
          source: "ip",
        };
      }
    }
  } catch {
    // Both IP fallbacks failed
  }

  throw new Error("Could not retrieve device GPS or IP-based location. Please check your connection.");
}

export async function getCurrentLocation(): Promise<GeoLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return getIpLocationFallback();
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
      if (fallbackErr?.code === 1 /* PERMISSION_DENIED */) {
        throw new Error("Location permission denied. Allow browser location access to clock in or out.");
      }
      // Graceful IP-based fallback when desktop/browser geolocation fails or times out
      console.warn("Browser geolocation failed or timed out; using IP-based fallback.");
      return getIpLocationFallback();
    }
  }

  const latitude = Number(position.coords.latitude.toFixed(6));
  const longitude = Number(position.coords.longitude.toFixed(6));
  const accuracy = Math.round(position.coords.accuracy || 0);

  if (accuracy > 1500) {
    console.warn(`Low accuracy detected: ${accuracy}m`);
  }

  const locationName = await reverseGeocodeLocation(latitude, longitude);

  return {
    latitude,
    longitude,
    locationName,
    accuracy,
    isLowAccuracy: accuracy > 500,
    source: "gps",
  };
}
