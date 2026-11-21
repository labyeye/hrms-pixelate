import { escapeHtml as esc } from "./escapeHtml";
import { NESTHR_LOGO_B64 } from "./nesthrLogoB64";

export interface MobilePunch {
  employeeCode: string;
  employeeName: string;
  date: string;
  time: string;
  type: "IN" | "OUT";
  selfie: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  address: string | null;
}

const TZ = "Asia/Kolkata";
export const fmtPunchDate = (iso: string) =>
  new Date(iso)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ })
    .replace(/\//g, "-");
export const fmtPunchTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour12: false, timeZone: TZ });

// Selfie URLs come from our own API; only http(s) is allowed so nothing odd lands in an <img src>.
const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? esc(u) : "");

/** "Mobile Daily Attendance Details" — one row per punch with selfie, address and coordinates. */
export function buildMobileAttendanceHTML(
  punches: MobilePunch[],
  opts: { period: string; companyName?: string; forEmployee?: string },
): string {
  const rows = punches
    .map((p, i) => {
      const img = safeUrl(p.selfie);
      return `<tr>
      <td>${i + 1}</td>
      <td>${esc(p.employeeCode)}</td>
      <td class="nm">${esc(p.employeeName)}</td>
      <td>${fmtPunchDate(p.date)}</td>
      <td>${fmtPunchTime(p.time)}<br/><span class="tag ${p.type === "IN" ? "in" : "out"}">${p.type}</span></td>
      <td class="loc">${p.address ? esc(p.address) + "<br/>" : ""}Lat : ${p.lat.toFixed(6)}<br/>Lng : ${p.lng.toFixed(6)}${p.accuracy != null ? `<br/><span class="acc">GPS ±${Math.round(p.accuracy)}m</span>` : ""}</td>
      <td>${img ? `<img src="${img}" class="ph"/>` : "—"}</td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Mobile Daily Attendance Details</title>
<style>
@page{size:A4 portrait;margin:12mm 10mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#111}
.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #024BAB;padding-bottom:8px;margin-bottom:10px}
.hdr img{height:34px}.t{font-size:15px;font-weight:700;color:#024BAB;text-align:right}
.s{font-size:10px;color:#6B7280;text-align:right;margin-top:2px}
table{border-collapse:collapse;width:100%}
th{background:#024BAB;color:#fff;text-align:left;padding:7px 8px;font-size:10px;text-transform:uppercase}
td{padding:7px 8px;border-bottom:1px solid #E5E7EB;vertical-align:middle;font-size:10.5px}
thead{display:table-header-group}tr{page-break-inside:avoid}
.nm{font-weight:700}.loc{line-height:1.45;width:34%}.acc{color:#9CA3AF}
.ph{width:56px;height:60px;object-fit:cover;border-radius:3px;border:1px solid #D1D5DB}
.tag{display:inline-block;margin-top:2px;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700}
.in{background:#DCFCE7;color:#15803D}.out{background:#FEE2E2;color:#B91C1C}
.f{margin-top:10px;font-size:9px;color:#9CA3AF;display:flex;justify-content:space-between}
</style></head><body>
<div class="hdr"><img src="${NESTHR_LOGO_B64}" alt="NestHR"/>
<div><div class="t">Mobile Daily Attendance Details</div>
<div class="s">${esc(opts.forEmployee || "All Employees")} · ${esc(opts.period)}${opts.companyName ? " · " + esc(opts.companyName) : ""}</div></div></div>
<table><thead><tr><th>S.No.</th><th>Emp Code</th><th>Emp Name</th><th>Date</th><th>Time</th><th>Actual Location</th><th>Photo</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="f"><span>NestHR — Confidential HR Report</span><span>${punches.length} punch${punches.length === 1 ? "" : "es"}</span></div>
</body></html>`;
}
