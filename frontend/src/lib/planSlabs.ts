// Keep in sync with PLAN_SLABS in backend/utils/planFeatures.js
export const PLAN_SLABS = [
  { maxEmployees: 25, yearlyPrice: 6499 },
  { maxEmployees: 50, yearlyPrice: 11999 },
  { maxEmployees: 100, yearlyPrice: 18999 },
] as const;

export const MAX_SELF_SERVE_EMPLOYEES =
  PLAN_SLABS[PLAN_SLABS.length - 1].maxEmployees;

// undefined → more than the last slab: contact sales
export const slabFor = (employees: number) =>
  PLAN_SLABS.find((s) => employees <= s.maxEmployees);

export const SALES_URL = "https://www.pixelatenest.com/pages/contact.html";
