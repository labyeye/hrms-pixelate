const asyncHandler = require("express-async-handler");
const TaxDeclaration = require("../models/TaxDeclaration");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const Payroll = require("../models/Payroll");

const currentFY = () => {
  const d = new Date();
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; // FY starts April
};
const fyParam = (req) => parseInt(req.query.fy || req.body.fy) || currentFY();
const selfEmployee = (req) =>
  Employee.findOne({ user: req.user._id, company: req.user.company });
const NUM = ["sec80C", "sec80D", "hraRentPaid", "homeLoanInterest", "otherDeductions"];

const getMyDeclaration = asyncHandler(async (req, res) => {
  const emp = await selfEmployee(req);
  if (!emp) {
    res.status(404);
    throw new Error("Employee record not found for your account");
  }
  const fy = fyParam(req);
  res.json({
    success: true,
    fy,
    data: await TaxDeclaration.findOne({ employee: emp._id, fy }).lean(),
  });
});

const saveMyDeclaration = asyncHandler(async (req, res) => {
  const emp = await selfEmployee(req);
  if (!emp) {
    res.status(404);
    throw new Error("Employee record not found for your account");
  }
  const fy = fyParam(req);
  const existing = await TaxDeclaration.findOne({ employee: emp._id, fy });
  if (existing?.status === "verified") {
    res.status(400);
    throw new Error("Verified declarations are locked - ask HR to reopen it");
  }
  const doc = {
    regime: req.body.regime === "old" ? "old" : "new",
    proofNote: (req.body.proofNote || "").slice(0, 500),
    status: "submitted",
    remark: "",
  };
  for (const k of NUM) doc[k] = Math.max(0, Number(req.body[k]) || 0);
  doc.sec80C = Math.min(doc.sec80C, 150000); // statutory cap
  const saved = await TaxDeclaration.findOneAndUpdate(
    { employee: emp._id, fy },
    { ...doc, company: req.user.company },
    { upsert: true, new: true },
  );
  res.json({ success: true, data: saved });
});

const listDeclarations = asyncHandler(async (req, res) => {
  const rows = await TaxDeclaration.find({
    company: req.user.company,
    fy: fyParam(req),
  })
    .populate("employee", "firstName lastName employeeId")
    .sort({ updatedAt: -1 })
    .lean();
  res.json({ success: true, data: rows });
});

const reviewDeclaration = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["verified", "rejected", "submitted"].includes(status)) {
    res.status(400);
    throw new Error("Invalid status");
  }
  const d = await TaxDeclaration.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    {
      status,
      verifiedBy: req.user._id,
      remark: (req.body.remark || "").slice(0, 300),
    },
    { new: true },
  );
  if (!d) {
    res.status(404);
    throw new Error("Declaration not found");
  }
  res.json({ success: true, data: d });
});

// Annual tax statement (Form 16 Part B layout) built from processed payroll, Apr..Mar.
// Employee: own only. HR: ?employee=<id>.
const getForm16 = asyncHandler(async (req, res) => {
  let emp;
  if (req.user.role === "employee" || !req.query.employee)
    emp = await selfEmployee(req);
  else
    emp = await Employee.findOne({
      _id: req.query.employee,
      company: req.user.company,
    });
  if (!emp) {
    res.status(404);
    throw new Error("Employee not found");
  }
  const fy = fyParam(req);
  const rows = await Payroll.find({
    employee: emp._id,
    company: req.user.company,
    status: { $in: ["processed", "paid"] },
    $or: [
      { year: fy, month: { $gte: 4 } },
      { year: fy + 1, month: { $lte: 3 } },
    ],
  })
    .sort({ year: 1, month: 1 })
    .lean();
  if (!rows.length) {
    res.status(404);
    throw new Error(`No processed payroll found for FY ${fy}-${String(fy + 1).slice(2)}`);
  }
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const [company, decl] = await Promise.all([
    Company.findById(req.user.company).select("name address panNumber").lean(),
    TaxDeclaration.findOne({ employee: emp._id, fy, status: "verified" }).lean(),
  ]);
  const regime = decl?.regime || "new";
  const old = regime === "old" && decl;
  const stdDed = regime === "old" ? 50000 : 75000;
  const chapVI = old
    ? Math.min(decl.sec80C, 150000) + decl.sec80D + decl.otherDeductions
    : 0;
  const homeLoan = old ? Math.min(decl.homeLoanInterest, 200000) : 0;
  const gross = sum("grossSalary");
  res.json({
    success: true,
    data: {
      fy,
      company,
      employee: {
        name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
        employeeId: emp.employeeId,
        designation: emp.designation,
        pan: emp.panNumber,
      },
      regime,
      declarationVerified: !!decl,
      months: rows.map((r) => ({
        month: r.month,
        year: r.year,
        gross: r.grossSalary,
        pf: r.pf,
        esi: r.esi,
        tds: r.tds,
      })),
      totals: {
        gross,
        pf: sum("pf"),
        esi: sum("esi"),
        tds: sum("tds"),
        net: sum("netSalary"),
      },
      taxable: {
        standardDeduction: stdDed,
        chapterVIA: chapVI,
        homeLoanInterest: homeLoan,
        income: Math.max(0, gross - stdDed - chapVI - homeLoan),
      },
    },
  });
});

module.exports = {
  getMyDeclaration,
  saveMyDeclaration,
  listDeclarations,
  reviewDeclaration,
  getForm16,
};
