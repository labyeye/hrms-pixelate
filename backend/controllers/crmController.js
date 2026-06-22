const Invoice = require("../models/Invoice");

const STATUS_MAP = {
  paid: "paid",
  unpaid: "pending",
  overdue: "failed",
};

exports.getCrmInvoices = async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.CRM_API_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

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
