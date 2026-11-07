import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { taxAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { escapeHtml as esc } from "@/lib/escapeHtml";
import { openPrintWindow } from "@/lib/printWindow";
import { cn } from "@/lib/utils";
import { FileText, Printer } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const nowFY = () => {
  const d = new Date();
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
};
const FIELDS: [string, string][] = [
  ["sec80C", "Section 80C (PF, ELSS, LIC, PPF…) - max ₹1,50,000"],
  ["sec80D", "Section 80D (health insurance)"],
  ["hraRentPaid", "Annual rent paid (for HRA)"],
  ["homeLoanInterest", "Home loan interest (max ₹2,00,000)"],
  ["otherDeductions", "Other Chapter VI-A deductions (80G, NPS 80CCD…)"],
];
const STATUS_CLS: Record<string, string> = {
  submitted: "bg-orange-50 border-orange-500 text-orange-800",
  verified: "bg-green-50 border-green-500 text-green-800",
  rejected: "bg-red-50 border-red-500 text-red-800",
};

function printForm16(d: any) {
  const rows = d.months
    .map(
      (m: any) =>
        `<tr><td>${MONTHS[m.month - 1]} ${m.year}</td><td class="r">${fmt(m.gross)}</td><td class="r">${fmt(m.pf)}</td><td class="r">${fmt(m.esi)}</td><td class="r">${fmt(m.tds)}</td></tr>`,
    )
    .join("");
  const fyLabel = `${d.fy}-${String(d.fy + 1).slice(2)}`;
  const html = `<html><head><title>Tax statement FY ${fyLabel}</title><style>
    body{font-family:Arial,sans-serif;padding:32px;color:#000;max-width:800px;margin:auto}
    h1{font-size:20px;margin:0}table{border-collapse:collapse;width:100%;margin:12px 0}
    td,th{border:1px solid #000;padding:6px 8px;font-size:13px;text-align:left}.r{text-align:right}
    .note{font-size:11px;color:#444;margin-top:16px}</style></head><body>
    <h1>Annual Tax Statement (Form 16 Part B format)</h1>
    <p>Financial Year ${fyLabel} · ${d.regime === "old" ? "Old" : "New"} tax regime${d.declarationVerified ? "" : " (no verified declaration - defaults applied)"}</p>
    <table><tr><th>Employer</th><td>${esc(d.company?.name || "")}<br>${esc(d.company?.address || "")}<br>PAN: ${esc(d.company?.panNumber || "-")}</td></tr>
    <tr><th>Employee</th><td>${esc(d.employee.name)} (${esc(d.employee.employeeId || "")})<br>${esc(d.employee.designation || "")}<br>PAN: ${esc(d.employee.pan || "-")}</td></tr></table>
    <table><tr><th>Month</th><th class="r">Gross</th><th class="r">PF</th><th class="r">ESI</th><th class="r">TDS deducted</th></tr>${rows}
    <tr><th>Total</th><th class="r">${fmt(d.totals.gross)}</th><th class="r">${fmt(d.totals.pf)}</th><th class="r">${fmt(d.totals.esi)}</th><th class="r">${fmt(d.totals.tds)}</th></tr></table>
    <table><tr><td>Gross salary</td><td class="r">${fmt(d.totals.gross)}</td></tr>
    <tr><td>Less: standard deduction</td><td class="r">${fmt(d.taxable.standardDeduction)}</td></tr>
    <tr><td>Less: Chapter VI-A deductions</td><td class="r">${fmt(d.taxable.chapterVIA)}</td></tr>
    <tr><td>Less: home loan interest</td><td class="r">${fmt(d.taxable.homeLoanInterest)}</td></tr>
    <tr><th>Taxable income (estimate)</th><th class="r">${fmt(d.taxable.income)}</th></tr>
    <tr><th>Total TDS deducted</th><th class="r">${fmt(d.totals.tds)}</th></tr></table>
    <p class="note">Generated from company payroll records. This is not the TRACES-issued Form 16 (Part A, with TDS deposit challans, comes from the TRACES portal).</p>
    </body></html>`;
  if (!openPrintWindow(html, true)) alert("Allow pop-ups to print the statement.");
}

export default function TaxPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isHR = user?.role === "super_admin" || user?.role === "hr_manager";
  const [fy, setFy] = useState(nowFY());
  const [form, setForm] = useState<any>({ regime: "new", proofNote: "" });
  const [status, setStatus] = useState("");
  const [list, setList] = useState<any[]>([]);
  const err = (e: any) => toast({ title: e.message, variant: "destructive" });

  const load = useCallback(async () => {
    try {
      const r = await taxAPI.getMine(fy);
      setForm(r.data || { regime: "new", proofNote: "" });
      setStatus(r.data?.status || "");
    } catch {
      /* HR accounts without an employee record just see the review list */
    }
    if (isHR) taxAPI.list(fy).then((r) => setList(r.data)).catch(err);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy, isHR]);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      await taxAPI.saveMine(fy, form);
      toast({ title: "Declaration submitted for HR verification" });
      load();
    } catch (e) {
      err(e);
    }
  };
  const review = async (id: string, s: string) => {
    const remark = s === "rejected" ? window.prompt("Reason?") || "" : "";
    if (s === "rejected" && !remark) return;
    try {
      await taxAPI.review(id, s, remark);
      load();
    } catch (e) {
      err(e);
    }
  };
  const form16 = (employee?: string) =>
    taxAPI.form16(fy, employee).then((r) => printForm16(r.data)).catch(err);

  const locked = status === "verified";
  const input = "border-2 border-black px-3 py-2 text-sm w-full";

  return (
    <AppLayout title="Tax & Form 16">
      <div className="w-full mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">
              Tax Declaration & Form 16
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Declare investments, then download your annual tax statement
            </p>
          </div>
          <select
            className="border-2 border-black px-3 py-2 text-sm font-bold"
            value={fy}
            onChange={(e) => setFy(Number(e.target.value))}
          >
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={nowFY() - i}>
                FY {nowFY() - i}-{String(nowFY() - i + 1).slice(2)}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border-2 border-black p-5 mb-6 space-y-3 max-w-2xl">
          <div className="flex justify-between items-center">
            <h2 className="font-bold">My declaration</h2>
            {status && (
              <span
                className={cn(
                  "text-[10px] font-bold uppercase border-2 px-2 py-0.5",
                  STATUS_CLS[status],
                )}
              >
                {status}
              </span>
            )}
          </div>
          {form.remark && (
            <p className="text-xs text-red-700">HR remark: {form.remark}</p>
          )}
          <select
            className={input}
            disabled={locked}
            value={form.regime}
            onChange={(e) => setForm({ ...form, regime: e.target.value })}
          >
            <option value="new">New tax regime (no deductions)</option>
            <option value="old">Old tax regime (with deductions)</option>
          </select>
          {form.regime === "old" &&
            FIELDS.map(([k, label]) => (
              <label key={k} className="block text-xs font-bold text-gray-600">
                {label}
                <input
                  type="number"
                  min={0}
                  disabled={locked}
                  className={cn(input, "mt-1")}
                  value={form[k] ?? ""}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </label>
            ))}
          <textarea
            className={input}
            rows={2}
            maxLength={500}
            disabled={locked}
            placeholder="Proof details for HR (policy numbers, receipts you will hand over…)"
            value={form.proofNote || ""}
            onChange={(e) => setForm({ ...form, proofNote: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              disabled={locked}
              onClick={save}
              className="bg-[#024BAB] text-white px-4 py-2 font-bold border-2 border-black disabled:opacity-40"
            >
              Submit declaration
            </button>
            <button
              onClick={() => form16()}
              className="bg-white px-4 py-2 font-bold border-2 border-black flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Download Form 16 statement
            </button>
          </div>
        </div>

        {isHR && (
          <>
            <h2 className="font-bold text-sm uppercase text-gray-500 mb-2">
              Employee declarations ({list.length})
            </h2>
            {list.length === 0 ? (
              <div className="border-2 border-black bg-white p-8 text-center text-gray-500 font-bold">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                No declarations for this year
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((d) => (
                  <div
                    key={d._id}
                    className="bg-white border-2 border-black px-5 py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-sm">
                        {d.employee?.firstName} {d.employee?.lastName} (
                        {d.employee?.employeeId})
                      </p>
                      <p className="text-xs text-gray-600">
                        {d.regime === "old"
                          ? `Old regime · 80C ${fmt(d.sec80C)} · 80D ${fmt(d.sec80D)} · Rent ${fmt(d.hraRentPaid)} · Home loan ${fmt(d.homeLoanInterest)} · Other ${fmt(d.otherDeductions)}`
                          : "New regime"}
                      </p>
                      {d.proofNote && (
                        <p className="text-xs text-gray-500 mt-1">{d.proofNote}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase border-2 px-2 py-0.5",
                        STATUS_CLS[d.status],
                      )}
                    >
                      {d.status}
                    </span>
                    <div className="flex gap-2">
                      {d.status !== "verified" && (
                        <button
                          onClick={() => review(d._id, "verified")}
                          className="bg-green-600 text-white px-3 py-1 text-xs font-bold border-2 border-black"
                        >
                          Verify
                        </button>
                      )}
                      {d.status === "submitted" && (
                        <button
                          onClick={() => review(d._id, "rejected")}
                          className="px-3 py-1 text-xs font-bold border-2 border-black text-red-700"
                        >
                          Reject
                        </button>
                      )}
                      {d.status === "verified" && (
                        <button
                          onClick={() => review(d._id, "submitted")}
                          className="px-3 py-1 text-xs font-bold border-2 border-black"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        onClick={() => form16(d.employee?._id)}
                        className="px-3 py-1 text-xs font-bold border-2 border-black"
                      >
                        Form 16
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
