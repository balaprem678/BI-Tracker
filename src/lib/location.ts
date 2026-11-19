export type GeoLocationResult = {
  latitude: number;
  longitude: number;
  locationName: string;
  accuracy?: number;
};

export async function reverseGeocodeLocation(lat: number, lng: number): Promise<string> {
  const coordFallback = `${lat >= 0 ? `${lat.toFixed(4)}° N` : `${Math.abs(lat).toFixed(4)}° S`}, ${
    lng >= 0 ? `${lng.toFixed(4)}° E` : `${Math.abs(lng).toFixed(4)}° W`
  }`;

  // Primary Provider: OpenStreetMap Nominatim (High detail: suburb, locality, neighbourhood)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      {
        headers: {
          "User-Agent": "BITracker-App/1.0",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (response.ok) {
      const json = await response.json();
      if (json && json.address) {
        const addr = json.address;
        const subArea =
          addr.suburb ||
          addr.neighbourhood ||
          addr.quarter ||
          addr.residential ||
          addr.road ||
          "";
        const city =
          addr.city ||
          addr.town ||
          addr.city_district ||
          addr.municipality ||
          addr.county ||
          "";
        const state = addr.state || addr.region || "";
        const country = addr.country || "";

        const parts: string[] = [];
        if (subArea) parts.push(subArea);
        if (city && city.toLowerCase() !== subArea.toLowerCase()) parts.push(city);
        if (state) parts.push(state);
        if (country) parts.push(country);

        const unique = Array.from(new Set(parts));
        if (unique.length > 0) {
          return unique.join(", ");
        }
      }
    }
  } catch {
    // fallback to secondary provider
  }

  // Secondary Provider: BigDataCloud Reverse Geocode API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      const adminList: any[] = d.localityInfo?.administrative || [];
      const sub = adminList.slice().reverse().find((a) => a.adminLevel === 9 || a.adminLevel === 8 || a.adminLevel === 10)?.name;
      const place = sub || d.city || d.locality || "";
      const city = d.city || "";
      const state = d.principalSubdivision || "";
      const country = d.countryName || "";
      const parts = [place, city !== place ? city : "", state, country].filter(Boolean);
      const unique = Array.from(new Set(parts));
      if (unique.length > 0) {
        return unique.join(", ");
      }
    }
  } catch {
    // fallback
  }

  return coordFallback;
}

export async function getCurrentLocation(): Promise<GeoLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Device GPS is not available. Enable location services to continue.");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        let message = "Could not retrieve current GPS location.";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Location permission denied. Allow browser location access to clock in or out.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Device GPS position is unavailable. Enable location services and try again.";
        } else if (error.code === error.TIMEOUT) {
          message = "GPS request timed out. Please try clocking in or out again.";
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  });

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
