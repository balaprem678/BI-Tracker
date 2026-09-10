export type GeoLocationResult = {
  latitude: number;
  longitude: number;
  locationName: string;
};

async function reverseGeocodeLocation(lat: number, lng: number): Promise<string> {
  const coordFallback = `${lat >= 0 ? `${lat.toFixed(4)}° N` : `${Math.abs(lat).toFixed(4)}° S`}, ${
    lng >= 0 ? `${lng.toFixed(4)}° E` : `${Math.abs(lng).toFixed(4)}° W`
  }`;

  // Primary Provider: BigDataCloud Reverse Geocode API (Instant client resolution, zero CORS issues)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      const place = d.city || d.locality || d.localityInfo?.administrative?.[2]?.name || "";
      const state = d.principalSubdivision || "";
      const country = d.countryName || "";
      const parts = [place, state, country].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(", ");
      }
    }
  } catch {
    // fallback to secondary provider
  }

  // Secondary Provider: OpenStreetMap Nominatim API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      {
        headers: {
          "User-Agent": "BITracker-App/1.0",
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);

    if (response.ok) {
      const json = await response.json();
      if (json && json.address) {
        const addr = json.address;
        const place =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.suburb ||
          addr.municipality ||
          addr.county ||
          "";
        const state = addr.state || addr.region || "";
        const country = addr.country || "";

        const parts = [place, state, country].filter(Boolean);
        if (parts.length > 0) {
          return parts.join(", ");
        }
      }
    }
  } catch {
    // Return coordinate fallback on network/timeout error
  }

  return coordFallback;
}

export async function getCurrentLocation(): Promise<GeoLocationResult> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation is not supported by your browser or environment.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        
        let locationName = `${lat >= 0 ? `${lat}° N` : `${Math.abs(lat)}° S`}, ${
          lng >= 0 ? `${lng}° E` : `${Math.abs(lng)}° W`
        }`;

        try {
          locationName = await reverseGeocodeLocation(lat, lng);
        } catch {
          // ignore error and keep fallback
        }

        resolve({
          latitude: lat,
          longitude: lng,
          locationName,
        });
      },
      (err) => {
        let message = "Could not retrieve current location.";
        if (err.code === err.PERMISSION_DENIED) {
          message =
            "Location access denied. You MUST allow browser location permission to Clock In or Clock Out.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message =
            "Location position unavailable. Please enable device location or GPS services and try again.";
        } else if (err.code === err.TIMEOUT) {
          message = "Location request timed out. Please try clocking in/out again.";
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
}
