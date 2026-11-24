const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const CompanyExpense = require("../models/CompanyExpense");
const { validateMagicBytes } = require("../middleware/upload");

const BILL_DIR = path.join(__dirname, "../uploads/expense-bills");
const CATEGORIES = CompanyExpense.schema.path("category").enumValues;
const MODES = CompanyExpense.schema.path("paymentMode").enumValues;
const dropFiles = (files) => (files || []).forEach((f) => fs.unlink(f.path, () => {}));
const dropNames = (names) => (names || []).forEach((n) => fs.unlink(path.join(BILL_DIR, path.basename(n)), () => {}));

function parse(body) {
  const amount = Number(body.amount);
  const date = new Date(body.date);
  const title = String(body.title || "").trim();
  if (!title || !(amount > 0) || isNaN(date)) throw new Error("Title, a valid amount and date are required");
  return {
    title: title.slice(0, 120),
    category: CATEGORIES.includes(body.category) ? body.category : "other",
    amount,
    date,
    vendor: String(body.vendor || "").trim().slice(0, 100),
    paymentMode: MODES.includes(body.paymentMode) ? body.paymentMode : "bank_transfer",
    reference: String(body.reference || "").trim().slice(0, 100),
    notes: String(body.notes || "").slice(0, 500),
  };
}

const list = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company };
  if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  const m = Number(req.query.month);
  const y = Number(req.query.year);
  if (m >= 1 && m <= 12 && y > 2000) filter.date = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
  const data = await CompanyExpense.find(filter).sort({ date: -1, createdAt: -1 }).limit(1000).populate("addedBy", "name").lean();
  const total = data.reduce((s, e) => s + e.amount, 0);
  const byCategory = {};
  for (const e of data) byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  res.json({ success: true, data, summary: { total, count: data.length, byCategory } });
});

const create = asyncHandler(async (req, res) => {
  try {
    const files = req.files || [];
    for (const f of files) await validateMagicBytes(f.path);
    let fields;
    try {
      fields = parse(req.body);
    } catch (e) {
      res.status(400);
      throw e;
    }
    const doc = await CompanyExpense.create({ ...fields, company: req.user.company, addedBy: req.user._id, bills: files.map((f) => f.filename) });
    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    dropFiles(req.files);
    throw e;
  }
});

const update = asyncHandler(async (req, res) => {
  try {
    const doc = await CompanyExpense.findOne({ _id: req.params.id, company: req.user.company });
    if (!doc) {
      res.status(404);
      throw new Error("Expense not found");
    }
    const files = req.files || [];
    for (const f of files) await validateMagicBytes(f.path);
    let fields;
    try {
      fields = parse(req.body);
    } catch (e) {
      res.status(400);
      throw e;
    }
    let removeList = [];
    try {
      removeList = JSON.parse(req.body.removeBills || "[]");
    } catch (_) {}
    const removed = doc.bills.filter((b) => removeList.includes(b));
    const kept = doc.bills.filter((b) => !removed.includes(b));
    if (kept.length + files.length > 5) {
      res.status(400);
      throw new Error("Maximum 5 bills");
    }
    Object.assign(doc, fields, { bills: [...kept, ...files.map((f) => f.filename)] });
    await doc.save();
    dropNames(removed);
    res.json({ success: true, data: doc });
  } catch (e) {
    dropFiles(req.files);
    throw e;
  }
});

const remove = asyncHandler(async (req, res) => {
  const doc = await CompanyExpense.findOneAndDelete({ _id: req.params.id, company: req.user.company });
  if (!doc) {
    res.status(404);
    throw new Error("Expense not found");
  }
  dropNames(doc.bills);
  res.json({ success: true });
});

async function billFor(req, res) {
  const doc = await CompanyExpense.findOne({ _id: req.params.id, company: req.user.company }).lean();
  const file = doc?.bills?.[Number(req.params.index) || 0];
  if (!file) {
    res.status(404);
    throw new Error("Bill not found");
  }
  return path.basename(file);
}

const downloadBill = asyncHandler(async (req, res) => {
  res.sendFile(path.join(BILL_DIR, await billFor(req, res)));
});

// Same signed-link scheme as reimbursement bills; served by expenseController.serveBillByToken.
const getBillLink = asyncHandler(async (req, res) => {
  const file = await billFor(req, res);
  const token = jwt.sign({ purpose: "expense-bill", file }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "2m" });
  res.json({ success: true, data: { path: `/expenses/bill-file/${token}` } });
});

module.exports = { list, create, update, remove, downloadBill, getBillLink };
