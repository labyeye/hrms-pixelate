// Keep in sync with PLAN_SLABS in backend/utils/planFeatures.js
// Prices are yearly, ex-GST. "geo" adds geo-fencing + live GPS tracking.
export const PLAN_SLABS = [
  { maxEmployees: 25, prices: { normal: 7500, geo: 13000 } },
  { maxEmployees: 50, prices: { normal: 13500, geo: 24000 } },
] as const;

export const GST_RATE = 0.18;

export const MAX_SELF_SERVE_EMPLOYEES =
  PLAN_SLABS[PLAN_SLABS.length - 1].maxEmployees;

// undefined → more than the last slab: contact sales
export const slabFor = (employees: number) =>
  PLAN_SLABS.find((s) => employees <= s.maxEmployees);

export const SALES_URL = "https://www.pixelatenest.com/pages/contact.html";
