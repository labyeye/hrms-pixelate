const Invoice = require("../models/Invoice");
const OfferCode = require("../models/OfferCode");

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
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/crm/offers — create a new offer code
exports.createCrmOffer = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const { code, description, bonusMonths, maxUses, expiresAt, createdByEmail } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "code is required" });
    if (!bonusMonths || bonusMonths < 1) return res.status(400).json({ success: false, message: "bonusMonths must be >= 1" });

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
      return res.status(409).json({ success: false, message: "Offer code already exists" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/crm/offers/:id — update offer (activate/deactivate, change limits)
exports.updateCrmOffer = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const allowed = ["description", "bonusMonths", "maxUses", "isActive", "expiresAt"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const offer = await OfferCode.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-usages");
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/crm/offers/:id — hard delete
exports.deleteCrmOffer = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const offer = await OfferCode.findByIdAndDelete(req.params.id);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
    res.json({ success: true, message: "Offer code deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
