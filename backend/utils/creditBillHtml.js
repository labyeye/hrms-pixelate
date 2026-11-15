// Printable GST tax invoice for a WhatsApp-credit top-up. Same layout as the subscription invoice
// (NestHR/src/utils/buildInvoiceHTML.ts). One source for the owner download and the CRM download.
const { PIXELATE_NEST_LOGO } = require("./invoiceLogo");

const HSN = "998413";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const fmt = (n) =>
  "Rs. " +
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

function numToWords(n) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n === 0) return "Zero Rupees Only";
  const w = (x) => {
    if (x < 20) return a[x];
    if (x < 100) return b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : "");
    if (x < 1000) return a[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + w(x % 100) : "");
    if (x < 100000) return w(Math.floor(x / 1000)) + " Thousand" + (x % 1000 ? " " + w(x % 1000) : "");
    if (x < 10000000) return w(Math.floor(x / 100000)) + " Lakh" + (x % 100000 ? " " + w(x % 100000) : "");
    return w(Math.floor(x / 10000000)) + " Crore" + (x % 10000000 ? " " + w(x % 10000000) : "");
  };
  const paise = Math.round((n % 1) * 100);
  return w(Math.floor(n)) + " Rupees" + (paise ? " and " + w(paise) + " Paise" : "") + " Only";
}

/** t = CreditTopup (lean), company = Company (lean). Stored price/gst are what the customer was actually charged. */
function creditBillHtml(t, company = {}) {
  const inter = !!String(company.state || "").trim() && !/bihar/i.test(company.state);
  const base = Number(t.price || 0);
  const gst = Number(t.gst || 0);
  const total = Number(t.total || 0);
  const half = gst / 2;
  const addr = [company.address, company.city, company.state, company.pincode].filter(Boolean).map(esc).join(", ");
  const r = (s) => `<td style="text-align:right">${s}</td>`;
  const taxHeader = inter
    ? `<tr><th>HSN/SAC</th><th>Taxable Value</th><th>IGST Rate</th><th>IGST Amt</th><th>Total Tax</th></tr>`
    : `<tr><th>HSN/SAC</th><th>Taxable Value</th><th>CGST Rate</th><th>CGST Amt</th><th>SGST Rate</th><th>SGST Amt</th><th>Total Tax</th></tr>`;
  const taxRow = inter
    ? `<tr><td>${HSN}</td>${r(fmt(base))}${r("18%")}${r(fmt(gst))}${r(fmt(gst))}</tr>`
    : `<tr><td>${HSN}</td>${r(fmt(base))}${r("9%")}${r(fmt(half))}${r("9%")}${r(fmt(half))}${r(fmt(gst))}</tr>`;
  const taxFoot = inter
    ? `<tr><td><b>Total</b></td>${r(`<b>${fmt(base)}</b>`)}<td></td>${r(`<b>${fmt(gst)}</b>`)}${r(`<b>${fmt(gst)}</b>`)}</tr>`
    : `<tr><td><b>Total</b></td>${r(`<b>${fmt(base)}</b>`)}<td></td>${r(`<b>${fmt(half)}</b>`)}<td></td>${r(`<b>${fmt(half)}</b>`)}${r(`<b>${fmt(gst)}</b>`)}</tr>`;
  const taxTotals = inter
    ? `<div class="total-row"><span class="total-label">IGST (18%)</span><span class="total-value">${fmt(gst)}</span></div>`
    : `<div class="total-row"><span class="total-label">CGST (9%)</span><span class="total-value">${fmt(half)}</span></div><div class="total-row"><span class="total-label">SGST (9%)</span><span class="total-value">${fmt(half)}</span></div>`;
  const invDate = day(t.paidAt);
  const no = esc(t.invoiceNumber);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>TAX INVOICE ${no}</title>
<style>
@page { margin: 0; size: A4; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #111; background:#fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page-wrap { margin: 6mm; }
.outer { border: 1.5pt solid #222; }
.title-bar { border-bottom: 1.5pt solid #222; padding: 6px; text-align: center; }
.title-bar h1 { font-size: 14pt; letter-spacing: 2px; color: #111; }
.title-bar p { font-size: 7pt; color: #666; margin-top: 2px; }
.header-row { display: flex; border-bottom: 1pt solid #222; }
.company-block { flex: 1; padding: 10px; border-right: 1pt solid #222; }
.company-block img { height: 46px; margin-bottom: 6px; }
.company-block .cname { font-size: 10pt; font-weight: 700; }
.company-block .cline { font-size: 8pt; color: #333; margin-top: 2px; }
.company-block .cgst { font-size: 8pt; font-weight: 700; margin-top: 4px; }
.meta-block { width: 200px; padding: 10px; }
.meta-row { display: flex; margin-bottom: 5px; }
.meta-label { width: 95px; font-size: 8pt; font-weight: 700; color: #444; }
.meta-value { font-size: 8pt; color: #111; flex: 1; }
.party-row { display: flex; border-bottom: 1pt solid #222; }
.party-block { flex: 1; padding: 10px; }
.party-label { font-size: 7pt; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.party-name { font-size: 11pt; font-weight: 700; color: #111; margin-bottom: 3px; }
.party-line { font-size: 8pt; color: #333; margin-top: 2px; }
table { width: 100%; border-collapse: collapse; }
.table-wrap { border-bottom: 1pt solid #222; }
thead tr { background: #ececec; border-bottom: 1pt solid #222; }
th { padding: 6px 4px; font-size: 7.5pt; font-weight: 700; color: #333; }
td { padding: 7px 4px; font-size: 8pt; color: #111; border-bottom: 0.5pt solid #ddd; }
.col-sno { width: 24px; text-align: center; }
.col-hsn { width: 60px; text-align: center; }
.col-qty { width: 30px; text-align: center; }
.col-unit { width: 32px; text-align: center; }
.col-rate { width: 85px; text-align: right; }
.col-amt { width: 90px; text-align: right; font-weight: 600; }
.empty-row td { height: 20px; border-bottom: 0.5pt solid #ddd; }
.amount-words { display: flex; padding: 6px 10px; border-bottom: 1pt solid #222; background: #f9f9f9; }
.aw-label { font-size: 8pt; font-weight: 700; color: #444; margin-right: 8px; white-space: nowrap; }
.aw-value { font-size: 8pt; color: #111; }
.bottom-section { display: flex; border-bottom: 1pt solid #222; }
.bottom-left { flex: 1; padding: 10px; border-right: 1pt solid #222; }
.section-label { font-size: 7.5pt; font-weight: 700; color: #444; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
.bank-line { font-size: 8pt; color: #111; margin-bottom: 3px; }
.notes-text { font-size: 7.5pt; color: #666; line-height: 1.5; }
.divider-h { border-top: 0.5pt solid #ddd; margin: 8px 0; }
.bottom-right { width: 210px; }
.total-row { display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: 0.5pt solid #ddd; }
.total-label { font-size: 8pt; color: #555; }
.total-value { font-size: 8pt; color: #111; }
.grand-row { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 0.5pt solid #222; background: #f0f0f0; }
.grand-label { font-size: 9pt; font-weight: 700; color: #111; }
.grand-value { font-size: 9pt; font-weight: 700; color: #111; }
.balance-row { display: flex; justify-content: space-between; padding: 6px 10px; background: #f0fdf4; }
.balance-label { font-size: 8pt; font-weight: 700; color: #111; }
.balance-value { font-size: 8pt; font-weight: 700; color: #16a34a; }
.tax-section { border-bottom: 1pt solid #222; }
.tax-section thead tr { background: #ececec; }
.tax-section th, .tax-section td { font-size: 7.5pt; padding: 4px; }
.tax-section tfoot tr { background: #f0f0f0; font-weight: 700; }
.footer-section { display: flex; border-bottom: 1pt solid #222; }
.declaration-block { flex: 1; padding: 10px; border-right: 1pt solid #222; }
.declaration-text { font-size: 7pt; color: #666; line-height: 1.4; margin-top: 3px; }
.signature-block { width: 210px; padding: 10px; display: flex; flex-direction: column; align-items: flex-end; }
.sig-for { font-size: 8pt; color: #555; margin-bottom: 30px; }
.sig-line { width: 155px; border-top: 1pt solid #222; margin-bottom: 4px; }
.sig-name { font-size: 8.5pt; font-weight: 700; color: #111; }
.sig-title { font-size: 7.5pt; color: #666; }
.footer-note { padding: 5px; text-align: center; }
.footer-note p { font-size: 7pt; color: #888; }
</style>
</head>
<body>
<div class="page-wrap">
<div class="outer">

  <div class="title-bar">
    <h1>TAX INVOICE</h1>
    <p>Original for Recipient</p>
  </div>

  <div class="header-row">
    <div class="company-block">
      <img src="${PIXELATE_NEST_LOGO}" alt="Pixelate Nest" />
      <div class="cname">Kalahanu Tech Studios LLP</div>
      <div class="cline">Kala Bhawan, Akharaghat Road, Muzaffarpur, Bihar – 842001</div>
      <div class="cline">Email: support@pixelatenest.com | Phone: +91 84069 12345</div>
      <div class="cline">Website: pixelatenest.com</div>
      <div class="cgst">GSTIN: 10ABFFK0650E1Z2</div>
      <div class="cline">PAN: ABFFK0650E &nbsp;|&nbsp; State: Bihar (Code: 10)</div>
    </div>
    <div class="meta-block">
      <div class="meta-row"><span class="meta-label">Invoice No.</span><span class="meta-value">: ${no}</span></div>
      <div class="meta-row"><span class="meta-label">Invoice Date</span><span class="meta-value">: ${invDate}</span></div>
      <div class="meta-row"><span class="meta-label">Due Date</span><span class="meta-value">: ${invDate}</span></div>
      <div class="meta-row"><span class="meta-label">Place of Service</span><span class="meta-value">: ${esc(company.state || "Bihar")}</span></div>
      <div class="meta-row"><span class="meta-label">Supply Type</span><span class="meta-value">: ${inter ? "Inter-State" : "Intra-State"}</span></div>
      <div class="meta-row"><span class="meta-label">Payment ID</span><span class="meta-value">: ${esc(t.paymentId || "-")}</span></div>
    </div>
  </div>

  <div class="party-row">
    <div class="party-block">
      <div class="party-label">Bill To</div>
      <div class="party-name">${esc(company.name || "-")}</div>
      ${addr ? `<div class="party-line">${addr}</div>` : ""}
      ${company.email ? `<div class="party-line">Email: ${esc(company.email)}</div>` : ""}
      ${company.phone ? `<div class="party-line">Phone: ${esc(company.phone)}</div>` : ""}
      ${company.gstNumber ? `<div class="party-line" style="font-weight:700">GSTIN: ${esc(company.gstNumber)}</div>` : ""}
      ${company.panNumber ? `<div class="party-line">PAN: ${esc(company.panNumber)}</div>` : ""}
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="col-sno">S.No</th>
          <th>Description of Services</th>
          <th class="col-hsn">HSN/SAC</th>
          <th class="col-qty">Qty</th>
          <th class="col-unit">Unit</th>
          <th class="col-rate">Rate (Rs.)</th>
          <th class="col-amt">Amount (Rs.)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="col-sno">1</td>
          <td>WhatsApp Messaging Credits — ${esc(t.credits)} credits (NestHR)</td>
          <td class="col-hsn">${HSN}</td>
          <td class="col-qty">1</td>
          <td class="col-unit">Nos</td>
          <td class="col-rate">${fmt(base)}</td>
          <td class="col-amt">${fmt(base)}</td>
        </tr>
        ${'<tr class="empty-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(5)}
      </tbody>
    </table>
  </div>

  <div class="amount-words">
    <span class="aw-label">Amount in Words:</span>
    <span class="aw-value">${numToWords(Math.round(total))}</span>
  </div>

  <div class="bottom-section">
    <div class="bottom-left">
      <div class="section-label">Bank Details</div>
      <div class="bank-line">Bank Name &nbsp;&nbsp;&nbsp;: HDFC Bank Pvt. Ltd.</div>
      <div class="bank-line">Account No. &nbsp;: 50200119083987</div>
      <div class="bank-line">Account Name : KALAHANU TECH STUDIOS LLP</div>
      <div class="bank-line">IFSC Code &nbsp;&nbsp;&nbsp;: HDFC0000344</div>
      <div class="bank-line">Branch &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: Saraiyaganj, Muzaffarpur, Bihar</div>
      <div class="bank-line">Account Type : Current</div>
      <div class="divider-h"></div>
      <div class="section-label">Terms &amp; Notes</div>
      <div class="notes-text">
        1. Credits are prepaid and non-refundable.<br/>
        2. Quote invoice number in all payment references.<br/>
        3. Unused credits remain in your wallet until consumed.
      </div>
    </div>
    <div class="bottom-right">
      <div class="total-row"><span class="total-label">Subtotal</span><span class="total-value">${fmt(base)}</span></div>
      <div class="total-row"><span class="total-label">Taxable Amount</span><span class="total-value">${fmt(base)}</span></div>
      ${taxTotals}
      <div class="grand-row"><span class="grand-label">Grand Total</span><span class="grand-value">${fmt(total)}</span></div>
      <div class="total-row"><span class="total-label">(−) Amount Paid</span><span class="total-value">${fmt(total)}</span></div>
      <div class="balance-row"><span class="balance-label">Balance Due</span><span class="balance-value">Rs. 0.00</span></div>
    </div>
  </div>

  <div class="tax-section">
    <table>
      <thead>${taxHeader}</thead>
      <tbody>${taxRow}</tbody>
      <tfoot>${taxFoot}</tfoot>
    </table>
  </div>

  <div class="footer-section">
    <div class="declaration-block">
      <div class="section-label">Declaration</div>
      <div class="declaration-text">
        We declare that this invoice shows the actual price of the goods/services described
        and that all particulars are true and correct.<br/>
        All disputes are subject to Muzaffarpur jurisdiction only.
      </div>
    </div>
    <div class="signature-block">
      <div class="sig-for">For Kalahanu Tech Studios LLP</div>
      <div class="sig-line"></div>
      <div class="sig-name">Authorised Signatory</div>
      <div class="sig-title">Labh Chandra Bothra, Co-Founder</div>
    </div>
  </div>

  <div class="footer-note">
    <p>This is a computer-generated invoice and does not require a physical signature.</p>
  </div>

</div>
</div>
</body>
</html>`;
}

module.exports = { creditBillHtml };
