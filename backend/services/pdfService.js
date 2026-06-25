const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const CHEQUE_PATH = path.join(
  __dirname,
  "../../frontend/assets/payrollcheque.pdf",
);

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function fmt(n) {
  return (
    "Rs. " +
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0)
  );
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function toIndianWords(n) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  if (!n || n === 0) return "Zero";
  const two = (x) =>
    x < 20
      ? ones[x]
      : tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
  let r = "",
    x = Math.round(n);
  const cr = Math.floor(x / 10000000);
  x %= 10000000;
  const lk = Math.floor(x / 100000);
  x %= 100000;
  const th = Math.floor(x / 1000);
  x %= 1000;
  const hu = Math.floor(x / 100);
  x %= 100;
  if (cr) r += two(cr) + " Crore ";
  if (lk) r += two(lk) + " Lakh ";
  if (th) r += two(th) + " Thousand ";
  if (hu) r += ones[hu] + " Hundred ";
  if (x) r += two(x);
  return "Rupees " + r.trim() + " Only";
}

async function generatePayslipPdf(payroll, employee, company) {
  const net = Math.round(payroll.netSalary || 0);
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = String(today.getFullYear()); // 4-digit year, matching frontend
  const lastDay = new Date(payroll.year, payroll.month, 0).getDate();
  const fromDate = `01/${String(payroll.month).padStart(2, "0")}/${payroll.year}`;
  const toDate = `${lastDay}/${String(payroll.month).padStart(2, "0")}/${payroll.year}`;
  const empName =
    `${employee.firstName || ""} ${employee.lastName || ""}`.trim();

  let pdfDoc;
  if (fs.existsSync(CHEQUE_PATH)) {
    const templateBytes = fs.readFileSync(CHEQUE_PATH);
    pdfDoc = await PDFDocument.load(templateBytes);
  } else {
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([576, 263.25]);
  }

  const [chequePage] = pdfDoc.getPages();
  const { height: ph } = chequePage.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // POS coordinates are CSS px from the frontend (1:1 with PDF pts for this template).
  // Canvas origin is top-left; pdf-lib origin is bottom-left → y_pdf = ph - pos.y
  const dt = (text, x, y, size = 11, bold = false) => {
    chequePage.drawText(String(text), {
      x,
      y: ph - y,
      size,
      font: bold ? boldFont : font,
      color: rgb(0, 0, 0),
    });
  };

  // Mirror of PayrollPage.tsx POS map exactly
  dt(company.name || "", 75, 30, 13, true);
  dt(company.address || "", 75, 48, 11, false);

  // Date: DDMMYYYY — one character per box (same as frontend dateChars)
  const dateStr = dd + mm + yyyy;
  const dateCharX = [430, 445, 460, 475, 491, 507, 523, 538];
  dateCharX.forEach((x, i) => dt(dateStr[i] ?? "", x, 36, 11, false));

  dt(empName, 100, 120, 11, false);
  dt(employee.employeeId || "—", 320, 120, 11, false);
  dt(employee.designation || "—", 435, 120, 11, false);
  dt(toIndianWords(net), 115, 145, 11, false);
  dt(fmtNum(net), 440, 150, 13, true);
  dt(fromDate, 250, 174, 11, false);
  dt(toDate, 340, 174, 11, false);

  return await pdfDoc.save();
}

module.exports = { generatePayslipPdf };
