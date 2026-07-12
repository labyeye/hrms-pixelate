const Invoice = require("../models/Invoice");
const OfferCode = require("../models/OfferCode");
const Attendance = require("../models/Attendance");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");

const crmAuth = (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.CRM_API_SECRET) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return false;
  }
  return true;
};

const STATUS_MAP = {
  paid: "paid",
  unpaid: "pending",
  overdue: "failed",
};

exports.getCrmInvoices = async (req, res) => {
  if (!crmAuth(req, res)) return;

  const query = { invoiceNumber: /^KHT\/HR\// };

  if (req.query.status) {
    const mapped = STATUS_MAP[req.query.status];
    if (!mapped) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Use paid, unpaid, or overdue.",
      });
    }
    query.status = mapped;
  }

  const invoices = await Invoice.find(query)
    .populate(
      "company",
      "name email phone industry website address gstNumber panNumber",
    )
    .populate("subscription", "plan billingCycle status maxEmployees")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, invoices });
};

// GET /api/crm/offers — list all offer codes with stats
exports.getCrmOffers = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const offers = await OfferCode.find()
      .select("-usages")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, offers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/crm/offers/:id — single offer with full usage list
exports.getCrmOfferById = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const offer = await OfferCode.findById(req.params.id).lean();
    if (!offer)
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/crm/offers — create a new offer code
exports.createCrmOffer = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const {
      code,
      description,
      bonusMonths,
      maxUses,
      expiresAt,
      createdByEmail,
    } = req.body;
    if (!code)
      return res
        .status(400)
        .json({ success: false, message: "code is required" });
    if (!bonusMonths || bonusMonths < 1)
      return res
        .status(400)
        .json({ success: false, message: "bonusMonths must be >= 1" });

    const offer = await OfferCode.create({
      code: code.toUpperCase().trim(),
      description: description || "",
      bonusMonths,
      maxUses: maxUses || 200,
      expiresAt: expiresAt || null,
      createdByEmail: createdByEmail || "",
    });

    res.status(201).json({ success: true, offer });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Offer code already exists" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/crm/offers/:id — update offer (activate/deactivate, change limits)
exports.updateCrmOffer = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const allowed = [
      "description",
      "bonusMonths",
      "maxUses",
      "isActive",
      "expiresAt",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const offer = await OfferCode.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).select("-usages");
    if (!offer)
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/crm/attendance — attendance records with optional filters: date, companyId, status
exports.getCrmAttendance = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const filter = {};

    if (req.query.date) {
      const day = new Date(req.query.date);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      filter.date = { $gte: day, $lt: next };
    }

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) filter.date.$lte = new Date(req.query.to);
    }

    if (req.query.status) filter.status = req.query.status;

    const records = await Attendance.find(filter)
      .populate("employee", "firstName lastName email employeeId company")
      .sort({ date: -1 })
      .lean();

    // optionally filter by company after populate
    const companyId = req.query.companyId;
    const result = companyId
      ? records.filter(
          (r) => r.employee?.company?.toString() === companyId,
        )
      : records;

    res.json({ success: true, total: result.length, attendance: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/crm/companies/:companyId/subscription — activate/extend/deactivate a
// company's subscription from the external CRM dashboard on payment/expiry events.
exports.updateCrmSubscription = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const { companyId } = req.params;
    const { status, paymentStatus, renewalDate } = req.body;

    const allowedStatus = ["active", "inactive", "cancelled", "pending_renewal"];
    const allowedPaymentStatus = ["pending", "completed", "failed"];
    if (status !== undefined && !allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${allowedStatus.join(", ")}`,
      });
    }
    if (paymentStatus !== undefined && !allowedPaymentStatus.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid paymentStatus. Must be one of: ${allowedPaymentStatus.join(", ")}`,
      });
    }

    const company = await Company.findById(companyId).select("subscription");
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!company.subscription) {
      return res.status(404).json({ success: false, message: "Company has no subscription to update" });
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
    if (renewalDate !== undefined) updates.renewalDate = new Date(renewalDate);

    const subscription = await Subscription.findByIdAndUpdate(
      company.subscription,
      updates,
      { new: true },
    );

    res.json({ success: true, subscription });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/crm/offers/:id — hard delete
exports.deleteCrmOffer = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const offer = await OfferCode.findByIdAndDelete(req.params.id);
    if (!offer)
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    res.json({ success: true, message: "Offer code deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
