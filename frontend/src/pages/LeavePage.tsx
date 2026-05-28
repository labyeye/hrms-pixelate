import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { leaveAPI, employeeAPI } from "@/services/api";
import { LeaveRequest, Employee } from "@/types/hrms";
import { cn, formatDate } from "@/lib/utils";
import {
  Plus,
  CalendarDays,
  CheckCircle,
  XCircle,
  Clock,
  X,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "nb-tag-orange",
  approved: "nb-tag-blue",
  rejected: "nb-tag-red",
  cancelled: "nb-tag-white",
};

const TYPE_LABELS: Record<string, string> = {
  casual: "Casual",
  sick: "Sick",
  earned: "Earned",
  maternity: "Maternity",
  paternity: "Paternity",
  unpaid: "Unpaid",
  compensatory: "Comp-off",
};

interface LeaveForm {
  employee: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string;
  isHalfDay: boolean;
}

const EMPTY_FORM: LeaveForm = {
  employee: "",
  leaveType: "casual",
  startDate: "",
  endDate: "",
  days: "1",
  reason: "",
  isHalfDay: false,
};

export default function LeavePage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<LeaveForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leavesRes, empRes] = await Promise.all([
        leaveAPI.getAll(filter ? { status: filter } : undefined),
        employeeAPI.getAll({ status: "active", limit: "200" }),
      ]);
      if (leavesRes.success) setLeaves(leavesRes.data);
      if (empRes.success) setEmployees(empRes.data);
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await leaveAPI.create({ ...form, days: Number(form.days) });
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await leaveAPI.updateStatus(id, { status });
      load();
    } catch {}
  };

  const summary = {
    pending: leaves.filter((l) => l.status === "pending").length,
    approved: leaves.filter((l) => l.status === "approved").length,
    rejected: leaves.filter((l) => l.status === "rejected").length,
  };

  return (
    <AppLayout title="Leave Management">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          {["", "pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold border-2 transition-colors capitalize",
                filter === s
                  ? "bg-[#024BAB] text-white border-black nb-shadow-sm"
                  : "bg-white text-black border-black hover:bg-[#024BAB]/10",
              )}
            >
              {s === "" ? "All" : s}{" "}
              {s === "pending" && summary.pending > 0 && `(${summary.pending})`}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="nb-btn bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Apply Leave
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Pending", value: summary.pending, bg: "bg-[#FA731C]" },
          { label: "Approved", value: summary.approved, bg: "bg-[#024BAB]" },
          { label: "Rejected", value: summary.rejected, bg: "bg-[#EF4444]" },
        ].map(({ label, value, bg }) => (
          <div
            key={label}
            className="nb-card bg-white p-4 flex items-center gap-3"
          >
            <div
              className={cn(
                "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
                bg,
              )}
            >
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-black">
                {value}
              </p>
              <p className="text-xs font-bold text-muted-foreground uppercase">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 bg-[#024BAB] border-2 border-black animate-bounce" />
        </div>
      ) : leaves.length === 0 ? (
        <div className="nb-card bg-white p-12 flex flex-col items-center justify-center">
          <CalendarDays className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No leave requests</p>
        </div>
      ) : (
        <div className="nb-card bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Leave Type",
                  "Duration",
                  "Days",
                  "Reason",
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
              {leaves.map((leave, i) => (
                <tr
                  key={leave._id}
                  className={cn(
                    "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white">
                        {(leave.employee as any)?.firstName?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-black text-xs">
                          {(leave.employee as any)?.firstName}{" "}
                          {(leave.employee as any)?.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(leave.employee as any)?.department?.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="nb-badge nb-tag-blue text-[10px]">
                      {TYPE_LABELS[leave.leaveType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-black">
                    {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-black">
                    {leave.days}d
                  </td>
                  <td className="px-4 py-3 text-xs text-black max-w-32 truncate">
                    {leave.reason}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "nb-badge text-[10px] capitalize",
                        STATUS_COLORS[leave.status],
                      )}
                    >
                      {leave.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {leave.status === "pending" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleStatus(leave._id, "approved")}
                          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-[#024BAB]" />
                        </button>
                        <button
                          onClick={() => handleStatus(leave._id, "rejected")}
                          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Apply Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="nb-card bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">Apply Leave</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Employee
                </label>
                <select
                  value={form.employee}
                  onChange={(e) =>
                    setForm({ ...form, employee: e.target.value })
                  }
                  className="nb-input w-full px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Leave Type
                </label>
                <select
                  value={form.leaveType}
                  onChange={(e) =>
                    setForm({ ...form, leaveType: e.target.value })
                  }
                  className="nb-input w-full px-3 py-2 text-sm"
                >
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                    className="nb-input w-full px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                    className="nb-input w-full px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Number of Days
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: e.target.value })}
                  className="nb-input w-full px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Reason
                </label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="nb-input w-full px-3 py-2 text-sm resize-none"
                  rows={3}
                  required
                  placeholder="Reason for leave..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="nb-btn bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  {saving ? "Submitting..." : "Apply Leave"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="nb-btn bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
