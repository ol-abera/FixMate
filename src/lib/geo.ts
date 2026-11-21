export interface LatLng { lat: number; lng: number }

const KEY = "fixmate_origin";

/** Ask the browser for the device location (rounded to ~100 m; that's plenty for "pros near me"). */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) { reject(new Error("Your browser can't share a location.")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4) }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED
        ? "Location access is blocked. Allow it in your browser to sort pros by distance."
        : "We couldn't get your location. Please try again.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** The origin is kept for the browser tab only, never in the URL. */
export function savedOrigin(): LatLng | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    return v && typeof v.lat === "number" && typeof v.lng === "number" ? v : null;
  } catch { return null; }
}

export function saveOrigin(origin: LatLng | null) {
  if (origin) sessionStorage.setItem(KEY, JSON.stringify(origin));
  else sessionStorage.removeItem(KEY);
}
