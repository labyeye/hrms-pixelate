const Company = require("../models/Company");
const Subscription = require("../models/Subscription");

const FEATURES_BY_TIER = {
  web_mobile: {
    mobileApp: true,
    payroll: true,
    performanceReviews: true,
    exitManagement: true,
    whatsapp: false,
    twoFactor: false,
    auditLog: false,
  },
  web_mobile_whatsapp: {
    mobileApp: true,
    payroll: true,
    performanceReviews: true,
    exitManagement: true,
    whatsapp: true,
    twoFactor: true,
    auditLog: true,
  },
};

// Flat yearly price per employee-count slab. Single plan with every feature
// (tier "web_mobile_whatsapp"); above the last slab → contact sales.
const PLAN_SLABS = [
  { maxEmployees: 25, yearlyPrice: 6499 },
  { maxEmployees: 50, yearlyPrice: 11999 },
  { maxEmployees: 100, yearlyPrice: 18999 },
];

// Fail-closed: no company doc or no subscription at all → most restrictive
// feature set ("web_mobile"). But a subscription that predates the `tier`
// field (every tenant created before this field existed) should NOT be
// silently downgraded — those default to full access, matching the schema's
// own `default: "web_mobile_whatsapp"` for new documents.
async function getCompanyFeatures(companyId) {
  const company = companyId
    ? await Company.findById(companyId).select("subscription")
    : null;
  const sub = company?.subscription
    ? await Subscription.findById(company.subscription).select("tier")
    : null;
  if (!sub) return FEATURES_BY_TIER.web_mobile;
  const tier = sub.tier || "web_mobile_whatsapp";
  return FEATURES_BY_TIER[tier] || FEATURES_BY_TIER.web_mobile;
}

module.exports = { FEATURES_BY_TIER, PLAN_SLABS, getCompanyFeatures };
