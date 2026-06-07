import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { payrollAPI, employeeAPI } from "@/services/api";
import { Payroll } from "@/types/hrms";
import { cn, formatCurrency } from "@/lib/utils";
import {
  IndianRupee,
  Play,
  CheckCircle,
  X,
  AlertCircle,
  Printer,
} from "lucide-react";

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

  // Auto-close success modal after 2 seconds
  useEffect(() => {
    if (actionModal.show && actionModal.type === "success") {
      const timer = setTimeout(() => {
        setActionModal((prev) => ({ ...prev, show: false }));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [actionModal.show, actionModal.type]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const selectedIds =
        processMode === "all" ? undefined : Array.from(selectedEmployees);
      const res = await payrollAPI.process({
        month,
        year,
        employeeIds: selectedIds,
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

  return (
    <AppLayout title="Payroll">
      {/* Header */}
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

      {/* Summary */}
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

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 bg-[#024BAB] border-2 border-black animate-bounce" />
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Basic",
                  "Gross",
                  "OT Hrs",
                  "Deductions",
                  "Net Salary",
                  "Days",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payrolls.map((p, i) => (
                <tr
                  key={p._id}
                  className={cn(
                    "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white">
                        {(p.employee as any)?.firstName?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-black text-xs">
                          {(p.employee as any)?.firstName}{" "}
                          {(p.employee as any)?.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(p.employee as any)?.designation}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-black">
                    {formatCurrency(p.basicSalary)}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-black">
                    {formatCurrency(p.grossSalary)}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-[#FA731C]">
                    {p.overtimeHours > 0 ? `${p.overtimeHours}h` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-red-600">
                    -{formatCurrency(p.totalDeductions)}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-black">
                    {formatCurrency(p.netSalary)}
                  </td>
                  <td className="px-4 py-3 text-xs text-black">
                    {p.presentDays}/{p.workingDays}
                  </td>
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
                  <td className="px-4 py-3">
                    {p.status === "processed" && (
                      <button
                        onClick={() => handleMarkPaid(p._id)}
                        className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors"
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

      {/* Process Modal */}
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

              {/* Process Mode Selection */}
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

              {/* Employee Selection List */}
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

              {/* Warning */}
              <div className="p-3 border-2 border-[#FA731C] bg-[#FA731C]/5 mb-4">
                <p className="text-xs font-bold text-[#FA731C]">
                  ⚠ Existing records won't be overwritten. Verify selection
                  before processing.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleProcess}
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

      {/* Success/Error Animation Modal */}
      {actionModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-sm p-8 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
            {actionModal.type === "success" ? (
              <>
                <div className="mb-4 animate-bounce">
                  <CheckCircle className="w-16 h-16 text-[#00C48C]" />
                </div>
                <h2 className="text-2xl font-display font-bold text-black mb-2">
                  {actionModal.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {actionModal.message}
                </p>
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse delay-100" />
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse delay-200" />
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 animate-bounce">
                  <AlertCircle className="w-16 h-16 text-[#EF4444]" />
                </div>
                <h2 className="text-2xl font-display font-bold text-black mb-2">
                  {actionModal.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {actionModal.message}
                </p>
                <button
                  onClick={() =>
                    setActionModal({ ...actionModal, show: false })
                  }
                  className="mt-4 px-6 py-2 bg-[#EF4444] text-white text-sm font-bold border-2 border-[#EF4444] hover:bg-[#EF4444]/90 transition-colors"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
