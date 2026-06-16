import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { payrollAPI, employeeAPI } from "@/services/api";
import { Payroll } from "@/types/hrms";
import { cn, formatCurrency } from "@/lib/utils";
import {
  IndianRupee,
  Play,
  CheckCircle,
  X,
  Printer,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { ActionModal } from "@/components/ui/ActionModal";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
  processed: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB] px-2 py-0.5",
  paid: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
};

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

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processModal, setProcessModal] = useState(false);
  const [processMode, setProcessMode] = useState<"all" | "select">("all");
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(
    new Set(),
  );
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<
    "employee" | "net" | "gross" | "deductions"
  >("employee");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payrollAPI.getAll({
        month: String(month),
        year: String(year),
        limit: "200",
      });
      if (res.success) setPayrolls(res.data);
    } catch {}
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const handleProcess = async (force = false) => {
    setProcessing(true);
    try {
      const selectedIds =
        processMode === "all" ? undefined : Array.from(selectedEmployees);
      const res = await payrollAPI.process({
        month,
        year,
        employeeIds: selectedIds,
        force,
      });
      setActionModal({
        show: true,
        type: "success",
        title: "Payroll Processed",
        message: res.message || "Payroll processed successfully.",
      });
      setTimeout(() => {
        setProcessModal(false);
        setSelectedEmployees(new Set());
        setProcessMode("all");
        load();
      }, 500);
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to process payroll",
      });
    }
    setProcessing(false);
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  const toggleAllEmployees = () => {
    if (selectedEmployees.size === activeEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(activeEmployees.map((e) => e._id)));
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await payrollAPI.markPaid(id);
      load();
    } catch {}
  };

  const totalGross = payrolls.reduce((s, p) => s + p.grossSalary, 0);
  const totalNet = payrolls.reduce((s, p) => s + p.netSalary, 0);
  const totalDed = payrolls.reduce((s, p) => s + p.totalDeductions, 0);
  const paidCount = payrolls.filter((p) => p.status === "paid").length;

  const displayedPayrolls = [...payrolls]
    .filter((p) => {
      const name =
        `${(p.employee as any)?.firstName ?? ""} ${(p.employee as any)?.lastName ?? ""}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "employee") {
        const na = `${(a.employee as any)?.firstName ?? ""}${(a.employee as any)?.lastName ?? ""}`;
        const nb = `${(b.employee as any)?.firstName ?? ""}${(b.employee as any)?.lastName ?? ""}`;
        cmp = na.localeCompare(nb);
      } else if (sortKey === "net") cmp = a.netSalary - b.netSalary;
      else if (sortKey === "gross") cmp = a.grossSalary - b.grossSalary;
      else if (sortKey === "deductions")
        cmp = a.totalDeductions - b.totalDeductions;
      return sortDir === "asc" ? cmp : -cmp;
    });

  return (
    <AppLayout title="Payroll">
      {}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white"
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
            className="border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white"
          >
            {Array.from(
              { length: 5 },
              (_, i) => new Date().getFullYear() - 2 + i,
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (
                !confirm(
                  `Mark all processed payrolls as PAID for ${MONTHS[month - 1]} ${year}?`,
                )
              )
                return;
              try {
                await payrollAPI.bulkMarkPaid(month, year);
                load();
              } catch (err: any) {
                alert(err.message);
              }
            }}
            disabled={
              payrolls.filter((p) => p.status === "processed").length === 0
            }
            className="border-2 bg-[#00C48C] text-white px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <CheckCircle className="w-4 h-4" /> Bulk Mark Paid
          </button>
          <button
            onClick={() => {
              if (payrolls.length === 0) {
                alert("No payroll records to print.");
                return;
              }
              const win = window.open("", "_blank");
              if (!win) return;
              const rows = payrolls
                .map(
                  (p) =>
                    `<tr><td>${(p.employee as any)?.firstName} ${(p.employee as any)?.lastName}</td><td>${(p.employee as any)?.designation}</td><td>₹${p.basicSalary.toLocaleString()}</td><td>₹${p.grossSalary.toLocaleString()}</td><td>-₹${p.totalDeductions.toLocaleString()}</td><td>₹${p.netSalary.toLocaleString()}</td><td>${p.status}</td></tr>`,
                )
                .join("");
              win.document.write(
                `<html><head><title>Salary Slips ${MONTHS[month - 1]} ${year}</title><style>body{font-family:sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px}th{background:#f0f6ff}</style></head><body><h2>Payroll — ${MONTHS[month - 1]} ${year}</h2><table><thead><tr><th>Employee</th><th>Designation</th><th>Basic</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`,
              );
              win.document.close();
              win.print();
            }}
            className="bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 border-2 border-black"
          >
            <Printer className="w-4 h-4" /> Bulk Slips
          </button>
          <button
            onClick={() => {
              setProcessModal(true);
              employeeAPI
                .getAll({ status: "active" })
                .then((res) => {
                  if (res.success) setActiveEmployees(res.data);
                })
                .catch(() => {});
            }}
            className="border-2 bg-[#FA731C] text-white px-4 py-2 text-sm flex items-center gap-1.5"
          >
            <Play className="w-4 h-4" /> Run Payroll
          </button>
        </div>
      </div>

      {}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {
            label: "Gross Salary",
            value: formatCurrency(totalGross),
            bg: "bg-[#024BAB]",
          },
          {
            label: "Total Deductions",
            value: formatCurrency(totalDed),
            bg: "bg-[#FA731C]",
          },
          {
            label: "Net Payable",
            value: formatCurrency(totalNet),
            bg: "bg-[#00C48C]",
          },
          {
            label: "Paid",
            value: `${paidCount}/${payrolls.length}`,
            bg: "bg-[#024BAB]",
          },
        ].map(({ label, value, bg }) => (
          <div key={label} className="border-2 bg-white p-4">
            <div
              className={cn(
                "w-10 h-10 border-2 border-black flex items-center justify-center mb-2",
                bg,
              )}
            >
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            <p className="font-display font-bold text-lg text-black">{value}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Search, Filter & Sort */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by employee name..."
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
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="processed">Processed</option>
          <option value="paid">Paid</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as any)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="employee">Sort: Employee</option>
          <option value="net">Sort: Net Pay</option>
          <option value="gross">Sort: Gross</option>
          <option value="deductions">Sort: Deductions</option>
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="border-2 border-black bg-white px-3 py-2 flex items-center gap-1 font-semibold text-sm"
        >
          {sortDir === "asc" ? (
            <ArrowUp className="w-4 h-4" />
          ) : (
            <ArrowDown className="w-4 h-4" />
          )}
          {sortDir === "asc" ? "Asc" : "Desc"}
        </button>
      </div>

      {}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
        </div>
      ) : payrolls.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <IndianRupee className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No payroll records</p>
          <p className="text-sm text-muted-foreground mt-1">
            Process payroll for {MONTHS[month - 1]} {year}
          </p>
          <button
            onClick={() => {
              setProcessModal(true);
              employeeAPI
                .getAll({ status: "active" })
                .then((res) => {
                  if (res.success) setActiveEmployees(res.data);
                })
                .catch(() => {});
            }}
            className="border-2 bg-[#FA731C] text-white px-4 py-2 text-sm mt-4"
          >
            <Play className="w-4 h-4 inline mr-1" /> Process Now
          </button>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  { label: "Employee", cls: "" },
                  { label: "Salary", cls: "text-right" },
                  { label: "OT", cls: "text-right text-[#F59E0B]" },
                  { label: "Late", cls: "text-right text-red-500" },
                  { label: "Half Day", cls: "text-right text-red-500" },
                  { label: "Early Out", cls: "text-right text-red-500" },
                  { label: "Penalty", cls: "text-right text-red-500" },
                  { label: "Bonus / Allow", cls: "text-right text-[#00C48C]" },
                  { label: "Loan / Advance", cls: "text-right text-[#FA731C]" },
                  { label: "Net Salary", cls: "text-right" },
                  { label: "Status", cls: "" },
                  { label: "", cls: "" },
                ].map(({ label, cls }) => (
                  <th
                    key={label}
                    className={cn(
                      "px-4 py-3 text-xs font-bold text-black uppercase tracking-wider",
                      cls,
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedPayrolls.map((p, i) => (
                <tr
                  key={p._id}
                  className={cn(
                    "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  {}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {(p.employee as any)?.firstName?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-black text-xs">
                          {(p.employee as any)?.firstName}{" "}
                          {(p.employee as any)?.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.totalWorkHours != null
                            ? `${p.totalWorkHours}h worked`
                            : `${p.presentDays}/${p.workingDays} days`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          ₹{p.hourlyRate?.toFixed(2) ?? "—"}/hr
                        </p>
                      </div>
                    </div>
                  </td>

                  {}
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs font-bold text-black">
                      {formatCurrency(p.earnedBasic ?? p.basicSalary)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      of {formatCurrency(p.basicSalary)}
                    </p>
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.otPay ?? 0) > 0 ? (
                      <span className="text-[#F59E0B]">
                        +{formatCurrency(p.otPay!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {(p.overtimeHours ?? 0) > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {p.overtimeHours}h
                      </p>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.lateDeductionAmount ?? 0) > 0 ? (
                      <span className="text-red-500">
                        -{formatCurrency(p.lateDeductionAmount!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.halfDayDeduction ?? 0) > 0 ? (
                      <span className="text-red-500">
                        -{formatCurrency(p.halfDayDeduction!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.earlyCheckoutDeduction ?? 0) > 0 ? (
                      <span className="text-red-500">
                        -{formatCurrency(p.earlyCheckoutDeduction!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.penaltyAmount ?? 0) > 0 ? (
                      <span className="text-red-500">
                        -{formatCurrency(p.penaltyAmount!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.otherAllowances ?? 0) > 0 ? (
                      <span className="text-[#00C48C]">
                        +{formatCurrency(p.otherAllowances!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {p.loanDeduction > 0 ? (
                      <span className="text-[#FA731C]">
                        -{formatCurrency(p.loanDeduction)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "text-sm font-black",
                        p.netSalary === 0 ? "text-red-500" : "text-black",
                      )}
                    >
                      {formatCurrency(p.netSalary)}
                    </span>
                  </td>

                  {}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "border-2 text-[10px] capitalize",
                        STATUS_COLORS[p.status],
                      )}
                    >
                      {p.status}
                    </span>
                  </td>

                  {}
                  <td className="px-4 py-3">
                    {p.status === "processed" && (
                      <button
                        onClick={() => handleMarkPaid(p._id)}
                        className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors whitespace-nowrap"
                      >
                        <CheckCircle className="w-3 h-3" /> Mark Paid
                      </button>
                    )}
                    {p.status === "paid" && (
                      <span className="text-xs text-[#00C48C] font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Paid
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {}
      {processModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b-2 border-black sticky top-0 bg-white">
              <h3 className="font-display font-bold text-lg">
                Process Payroll
              </h3>
              <button
                onClick={() => {
                  setProcessModal(false);
                  setSelectedEmployees(new Set());
                  setProcessMode("all");
                  setActiveEmployees([]);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm font-medium text-black mb-4">
                Process payroll for{" "}
                <strong>
                  {MONTHS[month - 1]} {year}
                </strong>
              </p>

              {}
              <div className="space-y-3 mb-6">
                <label
                  className="flex items-center gap-3 p-3 border-2 border-black cursor-pointer hover:bg-[#024BAB]/5 transition-colors"
                  onClick={() => setProcessMode("all")}
                >
                  <input
                    type="radio"
                    name="processMode"
                    value="all"
                    checked={processMode === "all"}
                    onChange={() => setProcessMode("all")}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-bold text-black">
                      All Employees
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Process payroll for all {activeEmployees.length} active
                      employees
                    </p>
                  </div>
                </label>

                <label
                  className="flex items-center gap-3 p-3 border-2 border-black cursor-pointer hover:bg-[#024BAB]/5 transition-colors"
                  onClick={() => setProcessMode("select")}
                >
                  <input
                    type="radio"
                    name="processMode"
                    value="select"
                    checked={processMode === "select"}
                    onChange={() => setProcessMode("select")}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-bold text-black">
                      Custom Selection
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Choose specific employees
                    </p>
                  </div>
                </label>
              </div>

              {}
              {processMode === "select" && (
                <div className="mb-6 p-4 border-2 border-black bg-[#F8FAFF]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-black uppercase tracking-wider">
                      Select Employees
                    </p>
                    <button
                      onClick={toggleAllEmployees}
                      className="text-xs font-bold text-[#024BAB] hover:underline"
                    >
                      {selectedEmployees.size === activeEmployees.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {activeEmployees.map((emp) => (
                      <label
                        key={emp._id}
                        className="flex items-center gap-2 p-2 hover:bg-white/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployees.has(emp._id)}
                          onChange={() => toggleEmployeeSelection(emp._id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-6 h-6 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[9px] font-bold text-white">
                            {emp.firstName?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-black">
                              {emp.firstName} {emp.lastName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {emp.designation}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs font-medium text-black">
                          {formatCurrency(emp.salary || 0)}
                        </p>
                      </label>
                    ))}
                    {activeEmployees.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-4">
                        Loading employees...
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    {selectedEmployees.size} of {activeEmployees.length}{" "}
                    selected
                  </p>
                </div>
              )}

              {}
              <div className="p-3 border-2 border-[#FA731C] bg-[#FA731C]/5 mb-4">
                <p className="text-xs font-bold text-[#FA731C]">
                  ⚠ Existing records won't be overwritten. Verify selection
                  before processing.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => handleProcess(false)}
                  disabled={
                    processing ||
                    (processMode === "select" && selectedEmployees.size === 0)
                  }
                  className="border-2 bg-[#FA731C] text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? "Processing..." : "Confirm & Process"}
                </button>
                <button
                  onClick={() => {
                    if (!confirm(`Force reprocess will DELETE existing payroll for ${month}/${year} (not paid) and recalculate with latest deduction rules. Continue?`)) return;
                    handleProcess(true);
                  }}
                  disabled={processing}
                  className="border-2 bg-red-600 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                  title="Delete and recalculate existing payroll records"
                >
                  Force Reprocess
                </button>
                <button
                  onClick={() => {
                    setProcessModal(false);
                    setSelectedEmployees(new Set());
                    setProcessMode("all");
                    setActiveEmployees([]);
                  }}
                  className="bg-white text-black px-4 py-2.5 text-sm font-bold border-2 border-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ActionModal
        show={actionModal.show}
        type={actionModal.type}
        title={actionModal.title}
        message={actionModal.message}
        onClose={() => setActionModal({ ...actionModal, show: false })}
      />
    </AppLayout>
  );
}
