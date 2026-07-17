const asyncHandler = require("express-async-handler");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const OfferCode = require("../models/OfferCode");
const { FEATURES_BY_TIER } = require("../utils/planFeatures");

const getSaasStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    totalCompanies,
    companiesByStatus,
    newCompaniesThisMonth,
    subscriptionsByStatus,
    subscriptionsByPlan,
    subscriptionsByBillingCycle,
    revenueAgg,
    expiringSoon,
    recentInvoices,
  ] = await Promise.all([
    Company.countDocuments(),

    Company.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    Company.countDocuments({ createdAt: { $gte: startOfMonth } }),

    Subscription.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    Subscription.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),

    Subscription.aggregate([
      { $group: { _id: "$billingCycle", count: { $sum: 1 } } },
    ]),

    Invoice.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          thisMonthRevenue: {
            $sum: {
              $cond: [{ $gte: ["$paidAt", startOfMonth] }, "$amount", 0],
            },
          },
          totalInvoices: { $sum: 1 },
        },
      },
    ]),

    Subscription.countDocuments({
      status: "active",
      renewalDate: { $gte: now, $lte: next30Days },
    }),

    Invoice.find({ status: "paid" })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("company", "name email"),
  ]);

  // calculate MRR from active subscriptions
  const activeSubs = await Subscription.find({ status: "active" }).select(
    "billingCycle monthlyPrice yearlyPrice",
  );
  const mrr = activeSubs.reduce((sum, sub) => {
    if (sub.billingCycle === "monthly") return sum + (sub.monthlyPrice || 0);
    if (sub.billingCycle === "yearly") return sum + (sub.yearlyPrice || 0) / 12;
    return sum;
  }, 0);

  const statusMap = Object.fromEntries(
    companiesByStatus.map((s) => [s._id, s.count]),
  );
  const subStatusMap = Object.fromEntries(
    subscriptionsByStatus.map((s) => [s._id, s.count]),
  );
  const planMap = Object.fromEntries(
    subscriptionsByPlan.map((s) => [s._id, s.count]),
  );
  const cycleMap = Object.fromEntries(
    subscriptionsByBillingCycle.map((s) => [s._id, s.count]),
  );
  const revenue = revenueAgg[0] || {
    totalRevenue: 0,
    thisMonthRevenue: 0,
    totalInvoices: 0,
  };

  res.json({
    success: true,
    data: {
      companies: {
        total: totalCompanies,
        active: statusMap.active || 0,
        inactive: statusMap.inactive || 0,
        trial: statusMap.trial || 0,
        newThisMonth: newCompaniesThisMonth,
      },
      subscriptions: {
        active: subStatusMap.active || 0,
        inactive: subStatusMap.inactive || 0,
        cancelled: subStatusMap.cancelled || 0,
        pendingRenewal: subStatusMap.pending_renewal || 0,
        expiringSoon,
        byPlan: planMap,
        byBillingCycle: cycleMap,
      },
      revenue: {
        total: revenue.totalRevenue,
        thisMonth: revenue.thisMonthRevenue,
        mrr: Math.round(mrr),
        totalInvoices: revenue.totalInvoices,
      },
      recentInvoices: recentInvoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        plan: inv.plan,
        billingCycle: inv.billingCycle,
        amount: inv.amount,
        paidAt: inv.paidAt,
        company: inv.company
          ? { name: inv.company.name, email: inv.company.email }
          : null,
      })),
    },
  });
});

const updateCompanyTier = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const { tier } = req.body;

  if (!Object.keys(FEATURES_BY_TIER).includes(tier)) {
    res.status(400);
    throw new Error(
      `Invalid tier. Must be one of: ${Object.keys(FEATURES_BY_TIER).join(", ")}`,
    );
  }

  const company = await Company.findById(companyId).select("subscription");
  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }
  if (!company.subscription) {
    res.status(404);
    throw new Error("Company has no subscription to update");
  }

  const subscription = await Subscription.findByIdAndUpdate(
    company.subscription,
    { tier },
    { new: true },
  );

  res.json({ success: true, data: subscription });
});

const listOfferCodes = asyncHandler(async (req, res) => {
  const offerCodes = await OfferCode.find().sort({ createdAt: -1 });
  res.json({ success: true, data: offerCodes });
});

const createOfferCode = asyncHandler(async (req, res) => {
  const {
    code,
    description,
    discountType,
    bonusMonths,
    flatRate,
    percentOff,
    applicableTier,
    maxUses,
    expiresAt,
    createdByEmail,
  } = req.body;

  if (!code) {
    res.status(400);
    throw new Error("Coupon code is required");
  }
  if (!["bonus_months", "flat_rate", "percent_off"].includes(discountType)) {
    res.status(400);
    throw new Error(
      "discountType must be one of: bonus_months, flat_rate, percent_off",
    );
  }
  if (discountType === "bonus_months" && !bonusMonths) {
    res.status(400);
    throw new Error("bonusMonths is required for discountType bonus_months");
  }
  if (discountType === "flat_rate" && flatRate === undefined) {
    res.status(400);
    throw new Error("flatRate is required for discountType flat_rate");
  }
  if (discountType === "percent_off" && !percentOff) {
    res.status(400);
    throw new Error("percentOff is required for discountType percent_off");
  }
  if (applicableTier && !["standard", "whatsapp"].includes(applicableTier)) {
    res.status(400);
    throw new Error("applicableTier must be one of: standard, whatsapp");
  }

  const existing = await OfferCode.findOne({ code: code.toUpperCase().trim() });
  if (existing) {
    res.status(409);
    throw new Error("A coupon with this code already exists");
  }

  const offerCode = await OfferCode.create({
    code: code.toUpperCase().trim(),
    description,
    discountType,
    bonusMonths: discountType === "bonus_months" ? bonusMonths : undefined,
    flatRate: discountType === "flat_rate" ? flatRate : undefined,
    percentOff: discountType === "percent_off" ? percentOff : undefined,
    applicableTier: applicableTier || null,
    maxUses: maxUses ?? 200,
    expiresAt: expiresAt ?? null,
    createdByEmail: createdByEmail ?? "",
  });

  res.status(201).json({ success: true, data: offerCode });
});

const updateOfferCode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive, maxUses, expiresAt, description } = req.body;

  const update = {};
  if (isActive !== undefined) update.isActive = isActive;
  if (maxUses !== undefined) update.maxUses = maxUses;
  if (expiresAt !== undefined) update.expiresAt = expiresAt;
  if (description !== undefined) update.description = description;

  const offerCode = await OfferCode.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });
  if (!offerCode) {
    res.status(404);
    throw new Error("Coupon not found");
  }

  res.json({ success: true, data: offerCode });
});

module.exports = {
  getSaasStats,
  updateCompanyTier,
  listOfferCodes,
  createOfferCode,
  updateOfferCode,
};
