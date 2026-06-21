import { NESTHR_LOGO_B64 } from "./nesthrLogoB64";

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
      return `<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;text-transform:uppercase;${style}">${val}</span>`;
    }
  }
  if (isNameCol && val && val !== "—") {
    const initials = getInitials(val);
    const bg = avatarColor(val);
    return `<span style="display:inline-flex;align-items:center;gap:6px;">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${bg};color:#fff;font-size:9px;font-weight:700;flex-shrink:0;">${initials}</span>
      <span>${val}</span>
    </span>`;
  }
  return val;
}

export function buildReportHTML(
  title: string,
  period: string,
  headers: string[],
  rows: string[][],
): string {
  const nameColIdx = headers.findIndex((h) =>
    ["employee", "name", "employee name"].includes(h.toLowerCase()),
  );
  const statusColIdx = headers.findIndex((h) =>
    ["status", "payment status"].includes(h.toLowerCase()),
  );

  const thCells = headers
    .map(
      (h) =>
        `<th style="background:#024BAB;color:#fff;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">${h}</th>`,
    )
    .join("");

  const trRows = rows
    .map(
      (row, ri) =>
        `<tr style="background:${ri % 2 === 0 ? "#fff" : "#F8FAFF"}">
          ${row
            .map((cell, ci) => {
              const html = cellHTML(
                cell,
                ci === nameColIdx,
                ci === statusColIdx,
              );
              return `<td style="padding:7px 10px;border-bottom:1px solid #E5E7EB;font-size:11px;white-space:nowrap;vertical-align:middle;">${html}</td>`;
            })
            .join("")}
        </tr>`,
    )
    .join("");

  const now = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm 12mm 20mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9px;
        color: #6B7280;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 3px solid #024BAB;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .logo { height: 40px; }
    .brand { font-size: 11px; color: #6B7280; line-height: 1.4; }
    .brand b { font-size: 18px; color: #024BAB; display: block; font-weight: 900; }
    .report-meta { text-align: right; }
    .report-title { font-size: 16px; font-weight: 700; color: #024BAB; }
    .report-period { font-size: 11px; color: #6B7280; margin-top: 2px; }
    .report-generated { font-size: 9px; color: #9CA3AF; margin-top: 2px; }
    .stats-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .stat { border-left: 3px solid #024BAB; padding: 4px 10px; }
    .stat-val { font-size: 16px; font-weight: 700; color: #024BAB; }
    .stat-label { font-size: 9px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; }
    table { border-collapse: collapse; width: 100%; table-layout: auto; }
    thead { display: table-header-group; }
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
  <div class="header">
    <div class="header-left">
      <img src="${NESTHR_LOGO_B64}" class="logo" alt="NestHR" />
      <div class="brand">
        <b>NestHR</b>
        Human Resource Management System
      </div>
    </div>
    <div class="report-meta">
      <div class="report-title">${title}</div>
      <div class="report-period">${period}</div>
      <div class="report-generated">Generated: ${now}</div>
    </div>
  </div>

  <div class="stats-bar">
    <div class="stat">
      <div class="stat-val">${rows.length}</div>
      <div class="stat-label">Total Records</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>${thCells}</tr>
    </thead>
    <tbody>${trRows}</tbody>
  </table>

  <div class="footer-bar">
    <span>NestHR — Confidential HR Report</span>
    <span>${title} · ${period}</span>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}
