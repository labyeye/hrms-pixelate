const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const CHEQUE_PATH = path.join(__dirname, "../../frontend/assets/payrollcheque.pdf");

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n) {
  return "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0);
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function toIndianWords(n) {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (!n || n === 0) return "Zero";
  const two = (x) => x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? " "+ones[x%10] : "");
  let r = "", x = Math.round(n);
  const cr = Math.floor(x/10000000); x %= 10000000;
  const lk = Math.floor(x/100000);   x %= 100000;
  const th = Math.floor(x/1000);     x %= 1000;
  const hu = Math.floor(x/100);      x %= 100;
  if (cr) r += two(cr) + " Crore ";
  if (lk) r += two(lk) + " Lakh ";
  if (th) r += two(th) + " Thousand ";
  if (hu) r += ones[hu] + " Hundred ";
  if (x)  r += two(x);
  return "Rupees " + r.trim() + " Only";
}

async function generatePayslipPdf(payroll, employee, company) {
  const net = Math.round(payroll.netSalary || 0);
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yy = String(today.getFullYear()).slice(2);
  const lastDay = new Date(payroll.year, payroll.month, 0).getDate();
  const fromDate = `01/${String(payroll.month).padStart(2, "0")}/${payroll.year}`;
  const toDate   = `${lastDay}/${String(payroll.month).padStart(2, "0")}/${payroll.year}`;
  const period   = `${MONTHS[payroll.month - 1]} ${payroll.year}`;
  const empName  = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();

  // ── Page 1: Cheque template overlay ──────────────────────────────────────
  let pdfDoc;
  if (fs.existsSync(CHEQUE_PATH)) {
    const templateBytes = fs.readFileSync(CHEQUE_PATH);
    pdfDoc = await PDFDocument.load(templateBytes);
  } else {
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([794, 430]);
  }

  const [chequePage] = pdfDoc.getPages();
  const { width: pw, height: ph } = chequePage.getSize();
  const sx = pw / 794; // scale x (CSS px → PDF pts)
  const sy = ph / 430; // scale y

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Draw text at CSS-pixel coordinates (origin top-left in CSS → bottom-left in PDF)
  const dt = (text, left, top, size = 9, bold = false) => {
    chequePage.drawText(String(text), {
      x: left * sx,
      y: ph - top * sy - size * sy,
      size: size * Math.min(sx, sy),
      font: bold ? boldFont : font,
      color: rgb(0, 0, 0),
    });
  };

  // Same POS map as PayrollPage.tsx
  dt(company.name    || "", 168, 38,  11, true);
  dt(company.address || "", 168, 58,  9,  false);
  dt(dd,                    695, 30,  10, true);
  dt(mm,                    727, 30,  10, true);
  dt(yy,                    756, 30,  10, true);
  dt(empName,               173, 196, 10, true);
  dt(employee.employeeId || "", 528, 196, 10, true);
  dt(employee.designation  || "", 690, 196, 10, true);
  dt(toIndianWords(net),    75,  258, 9,  false);
  dt(fmtNum(net),           738, 252, 12, true);
  dt(fromDate,              478, 318, 10, true);
  dt(toDate,                638, 318, 10, true);
  dt(fmtNum(net),           748, 318, 11, true);

  // ── Page 2: Salary Report (A4) ────────────────────────────────────────────
  const reportPage = pdfDoc.addPage([595, 842]);
  const { height: rh } = reportPage.getSize();
  const rf = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const rb = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = rh - 50;
  const L = 50, R = 545, COL2 = 400;

  const line = (text, x, yPos, size = 10, bold = false, color = rgb(0,0,0)) => {
    reportPage.drawText(String(text), { x, y: yPos, size, font: bold ? rb : rf, color });
  };
  const hrule = (yPos, thickness = 0.5) => {
    reportPage.drawLine({ start: { x: L, y: yPos }, end: { x: R, y: yPos },
      thickness, color: rgb(0.7, 0.7, 0.7) });
  };

  // Header
  line("SALARY SLIP", L, y, 16, true, rgb(0.01, 0.29, 0.67));
  y -= 20;
  line(`${company.name || ""}`, L, y, 10, false, rgb(0.3, 0.3, 0.3));
  y -= 14;
  line(`Period: ${period}`, L, y, 10);
  y -= 8; hrule(y); y -= 16;

  // Employee details
  line("Employee",    L,    y, 9, false, rgb(0.5,0.5,0.5));
  line("ID",          250,  y, 9, false, rgb(0.5,0.5,0.5));
  line("Designation", 380,  y, 9, false, rgb(0.5,0.5,0.5));
  y -= 14;
  line(empName,          L,   y, 10, true);
  line(employee.employeeId || "—", 250, y, 10);
  line(employee.designation || "—", 380, y, 10);
  y -= 8; hrule(y); y -= 18;

  // Attendance row
  line("Working Days", L,   y, 9, false, rgb(0.5,0.5,0.5));
  line("Present",      200, y, 9, false, rgb(0.5,0.5,0.5));
  line("Absent",       300, y, 9, false, rgb(0.5,0.5,0.5));
  line("Leave",        390, y, 9, false, rgb(0.5,0.5,0.5));
  y -= 14;
  line(String(payroll.workingDays || 0), L,   y, 10, true);
  line(String(payroll.presentDays || 0), 200, y, 10, true);
  line(String(payroll.workingDays - payroll.presentDays - (payroll.leaveDays||0) || 0), 300, y, 10, true);
  line(String(payroll.leaveDays || 0),   390, y, 10, true);
  y -= 8; hrule(y); y -= 18;

  // Earnings
  line("EARNINGS", L, y, 10, true, rgb(0.01, 0.29, 0.67)); y -= 16;
  const earn = [
    ["Basic Salary",  payroll.basicSalary],
    ["Earned Basic",  payroll.earnedBasic],
    ["Allowances",    payroll.otherAllowances],
    ["Overtime Pay",  payroll.otPay],
  ];
  for (const [label, val] of earn) {
    if (!val && val !== 0) continue;
    line(label,    L,    y, 10);
    line(fmt(val), COL2, y, 10);
    y -= 14;
  }
  hrule(y); y -= 2;
  line("Gross Salary", L,    y, 10, true);
  line(fmt(payroll.grossSalary), COL2, y, 10, true);
  y -= 18;

  // Deductions
  line("DEDUCTIONS", L, y, 10, true, rgb(0.8, 0.1, 0.1)); y -= 16;
  const deductions = [
    ["Loan / Advance",    payroll.loanDeduction],
    ["Late Deduction",    payroll.lateDeductionAmount],
    ["Half Day Deduction",payroll.halfDayDeduction],
    ["Penalty",           payroll.penaltyAmount],
    ["Other Deductions",  payroll.otherDeductions],
  ];
  for (const [label, val] of deductions) {
    if (!val) continue;
    line(label,      L,    y, 10);
    line(`-${fmt(val)}`, COL2, y, 10, false, rgb(0.8,0.1,0.1));
    y -= 14;
  }
  hrule(y); y -= 2;
  line("Total Deductions", L,    y, 10, true);
  line(`-${fmt(payroll.totalDeductions)}`, COL2, y, 10, true, rgb(0.8,0.1,0.1));
  y -= 20;

  // Net Pay box
  reportPage.drawRectangle({
    x: L, y: y - 14, width: R - L, height: 28,
    color: rgb(0.01, 0.29, 0.67),
    borderWidth: 0,
  });
  line("NET PAY", L + 10, y, 13, true, rgb(1,1,1));
  line(fmt(net), COL2 - 20, y, 13, true, rgb(1,1,1));
  y -= 40;

  // Footer
  line(`Generated by NestHR on ${today.toLocaleDateString("en-IN")}`, L, y, 8, false, rgb(0.6,0.6,0.6));

  return await pdfDoc.save();
}

module.exports = { generatePayslipPdf };
