import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { employeeAPI, promotionAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { EmployeeCombobox } from "@/components/employees/EmployeeCombobox";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import {
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Plus,
  Search,
  X,
  Loader2,
} from "lucide-react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type ReportRow = {
  employeeId: string;
  code: string;
  name: string;
  department: string;
  designation: string;
  previousDesignation?: string;
  openingSalary: number;
  closingSalary: number;
  change: number;
  changePct: number;
  status: "increased" | "decreased" | "no_change";
  reasons: string[];
  lastChangeDate: string | null;
};
type Report = {
  summary: {
    employees: number;
    increased: number;
    noChange: number;
    decreased: number;
    promotions: number;
    totalIncrease: number;
    avgIncreasePct: number;
    monthlyPayrollBefore: number;
    monthlyPayrollAfter: number;
  };
  rows: ReportRow[];
};
type Revision = {
  _id: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    department?: { name: string };
  };
  effectiveDate: string;
  previousSalary: number;
  newSalary: number;
  changeAmount: number;
  changePct: number;
  kind: "promotion" | "increment" | "decrease";
  reason: string;
  previousDesignation?: string;
  newDesignation?: string;
  remarks?: string;
  createdByName?: string;
};

const todayStr = () => new Date().toISOString().split("T")[0];
const EMPTY_FORM = {
  employee: "",
  newSalary: "",
  reason: "",
  designation: "",
  remarks: "",
  effectiveDate: todayStr(),
};

export default function PromotionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "hr_manager";

  const now = new Date();
  const [tab, setTab] = useState<"report" | "history">("report");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [search, setSearch] = useState("");

  const [employees, setEmployees] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, h] = await Promise.all([
        promotionAPI.getReport({ month: String(month), year: String(year) }),
        promotionAPI.getAll(),
      ]);
      if (r?.success) setReport(r.data);
      if (h?.success) setHistory(h.data);
    } catch (e: any) {
      toast({
        title: "Could not load",
        description: e.message,
        variant: "destructive",
      });
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  useEffect(() => {
    if (!isAdmin) return;
    employeeAPI
      .getAll({ status: "active", limit: "5000" })
      .then((r: any) => r?.success && setEmployees(r.data))
      .catch(() => {});
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const selectedEmp = employees.find((e) => e._id === form.employee);
  const currentSalary = Number(selectedEmp?.salary) || 0;
  const newSalaryNum = Number(form.newSalary);
  const delta =
    form.newSalary !== "" && !isNaN(newSalaryNum) ? newSalaryNum - currentSalary : null;
  const deltaPct =
    delta !== null && currentSalary > 0 ? (delta / currentSalary) * 100 : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await promotionAPI.create({
        employee: form.employee,
        newSalary: Number(form.newSalary),
        reason: form.reason,
        designation: form.designation || undefined,
        remarks: form.remarks || undefined,
        effectiveDate: form.effectiveDate,
      });
      toast({
        title: "Saved",
        description: `${selectedEmp?.firstName || "Employee"}'s salary was updated and the employee was notified.`,
      });
      setModal(false);
      setForm(EMPTY_FORM);
      // Employee list holds the old salary now; refresh it along with the report.
      employeeAPI
        .getAll({ status: "active", limit: "5000" })
        .then((r: any) => r?.success && setEmployees(r.data))
        .catch(() => {});
      load();
    } catch (err: any) {
      toast({
        title: "Could not save",
        description: err.message,
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const q = search.trim().toLowerCase();
  const allRows = report?.rows || [];
  const rows = allRows.filter(
    (r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!deptFilter || (r.department || "No department") === deptFilter) &&
      (!q || r.name.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q)),
  );
  // Department-wise: how many people, how many got a raise, and how much it adds up to.
  const deptStats = Object.values(
    allRows.reduce<
      Record<
        string,
        { name: string; employees: number; raised: number; total: number; pctSum: number }
      >
    >((acc, r) => {
      const name = r.department || "No department";
      const d = (acc[name] ||= { name, employees: 0, raised: 0, total: 0, pctSum: 0 });
      d.employees += 1;
      if (r.status === "increased") {
        d.raised += 1;
        d.total += r.change;
        d.pctSum += r.changePct;
      }
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total || b.raised - a.raised || a.name.localeCompare(b.name));
  const s = report?.summary;

  const reportCols = [
    { header: "Emp Code", value: (r: ReportRow) => r.code },
    { header: "Employee", value: (r: ReportRow) => r.name },
    { header: "Department", value: (r: ReportRow) => r.department },
    {
      header: "Designation",
      value: (r: ReportRow) =>
        r.previousDesignation
          ? `${r.previousDesignation} → ${r.designation}`
          : r.designation,
    },
    { header: "Opening Salary", value: (r: ReportRow) => r.openingSalary },
    { header: "Closing Salary", value: (r: ReportRow) => r.closingSalary },
    { header: "Change", value: (r: ReportRow) => r.change },
    { header: "Change %", value: (r: ReportRow) => r.changePct },
    {
      header: "Status",
      value: (r: ReportRow) =>
        r.status === "increased"
          ? "Increased"
          : r.status === "decreased"
            ? "Decreased"
            : "No change",
    },
    { header: "Reason", value: (r: ReportRow) => r.reasons.join("; ") },
  ];

  const field =
    "w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none focus:border-[#024BAB]";
  const label =
    "block text-xs font-bold uppercase tracking-wider text-black mb-1";

  return (
    <AppLayout title="Promotions">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="inline-flex border-2 border-black bg-white">
          {(
            [
              ["report", "Monthly report"],
              ["history", "All revisions"],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "px-4 py-2 text-sm font-bold border-r-2 border-black last:border-r-0 transition-colors",
                tab === id
                  ? "bg-[#024BAB] text-white"
                  : "bg-white hover:bg-[#024BAB]/5",
              )}
            >
              {text}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setModal(true);
          }}
          className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New revision
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : tab === "report" ? (
        <>
          {/* Summary */}
          <div className="nb-rise border-2 border-black bg-white p-5 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="text-sm font-bold text-black">
                {MONTHS[month - 1]} {year}
                <span className="text-muted-foreground font-medium">
                  {" "}
                  · {s?.employees ?? 0} employees
                </span>
              </p>
              {s && s.monthlyPayrollAfter !== s.monthlyPayrollBefore && (
                <p className="text-xs font-bold text-muted-foreground">
                  Monthly salary bill {formatCurrency(s.monthlyPayrollBefore)} →{" "}
                  <span className="text-black">
                    {formatCurrency(s.monthlyPayrollAfter)}
                  </span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Got a raise",
                  node: <AnimatedNumber value={s?.increased ?? 0} />,
                  color: "#00C48C",
                  sub: s?.promotions ? `${s.promotions} promoted` : "",
                },
                {
                  label: "No change",
                  node: <AnimatedNumber value={s?.noChange ?? 0} />,
                  color: "#6B7280",
                  sub: s?.decreased ? `${s.decreased} decreased` : "",
                },
                {
                  label: "Total raise",
                  node: (
                    <AnimatedNumber
                      value={Math.round(s?.totalIncrease ?? 0)}
                      prefix="₹"
                    />
                  ),
                  color: "#024BAB",
                  sub: "per month",
                },
                {
                  label: "Average raise",
                  node: (
                    <span>
                      {s?.avgIncreasePct ?? 0}
                      <span className="text-xl">%</span>
                    </span>
                  ),
                  color: "#A855F7",
                  sub: "of those who got one",
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className="border-l-4 pl-3"
                  style={{ borderColor: k.color }}
                >
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums leading-none">
                    {k.node}
                  </p>
                  <p className="text-xs font-bold text-black mt-1.5">{k.label}</p>
                  {k.sub && (
                    <p className="text-[11px] text-muted-foreground">{k.sub}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Department-wise */}
          {deptStats.length > 0 && (
            <div className="nb-rise border-2 border-black bg-white mb-3 overflow-auto">
              <div className="px-4 py-2.5 bg-[#024BAB]/5 border-b-2 border-black">
                <p className="text-xs font-bold uppercase tracking-wider text-black">
                  By department
                </p>
              </div>
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-black/20">
                    {["Department", "People", "Got a raise", "Total raise", "Avg raise"].map(
                      (h, i) => (
                        <th
                          key={h}
                          className={cn(
                            "px-4 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider",
                            i === 0 ? "text-left" : i === 2 ? "text-left" : "text-right",
                          )}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {deptStats.map((d) => {
                    const share = d.employees ? Math.round((d.raised / d.employees) * 100) : 0;
                    const active = deptFilter === d.name;
                    return (
                      <tr
                        key={d.name}
                        onClick={() => setDeptFilter(active ? "" : d.name)}
                        title="Click to show only this department"
                        className={cn(
                          "border-b border-black/10 cursor-pointer hover:bg-[#024BAB]/5",
                          active && "bg-[#024BAB]/10",
                        )}
                      >
                        <td className="px-4 py-2 text-xs font-bold">{d.name}</td>
                        <td className="px-4 py-2 text-xs text-right tabular-nums">
                          {d.employees}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-24 border border-black bg-gray-100">
                              <div
                                className="h-full bg-[#00C48C] transition-all duration-700"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <span className="tabular-nums font-bold">
                              {d.raised}/{d.employees}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-right font-bold tabular-nums text-[#00A36C]">
                          {d.total > 0 ? formatCurrency(d.total) : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-right tabular-nums">
                          {d.raised ? `${(d.pctSum / d.raised).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ),
              )}
            </select>
            <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
              <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-full font-medium"
              />
              {search && (
                <button onClick={() => setSearch("")}>
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
            >
              <option value="">All employees</option>
              <option value="increased">Got a raise</option>
              <option value="no_change">No change</option>
              <option value="decreased">Decreased</option>
            </select>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
            >
              <option value="">All departments</option>
              {deptStats.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
            <ExportMenu
              name={`salary_report_${year}_${String(month).padStart(2, "0")}`}
              rows={rows}
              cols={reportCols}
            />
          </div>

          {/* Table */}
          {rows.length === 0 ? (
            <div className="border-2 bg-white p-12 text-center">
              <Award className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-bold text-black">No employees to show</p>
            </div>
          ) : (
            <div className="border-2 bg-white overflow-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead>
                  <tr className="border-b-2 border-black bg-[#024BAB]/5">
                    {[
                      ["Employee", ""],
                      ["Department", ""],
                      ["Designation", ""],
                      ["Opening", "text-right"],
                      ["Closing", "text-right"],
                      ["Change", "text-right"],
                      ["Reason", ""],
                    ].map(([h, c]) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-3 text-xs font-bold text-black uppercase tracking-wider text-left",
                          c,
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.employeeId}
                      className="border-b border-black/10 hover:bg-[#024BAB]/5"
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold text-black text-xs whitespace-nowrap">
                          {r.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {r.code}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs">{r.department || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {r.previousDesignation ? (
                          <span>
                            <span className="text-muted-foreground line-through">
                              {r.previousDesignation}
                            </span>{" "}
                            → <b>{r.designation}</b>
                          </span>
                        ) : (
                          r.designation
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums">
                        {formatCurrency(r.openingSalary)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-bold tabular-nums">
                        {formatCurrency(r.closingSalary)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {r.status === "no_change" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Minus className="w-3.5 h-3.5" /> No change
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-xs font-bold tabular-nums",
                              r.status === "increased"
                                ? "text-[#00A36C]"
                                : "text-[#EF4444]",
                            )}
                          >
                            {r.status === "increased" ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                            {formatCurrency(Math.abs(r.change))} ({r.changePct > 0 ? "+" : ""}
                            {r.changePct}%)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[260px]">
                        {r.reasons.length ? r.reasons.join("; ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : history.length === 0 ? (
        <div className="border-2 bg-white p-12 text-center">
          <Award className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-bold text-black">No salary revisions yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Use “New revision” to record a raise or promotion.
          </p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {["Date", "Employee", "Salary", "Change", "Designation", "Reason", "Remarks", "By"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-bold text-black uppercase tracking-wider text-left"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr
                  key={h._id}
                  className="border-b border-black/10 hover:bg-[#024BAB]/5 align-top"
                >
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {formatDate(h.effectiveDate)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-xs whitespace-nowrap">
                      {h.employee?.firstName} {h.employee?.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {h.employee?.employeeId}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap tabular-nums">
                    {formatCurrency(h.previousSalary)} →{" "}
                    <b>{formatCurrency(h.newSalary)}</b>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-xs font-bold whitespace-nowrap tabular-nums",
                      h.changeAmount >= 0 ? "text-[#00A36C]" : "text-[#EF4444]",
                    )}
                  >
                    {h.changeAmount >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(h.changeAmount))} ({h.changePct > 0 ? "+" : ""}
                    {h.changePct}%)
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {h.newDesignation ? (
                      <span>
                        <span className="text-muted-foreground line-through">
                          {h.previousDesignation}
                        </span>{" "}
                        → <b>{h.newDesignation}</b>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[220px]">{h.reason}</td>
                  <td className="px-4 py-3 text-xs max-w-[200px] text-muted-foreground">
                    {h.remarks || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {h.createdByName || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New revision modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={submit}
            className="border-2 border-black bg-white w-full max-w-md max-h-[92vh] overflow-auto"
          >
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-[#024BAB]" /> New salary revision
              </h3>
              <button type="button" onClick={() => setModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={label}>Employee *</label>
                <EmployeeCombobox
                  employees={employees}
                  value={form.employee}
                  onChange={(id) => setForm({ ...form, employee: id })}
                />
                {selectedEmp && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Now: <b>{formatCurrency(currentSalary)}</b>
                    {selectedEmp.designation ? ` · ${selectedEmp.designation}` : ""}
                  </p>
                )}
              </div>
              <div>
                <label className={label}>New salary (₹ / month) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={form.newSalary}
                  onChange={(e) => setForm({ ...form, newSalary: e.target.value })}
                  className={field}
                  placeholder="e.g. 35000"
                />
                {delta !== null && selectedEmp && (
                  <p
                    className={cn(
                      "text-xs font-bold mt-1.5",
                      delta > 0
                        ? "text-[#00A36C]"
                        : delta < 0
                          ? "text-[#EF4444]"
                          : "text-muted-foreground",
                    )}
                  >
                    {delta === 0
                      ? "Same as current salary"
                      : `${delta > 0 ? "+" : "−"}${formatCurrency(Math.abs(delta))}${
                          deltaPct !== null
                            ? ` (${delta > 0 ? "+" : ""}${deltaPct.toFixed(1)}%)`
                            : ""
                        }`}
                  </p>
                )}
              </div>
              <div>
                <label className={label}>Reason *</label>
                <input
                  type="text"
                  required
                  maxLength={300}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className={field}
                  placeholder="e.g. Annual appraisal, Promoted to Team Lead"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  The employee can see this reason in their profile.
                </p>
              </div>
              <div>
                <label className={label}>New designation (optional)</label>
                <input
                  type="text"
                  value={form.designation}
                  onChange={(e) =>
                    setForm({ ...form, designation: e.target.value })
                  }
                  className={field}
                  placeholder={selectedEmp?.designation || "Leave empty if unchanged"}
                />
              </div>
              <div>
                <label className={label}>Remarks (optional, internal)</label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className={field}
                  placeholder="Only admin and HR can see this"
                />
              </div>
              <div>
                <label className={label}>Effective from</label>
                <input
                  type="date"
                  max={todayStr()}
                  value={form.effectiveDate}
                  onChange={(e) =>
                    setForm({ ...form, effectiveDate: e.target.value })
                  }
                  className={field}
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button
                type="submit"
                disabled={saving || !form.employee}
                className="flex-1 bg-[#024BAB] text-white border-2 border-black py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save revision"}
              </button>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="flex-1 border-2 border-black py-2.5 text-sm font-bold bg-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </AppLayout>
  );
}
