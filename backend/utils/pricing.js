const { PLAN_SLABS } = require("./planFeatures");

const PLAN_TIER = "web_mobile_whatsapp";
const PLAN_LABEL = "NestHR";

// Flat yearly price by employee-count slab; yearly billing only. monthlyPrice
// is kept (yearly/12) only because the Subscription schema stores it.
function calculatePricing(employeeCount) {
  const slab = PLAN_SLABS.find((s) => employeeCount <= s.maxEmployees);
  if (!slab) {
    const err = new Error(
      `More than ${PLAN_SLABS[PLAN_SLABS.length - 1].maxEmployees} employees — please contact sales for a custom quote.`,
    );
    err.statusCode = 400;
    throw err;
  }

  return {
    tier: PLAN_TIER,
    tierLabel: PLAN_LABEL,
    maxEmployees: slab.maxEmployees,
    // effective per-seat rate, informational (schema field is required)
    ratePerEmployee:
      Math.round((slab.yearlyPrice / slab.maxEmployees) * 100) / 100,
    monthlyPrice: Math.round(slab.yearlyPrice / 12),
    yearlyPrice: slab.yearlyPrice,
  };
}

module.exports = { PLAN_SLABS, PLAN_TIER, PLAN_LABEL, calculatePricing };
