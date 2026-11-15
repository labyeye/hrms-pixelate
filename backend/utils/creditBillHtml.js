// Printable GST tax invoice for a WhatsApp-credit top-up. One source for the owner download and the CRM download.
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const inr = (n) =>
  "Rs. " +
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

/** t = CreditTopup (lean), company = Company (lean). Stored price/gst are what the customer was actually charged. */
function creditBillHtml(t, company = {}) {
  const inter = !!String(company.state || "").trim() && !/bihar/i.test(company.state);
  const half = t.gst / 2;
  const tax = inter
    ? `<tr><td>IGST (18%)</td><td class="r">${inr(t.gst)}</td></tr>`
    : `<tr><td>CGST (9%)</td><td class="r">${inr(half)}</td></tr><tr><td>SGST (9%)</td><td class="r">${inr(half)}</td></tr>`;
  const addr = [company.address, company.city, company.state, company.pincode].filter(Boolean).map(esc).join(", ");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>TAX INVOICE ${esc(t.invoiceNumber)}</title>
<style>
@page{margin:0;size:A4}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.w{margin:10mm;border:1.5pt solid #222}.h{padding:8px;text-align:center;border-bottom:1.5pt solid #222;font-size:14pt;font-weight:700;letter-spacing:2px}
.row{display:flex;border-bottom:1pt solid #222}.c{flex:1;padding:10px;line-height:1.5}.c+.c{border-left:1pt solid #222}
table{width:100%;border-collapse:collapse}th{background:#ececec;text-align:left}th,td{padding:6px 8px;border-bottom:.5pt solid #ddd}.r{text-align:right}
.g td{font-weight:700;background:#f0f0f0}.n{padding:10px;font-size:7.5pt;color:#666;text-align:center}
</style></head><body><div class="w">
<div class="h">TAX INVOICE</div>
<div class="row"><div class="c"><b>Kalahanu Tech Studios LLP</b><br/>Kala Bhawan, Akharaghat Road, Muzaffarpur, Bihar - 842001<br/>support@pixelatenest.com | pixelatenest.com<br/><b>GSTIN: 10ABFFK0650E1Z2</b> | PAN: ABFFK0650E</div>
<div class="c">Invoice No.: <b>${esc(t.invoiceNumber)}</b><br/>Date: ${day(t.paidAt)}<br/>Payment ID: ${esc(t.paymentId || "-")}<br/>Supply: ${inter ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"}</div></div>
<div class="row"><div class="c"><small>BILL TO</small><br/><b>${esc(company.name || "-")}</b>${addr ? `<br/>${addr}` : ""}${company.email ? `<br/>${esc(company.email)}` : ""}${company.phone ? `<br/>${esc(company.phone)}` : ""}${company.gstNumber ? `<br/><b>GSTIN: ${esc(company.gstNumber)}</b>` : ""}</div></div>
<table><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="r">Amount</th></tr>
<tr><td>1</td><td>WhatsApp messaging credits - ${esc(t.credits)} credits (NestHR)</td><td>998314</td><td class="r">${inr(t.price)}</td></tr></table>
<div class="row" style="justify-content:flex-end;border-top:1pt solid #222"><table style="width:45%"><tr><td>Taxable value</td><td class="r">${inr(t.price)}</td></tr>${tax}<tr class="g"><td>Grand Total (paid)</td><td class="r">${inr(t.total)}</td></tr><tr><td>Balance due</td><td class="r">Rs. 0.00</td></tr></table></div>
<div class="n">Credits are prepaid and non-refundable. This is a computer-generated invoice and does not require a signature. Disputes subject to Muzaffarpur jurisdiction.</div>
</div></body></html>`;
}

module.exports = { creditBillHtml };
