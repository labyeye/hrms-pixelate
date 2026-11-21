// Reverse geocoding (lat/lng -> street address) via OpenStreetMap Nominatim.
// NOTE: this sends the punch coordinates to nominatim.openstreetmap.org. Nominatim's usage policy
// allows ~1 request/second and requires an identifying User-Agent, so lookups are serialised, cached
// by ~10 m grid cell, and the result is stored on the Attendance record so each punch is looked up once.
const cache = new Map();
let chain = Promise.resolve();

const keyOf = (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

function lookup(lat, lng) {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`,
    {
      headers: { "User-Agent": "NestHR-attendance-report/1.0", "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    },
  )
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.display_name ? String(j.display_name) : null))
    .catch(() => null);
}

function reverseGeocode(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return Promise.resolve(null);
  const k = keyOf(lat, lng);
  if (cache.has(k)) return Promise.resolve(cache.get(k));
  const p = chain.then(async () => {
    if (cache.has(k)) return cache.get(k);
    const addr = await lookup(lat, lng);
    if (addr) cache.set(k, addr);
    await new Promise((r) => setTimeout(r, 1100));
    return addr;
  });
  chain = p.catch(() => {});
  return p;
}

module.exports = { reverseGeocode };
