const TIERS = [
  { minEmployees: 1, maxEmployees: 10, ratePerEmployee: 40, label: "1-10 employees" },
  { minEmployees: 11, maxEmployees: 20, ratePerEmployee: 35, label: "11-20 employees" },
  { minEmployees: 21, maxEmployees: 40, ratePerEmployee: 30, label: "21-40 employees" },
  { minEmployees: 41, maxEmployees: 60, ratePerEmployee: 25, label: "41-60 employees" },
  { minEmployees: 61, maxEmployees: Infinity, ratePerEmployee: 20, label: "60+ employees" },
];

const YEARLY_DISCOUNT = 0.2;

function getTier(employeeCount) {
  return (
    TIERS.find(
      (t) => employeeCount >= t.minEmployees && employeeCount <= t.maxEmployees,
    ) || TIERS[0]
  );
}

function calculatePricing(employeeCount) {
  const tier = getTier(employeeCount);
  const monthlyPrice = employeeCount * tier.ratePerEmployee;
  const yearlyPrice = Math.round(monthlyPrice * 12 * (1 - YEARLY_DISCOUNT));
  return {
    ratePerEmployee: tier.ratePerEmployee,
    tierLabel: tier.label,
    monthlyPrice,
    yearlyPrice,
  };
}

module.exports = { TIERS, getTier, calculatePricing };
