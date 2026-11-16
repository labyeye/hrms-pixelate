const { PLAN_SLABS, GST_RATE } = require("./planFeatures");

// Plan prices are ex-GST; this is what is actually charged / stored as Invoice.amount (the invoice PDF reverses it with /1.18).
const withGst = (base) => Math.round(base * (1 + GST_RATE) * 100) / 100;

const PLAN_TIER = "web_mobile_whatsapp";
const PLAN_LABEL = "NestHR";
const GEO_PLAN_LABEL = "NestHR Geo Tracking";

// Flat yearly price by employee-count slab; yearly billing only. monthlyPrice
// is kept (yearly/12) only because the Subscription schema stores it.
function calculatePricing(employeeCount, geo = false) {
  const slab = PLAN_SLABS.find((s) => employeeCount <= s.maxEmployees);
  if (!slab) {
    const err = new Error(
      `More than ${PLAN_SLABS[PLAN_SLABS.length - 1].maxEmployees} employees — please contact sales for a custom quote.`,
    );
    err.statusCode = 400;
    throw err;
  }

  const yearlyPrice = geo ? slab.prices.geo : slab.prices.normal;
  return {
    tier: PLAN_TIER,
    geoTracking: !!geo,
    tierLabel: geo ? GEO_PLAN_LABEL : PLAN_LABEL,
    maxEmployees: slab.maxEmployees,
    // effective per-seat rate, informational (schema field is required)
    ratePerEmployee:
      Math.round((yearlyPrice / slab.maxEmployees) * 100) / 100,
    monthlyPrice: Math.round(yearlyPrice / 12),
    yearlyPrice,
  };
}

module.exports = {
  PLAN_SLABS,
  PLAN_TIER,
  PLAN_LABEL,
  GEO_PLAN_LABEL,
  withGst,
  calculatePricing,
};
