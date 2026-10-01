export type GeoLocationResult = {
  latitude: number;
  longitude: number;
  locationName: string;
  accuracy?: number;
  isCalibrated?: boolean;
};

const CALIBRATED_KEY = "bi_tracker_calibrated_location";

export function getCalibratedLocation(userId?: string | null): GeoLocationResult | null {
  if (typeof window === "undefined") return null;
  try {
    const key = userId ? `${CALIBRATED_KEY}_${userId}` : CALIBRATED_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as GeoLocationResult;
  } catch {
    return null;
  }
}

export function saveCalibratedLocation(loc: GeoLocationResult, userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = userId ? `${CALIBRATED_KEY}_${userId}` : CALIBRATED_KEY;
    localStorage.setItem(
      key,
      JSON.stringify({ ...loc, isCalibrated: true })
    );
  } catch {
    // ignore
  }
}

export function clearCalibratedLocation(userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = userId ? `${CALIBRATED_KEY}_${userId}` : CALIBRATED_KEY;
    localStorage.removeItem(key);
    localStorage.removeItem(CALIBRATED_KEY);
  } catch {
    // ignore
  }
}

export async function searchLocation(query: string): Promise<GeoLocationResult[]> {
  if (!query || !query.trim()) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&format=json&addressdetails=1&limit=5`,
      {
        headers: { "User-Agent": "BITracker-App/1.0" },
      }
    );
    if (!res.ok) return [];
    const items = await res.json();
    return items.map((it: any) => {
      const addr = it.address || {};
      const suburb = addr.suburb || addr.neighbourhood || addr.residential || "";
      const city = addr.city || addr.town || addr.county || addr.state_district || "";
      const state = addr.state || "";
      const country = addr.country || "";
      const parts = [it.name || suburb, city !== it.name ? city : "", state, country].filter(Boolean);
      const uniqueParts = Array.from(new Set(parts));
      return {
        latitude: Number(Number(it.lat).toFixed(6)),
        longitude: Number(Number(it.lon).toFixed(6)),
        locationName: uniqueParts.join(", ") || it.display_name,
        accuracy: 10,
        isCalibrated: true,
      };
    });
  } catch {
    return [];
  }
}

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

export async function getIpLocation(): Promise<GeoLocationResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client", {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const d = await res.json();
    const city = d.city || d.locality || "";
    const state = d.principalSubdivision || "";
    const country = d.countryName || "";
    const parts = [city, state, country].filter(Boolean);
    const unique = Array.from(new Set(parts));
    if (!d.latitude || !d.longitude) return null;
    return {
      latitude: Number(Number(d.latitude).toFixed(6)),
      longitude: Number(Number(d.longitude).toFixed(6)),
      locationName: unique.join(", "),
      accuracy: 2500,
    };
  } catch {
    return null;
  }
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getCurrentLocation(
  preferredWorkLocation?: string | null,
  userId?: string | null
): Promise<GeoLocationResult> {
  // Check if a calibrated location is saved in localStorage for this user
  const calibrated = getCalibratedLocation(userId);
  if (calibrated) {
    return calibrated;
  }

  // Fetch real IP geolocation in parallel (to detect stale Windows/Wi-Fi router caches)
  const ipLocationPromise = getIpLocation();

  if (typeof window === "undefined" || !navigator.geolocation) {
    const ipLoc = await ipLocationPromise;
    if (ipLoc) return ipLoc;
    throw new Error("Geolocation is not supported by your browser or environment.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy || 0);

        const ipLoc = await ipLocationPromise.catch(() => null);

        // STALE WI-FI DETECTION:
        // On Windows PCs without GPS hardware, the browser queries the Microsoft Wi-Fi database.
        // If a router or hotspot was previously registered in another state (e.g. Dehradun vs Kerala),
        // the browser coordinates will be thousands of kilometers away from the real public IP connection.
        if (ipLoc && ipLoc.latitude && ipLoc.longitude) {
          const distKm = calculateDistanceKm(lat, lng, ipLoc.latitude, ipLoc.longitude);
          if (distKm > 150) {
            // Discrepancy > 150km indicates a stale device Wi-Fi database entry.
            // Prioritize the real IP connection (e.g. Kannur, Kerala).
            resolve({
              latitude: ipLoc.latitude,
              longitude: ipLoc.longitude,
              locationName: ipLoc.locationName,
              accuracy: ipLoc.accuracy || 2500,
            });
            return;
          }
        }

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
          accuracy,
        });
      },
      async (err) => {
        // Fallback to IP geolocation if browser permissions fail or timeout
        const ipLoc = await ipLocationPromise.catch(() => null);
        if (ipLoc) {
          resolve(ipLoc);
          return;
        }

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
      }
    );
  });
}
