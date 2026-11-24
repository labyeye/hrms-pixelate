import { escapeHtml as esc } from "./escapeHtml";
import { NESTHR_LOGO_B64 } from "./nesthrLogoB64";

export interface ReportCompany {
  name: string;
  logo?: string; // base64 or URL
  address?: string;
  gstin?: string;
  phone?: string;
  email?: string;
}

// ── Column analysis shared by the PDF and Excel exports ─────────────────────
// Rows arrive as display strings ("₹12,345", "- 500", "9.5h"), so numeric columns are detected from the text.
const MONEY_HEADER =
  /(salary|pay\b|payable|gross|net\b|deduct|amount|\bpf\b|\besi\b|\btds\b|loan|bonus|allowance|penalt|overtime pay|ctc|balance|advance|\bemi\b|basic|\bhra\b|\bda\b|\bta\b|earn|cost|reimburs|expense|recover)/i;
const NOT_MONEY_HEADER = /(days|hours|hrs|rate|%|\bid\b|\bno\.?\b|count|records|number|code|year|month|date|status|mode)/i;

export function parseNum(v: unknown): number | null {
  if (typeof v === "number") return isFinite(v) ? v : null;
  const t = String(v ?? "")
    .replace(/[₹,\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export function analyzeColumns(headers: string[], rows: unknown[][]) {
  const numeric = headers.map((_, ci) => {
    const vals = rows.map((r) => r[ci]).filter((v) => String(v ?? "").trim() !== "" && v !== "—");
    return vals.length > 0 && vals.filter((v) => parseNum(v) !== null).length / vals.length >= 0.9;
  });
  const money = headers.map((h, ci) => numeric[ci] && MONEY_HEADER.test(h) && !NOT_MONEY_HEADER.test(h));
  const sums = headers.map((_, ci) =>
    money[ci] ? rows.reduce((t: number, r) => t + (parseNum(r[ci]) ?? 0), 0) : 0,
  );
  return { numeric, money, sums };
}

export const fmtMoney = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Headline figures for the summary cards: priority headers first, then any other money column.
export function pickSummary(headers: string[], money: boolean[], sums: number[], max = 3) {
  const order = [/^net/i, /gross/i, /total deduct/i, /amount|ctc|balance/i, /\bpf\b/i];
  const picked: number[] = [];
  for (const re of order)
    headers.forEach((h, i) => {
      if (money[i] && re.test(h) && !picked.includes(i) && picked.length < max) picked.push(i);
    });
  headers.forEach((_, i) => {
    if (money[i] && !picked.includes(i) && picked.length < max) picked.push(i);
  });
  return picked.map((i) => ({ label: headers[i], value: fmtMoney(sums[i]) }));
}

const STATUS_STYLES: Record<string, string> = {
  present: "background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;",
  late: "background:#FFF7ED;color:#C2410C;border:1px solid #FED7AA;",
  absent: "background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;",
  "half day": "background:#FEFCE8;color:#A16207;border:1px solid #FDE68A;",
  half_day: "background:#FEFCE8;color:#A16207;border:1px solid #FDE68A;",
  "on leave": "background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;",
  on_leave: "background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;",
  leave: "background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;",
  holiday: "background:#FAF5FF;color:#7C3AED;border:1px solid #DDD6FE;",
  weekend: "background:#F9FAFB;color:#6B7280;border:1px solid #E5E7EB;",
  paid: "background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;",
  pending: "background:#FFF7ED;color:#C2410C;border:1px solid #FED7AA;",
  approved: "background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;",
  rejected: "background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;",
  cancelled: "background:#F9FAFB;color:#6B7280;border:1px solid #E5E7EB;",
  active: "background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;",
  inactive: "background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;",
  terminated: "background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;",
  missing: "background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;",
  neft: "background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;",
};

function getStatusStyle(val: string): string | null {
  const key = val.toLowerCase().trim();
  return STATUS_STYLES[key] ?? null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "#024BAB",
  "#00C48C",
  "#FA731C",
  "#7C3AED",
  "#0891B2",
  "#DC2626",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function cellHTML(
  val: string,
  isNameCol: boolean,
  isStatusCol: boolean,
): string {
  if (isStatusCol) {
    const style = getStatusStyle(val);
    if (style) {
      return `<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;text-transform:uppercase;${style}">${esc(val)}</span>`;
    }
  }
  if (isNameCol && val && val !== "—") {
    const initials = getInitials(val);
    const bg = avatarColor(val);
    return `<span style="display:inline-flex;align-items:center;gap:6px;">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${bg};color:#fff;font-size:9px;font-weight:700;flex-shrink:0;">${esc(initials)}</span>
      <span>${esc(val)}</span>
    </span>`;
  }
  return esc(val);
}

export function buildReportHTML(
  title: string,
  period: string,
  headers: string[],
  rows: string[][],
  opts: {
    company?: ReportCompany;
    reportCategory?: string; // e.g. "Payroll" | "Attendance" | "Employee"
    generatedFor?: string; // employee name or "All Employees"
    generatedBy?: string; // user who ran the report
    filters?: string; // e.g. "Department: Sales · Status: Active"
    summary?: { label: string; value: string }[]; // overrides the auto-detected summary cards
    totals?: boolean; // default true: add a totals row for money columns
    signatures?: boolean; // default true
  } = {},
): string {
  const { company } = opts;
  const reportCategory = esc(opts.reportCategory ?? "");
  const generatedFor = esc(opts.generatedFor ?? "");
  title = esc(title);
  period = esc(period);

  const { numeric, money, sums } = analyzeColumns(headers, rows);
  const nameColIdx = headers.findIndex((h) =>
    ["employee", "name", "employee name"].includes(h.toLowerCase()),
  );
  const statusColIdx = headers.findIndex((h) =>
    ["status", "payment status"].includes(h.toLowerCase()),
  );
  const showTotals = opts.totals !== false && rows.length > 1 && money.some(Boolean);
  const summary = (opts.summary ?? pickSummary(headers, money, sums)).slice(0, 4);
  const wide = headers.length > 7;

  const thCells =
    `<th style="background:#024BAB;color:#fff;padding:8px 8px;text-align:center;font-size:10px;width:34px;">#</th>` +
    headers
      .map(
        (h, ci) =>
          `<th style="background:#024BAB;color:#fff;padding:8px 10px;text-align:${numeric[ci] ? "right" : "left"};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">${esc(h)}</th>`,
      )
      .join("");

  const trRows = rows
    .map(
      (row, ri) =>
        `<tr style="background:${ri % 2 === 0 ? "#fff" : "#F8FAFF"}">
          <td style="padding:7px 8px;border-bottom:1px solid #E5E7EB;font-size:10px;color:#6B7280;text-align:center;">${ri + 1}</td>
          ${row
            .map((cell, ci) => {
              const html = cellHTML(
                cell,
                ci === nameColIdx,
                ci === statusColIdx,
              );
              return `<td style="padding:7px 10px;border-bottom:1px solid #E5E7EB;font-size:11px;white-space:nowrap;vertical-align:middle;text-align:${numeric[ci] ? "right" : "left"};${numeric[ci] ? "font-variant-numeric:tabular-nums;" : ""}">${html}</td>`;
            })
            .join("")}
        </tr>`,
    )
    .join("");

  const totalsRow = showTotals
    ? `<tr style="background:#EFF6FF;font-weight:700;">
        <td style="padding:8px;border-top:2px solid #024BAB;"></td>
        ${headers
          .map((_, ci) => {
            const first = ci === 0;
            const cell = money[ci] ? fmtMoney(sums[ci]) : first ? "TOTAL" : "";
            return `<td style="padding:8px 10px;border-top:2px solid #024BAB;font-size:11px;text-align:${numeric[ci] ? "right" : "left"};">${esc(cell)}</td>`;
          })
          .join("")}
      </tr>`
    : "";

  const summaryCards = [
    { label: "Total Records", value: String(rows.length) },
    ...summary,
  ]
    .map(
      (c) =>
        `<div class="stat"><div class="stat-val">${esc(c.value)}</div><div class="stat-label">${esc(c.label)}</div></div>`,
    )
    .join("");

  const now = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const companyLogo = esc(company?.logo || NESTHR_LOGO_B64);
  const companyName = esc(company?.name || "NestHR");

  const categoryBadge = reportCategory
    ? `<span style="display:inline-block;background:#EFF6FF;color:#024BAB;border:1px solid #BFDBFE;border-radius:3px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:2px 7px;margin-bottom:4px;">${reportCategory}</span>`
    : "";

  const companyMeta = [company?.address, company?.gstin && `GSTIN: ${company.gstin}`, company?.phone, company?.email]
    .filter(Boolean)
    .map((x) => esc(String(x)))
    .join(" &nbsp;·&nbsp; ");
  const companyMetaHtml = companyMeta
    ? `<div class="company-meta">${companyMeta}</div>`
    : "";
  const generatedByLine = opts.generatedBy
    ? `<span><b>Generated by:</b> ${esc(opts.generatedBy)}</span>`
    : "";
  const filtersLine = opts.filters
    ? `<span><b>Filters:</b> ${esc(opts.filters)}</span>`
    : "";
  const signatureBlock =
    opts.signatures === false
      ? ""
      : `<div class="sign-row">${["Prepared By", "Checked By (HR)", "Authorised Signatory"]
          .map((l) => `<div class="sign"><div class="sign-line"></div>${l}</div>`)
          .join("")}</div>`;

  const generatedForLine = generatedFor
    ? `<div style="font-size:10px;color:#6B7280;margin-top:3px;">Employee: <b style="color:#111;">${generatedFor}</b></div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page {
      size: A4 ${wide ? "landscape" : "portrait"};
      margin: 15mm 12mm 22mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9px;
        color: #6B7280;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 12px; color: #111; }

    /* ── Print header ── */
    .report-header {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 3px solid #024BAB;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    /* Left: company logo + name */
    .header-company {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .header-company img {
      height: 44px;
      width: auto;
      object-fit: contain;
      flex-shrink: 0;
    }
    .company-name {
      font-size: 17px;
      font-weight: 700;
      color: #024BAB;
      line-height: 1.2;
    }
    .company-sub {
      font-size: 9px;
      color: #9CA3AF;
      margin-top: 2px;
    }
    /* Center: report type + name */
    .header-center {
      flex: 1;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .report-type-badge {
      margin-bottom: 3px;
    }
    .report-title {
      font-size: 15px;
      font-weight: 700;
      color: #111;
      line-height: 1.3;
    }
    .report-period {
      font-size: 11px;
      color: #6B7280;
      margin-top: 3px;
    }
    /* Right: generated date + for whom */
    .header-right {
      text-align: right;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 160px;
    }
    .generated-label {
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #9CA3AF;
      margin-bottom: 2px;
    }
    .generated-date {
      font-size: 11px;
      font-weight: 700;
      color: #111;
    }
    .generated-for {
      font-size: 10px;
      color: #6B7280;
      margin-top: 3px;
    }
    .generated-for b { color: #111; }

    /* ── Stats bar ── */
    .stats-bar { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .stat { border-left: 3px solid #024BAB; padding: 4px 10px; }
    .stat-val { font-size: 16px; font-weight: 700; color: #024BAB; }
    .stat-label { font-size: 9px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; }

    .company-meta { font-size: 9px; color: #6B7280; margin: -6px 0 8px; }
    .meta-strip { display: flex; flex-wrap: wrap; gap: 6px 22px; font-size: 10px; color: #374151; background: #F8FAFF; border: 1px solid #E5E7EB; border-left: 3px solid #024BAB; padding: 6px 10px; margin-bottom: 10px; }
    .meta-strip b { color: #111; }
    .sign-row { display: flex; justify-content: space-between; gap: 40px; margin-top: 46px; page-break-inside: avoid; }
    .sign { flex: 1; text-align: center; font-size: 10px; color: #374151; }
    .sign-line { border-top: 1px solid #111; margin-bottom: 4px; }
    /* ── Table ── */
    table { border-collapse: collapse; width: 100%; table-layout: auto; }
    thead { display: table-header-group; }

    /* ── Footer (non-print only; page numbers via @page) ── */
    .footer-bar {
      margin-top: 14px;
      border-top: 1px solid #E5E7EB;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #9CA3AF;
    }
    @media print {
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <!-- Left: Company -->
    <div class="header-company">
      <img src="${companyLogo}" alt="${companyName}" />
      <div>
        <div class="company-name">${companyName}</div>
        <div class="company-sub">Human Resource Management System</div>
      </div>
    </div>

    <!-- Center: Report type + name -->
    <div class="header-center">
      ${categoryBadge}
      <div class="report-title">${title}</div>
      <div class="report-period">${period}</div>
    </div>

    <!-- Right: Generated date + for whom -->
    <div class="header-right">
      <div class="generated-label">Report Generated</div>
      <div class="generated-date">${now}</div>
      ${generatedFor ? `<div class="generated-for">For: <b>${generatedFor}</b></div>` : ""}
    </div>
  </div>

  ${companyMetaHtml}
  <div class="meta-strip">
    <span><b>Report:</b> ${title}</span>
    <span><b>Period:</b> ${period}</span>
    ${generatedByLine}
    ${filtersLine}
  </div>

  <div class="stats-bar">${summaryCards}</div>

  <table>
    <thead>
      <tr>${thCells}</tr>
    </thead>
    <tbody>${trRows}${totalsRow}</tbody>
  </table>

  ${signatureBlock}

  <div class="footer-bar">
    <span>${companyName} — Confidential HR Report · System-generated, no signature required unless stated</span>
    <span>${title} · ${period}</span>
  </div>

</body>
</html>`;
}
