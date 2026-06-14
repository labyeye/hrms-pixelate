import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { exitAPI, employeeAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  LogOut, Plus, X, ChevronRight, Calendar, Clock,
  CheckCircle2, AlertCircle, FileText, Package, DollarSign, User,
} from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  personal: "Personal",
  better_opportunity: "Better Opportunity",
  relocation: "Relocation",
  health: "Health",
  retirement: "Retirement",
  termination: "Termination",
  contract_end: "Contract End",
  other: "Other",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  notice_period: { label: "Notice Period", color: "bg-blue-100 text-blue-800 border-blue-300" },
  cleared: { label: "Cleared", color: "bg-purple-100 text-purple-800 border-purple-300" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800 border-green-300" },
};

interface ExitRecord {
  _id: string;
  employee: { _id: string; firstName: string; lastName: string; employeeId: string; designation?: string; department?: { name: string } };
  resignationDate: string;
  lastWorkingDay?: string;
  noticePeriodDays: number;
  reason: string;
  reasonDetails?: string;
  status: string;
  exitInterviewDone: boolean;
  exitInterviewNotes?: string;
  assetsReturned: boolean;
  fnfAmount: number;
  fnfStatus: string;
  experienceLetterIssued: boolean;
  initiatedBy?: { name: string };
  createdAt: string;
}

function fmt(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ExitManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isHR = user?.role !== "employee";

  const [records, setRecords] = useState<ExitRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExitRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const [form, setForm] = useState({
    employee: "", resignationDate: "", noticePeriodDays: "30",
    reason: "personal", reasonDetails: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await exitAPI.getAll(params);
      setRecords(res.data || []);
    } catch { toast({ title: "Failed to load exit records", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isHR) {
      employeeAPI.getAll({ limit: "200" }).then((r) => setEmployees(r.data || [])).catch(() => {});
    }
  }, [isHR]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await exitAPI.create({
        employee: form.employee,
        resignationDate: form.resignationDate,
        noticePeriodDays: parseInt(form.noticePeriodDays),
        reason: form.reason,
        reasonDetails: form.reasonDetails,
      });
      toast({ title: "Exit process initiated" });
      setShowCreate(false);
      setForm({ employee: "", resignationDate: "", noticePeriodDays: "30", reason: "personal", reasonDetails: "" });
      load();
    } catch (err: any) {
      toast({ title: err.message || "Failed to create exit record", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleUpdate = async (id: string, body: object) => {
    try {
      const res = await exitAPI.update(id, body);
      setSelected(res.data);
      load();
      toast({ title: "Updated successfully" });
    } catch (err: any) {
      toast({ title: err.message || "Update failed", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-black flex items-center gap-2">
              <LogOut className="w-6 h-6" /> Exit Management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage employee resignations, notice periods & full-and-final settlement</p>
          </div>
          {isHR && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#024BAB] text-white px-4 py-2.5 text-sm font-black border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#0a0a0a] transition-all"
            >
              <Plus className="w-4 h-4" /> Initiate Exit
            </button>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {[{ value: "", label: "All" }, { value: "pending", label: "Pending" }, { value: "notice_period", label: "Notice Period" }, { value: "cleared", label: "Cleared" }, { value: "completed", label: "Completed" }].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-black border-2 transition-all ${statusFilter === f.value ? "bg-[#024BAB] text-white border-[#024BAB]" : "bg-white text-black border-black hover:border-[#024BAB]"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border-2 border-black overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-400 font-medium">Loading...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-16">
              <LogOut className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No exit records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-black bg-[#F0F6FF]">
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider">Employee</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider">Resignation</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider">Last Day</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider">Reason</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider">FNF</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r._id} className={`border-b border-gray-100 hover:bg-[#F0F6FF] transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-black">{r.employee?.firstName} {r.employee?.lastName}</div>
                        <div className="text-xs text-gray-500">{r.employee?.employeeId} · {r.employee?.department?.name || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fmt(r.resignationDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmt(r.lastWorkingDay)}</td>
                      <td className="px-4 py-3 text-gray-600">{REASON_LABELS[r.reason] || r.reason}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-black border rounded-sm ${STATUS_CONFIG[r.status]?.color || ""}`}>
                          {STATUS_CONFIG[r.status]?.label || r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${r.fnfStatus === "paid" ? "text-green-600" : r.fnfStatus === "calculated" ? "text-blue-600" : "text-gray-400"}`}>
                          {r.fnfStatus === "paid" ? "Paid" : r.fnfStatus === "calculated" ? "Calculated" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(r)} className="text-[#024BAB] hover:underline font-black text-xs flex items-center gap-1">
                          View <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black">
              <h3 className="font-black text-lg">Initiate Exit Process</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5">Employee</label>
                <select value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-black text-sm font-medium focus:outline-none focus:border-[#024BAB]" required>
                  <option value="">Select employee...</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} ({emp.employeeId})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5">Resignation Date</label>
                  <input type="date" value={form.resignationDate} onChange={(e) => setForm({ ...form, resignationDate: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-black text-sm font-medium focus:outline-none focus:border-[#024BAB]" required />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5">Notice Period (Days)</label>
                  <input type="number" min="0" max="365" value={form.noticePeriodDays} onChange={(e) => setForm({ ...form, noticePeriodDays: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-black text-sm font-medium focus:outline-none focus:border-[#024BAB]" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5">Reason</label>
                <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-black text-sm font-medium focus:outline-none focus:border-[#024BAB]">
                  {Object.entries(REASON_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5">Details (optional)</label>
                <textarea value={form.reasonDetails} onChange={(e) => setForm({ ...form, reasonDetails: e.target.value })}
                  rows={3} maxLength={1000}
                  className="w-full px-3 py-2.5 border-2 border-black text-sm font-medium focus:outline-none focus:border-[#024BAB] resize-none"
                  placeholder="Additional notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 border-2 border-black text-sm font-black hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-[#024BAB] text-white py-2.5 text-sm font-black border-2 border-black hover:shadow-[4px_4px_0px_#0a0a0a] transition-all">
                  {saving ? "Saving..." : "Initiate Exit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white border-2 border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black sticky top-0 bg-white">
              <h3 className="font-black text-lg">{selected.employee?.firstName} {selected.employee?.lastName} — Exit Details</h3>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Employee ID", value: selected.employee?.employeeId },
                  { label: "Department", value: selected.employee?.department?.name || "—" },
                  { label: "Resignation Date", value: fmt(selected.resignationDate) },
                  { label: "Last Working Day", value: fmt(selected.lastWorkingDay) },
                  { label: "Notice Period", value: `${selected.noticePeriodDays} days` },
                  { label: "Reason", value: REASON_LABELS[selected.reason] || selected.reason },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#F0F6FF] border border-gray-200 px-3 py-2">
                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">{label}</div>
                    <div className="font-black text-sm text-black mt-0.5">{value}</div>
                  </div>
                ))}
              </div>

              {/* Checklist */}
              {isHR && (
                <div className="border-2 border-black p-4">
                  <h4 className="font-black mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Exit Checklist</h4>
                  <div className="space-y-3">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <select
                        value={selected.status}
                        onChange={(e) => handleUpdate(selected._id, { status: e.target.value })}
                        className="px-2 py-1 border-2 border-black text-xs font-black focus:outline-none"
                      >
                        {Object.entries(STATUS_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </div>
                    {/* Exit interview */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={selected.exitInterviewDone}
                        onChange={(e) => handleUpdate(selected._id, { exitInterviewDone: e.target.checked })}
                        className="w-4 h-4 border-2 border-black" />
                      <span className="text-sm font-medium">Exit Interview Done</span>
                    </label>
                    {/* Assets */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={selected.assetsReturned}
                        onChange={(e) => handleUpdate(selected._id, { assetsReturned: e.target.checked })}
                        className="w-4 h-4 border-2 border-black" />
                      <span className="text-sm font-medium flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Assets Returned</span>
                    </label>
                    {/* Experience letter */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={selected.experienceLetterIssued}
                        onChange={(e) => handleUpdate(selected._id, { experienceLetterIssued: e.target.checked })}
                        className="w-4 h-4 border-2 border-black" />
                      <span className="text-sm font-medium flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Experience Letter Issued</span>
                    </label>
                  </div>
                </div>
              )}

              {/* FNF */}
              {isHR && (
                <div className="border-2 border-black p-4">
                  <h4 className="font-black mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Full & Final Settlement</h4>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider mb-1">FNF Amount (₹)</label>
                      <input
                        type="number" min="0" defaultValue={selected.fnfAmount}
                        onBlur={(e) => handleUpdate(selected._id, { fnfAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border-2 border-black text-sm font-medium focus:outline-none focus:border-[#024BAB]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider mb-1">FNF Status</label>
                      <select value={selected.fnfStatus}
                        onChange={(e) => handleUpdate(selected._id, { fnfStatus: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-black text-sm font-black focus:outline-none">
                        <option value="pending">Pending</option>
                        <option value="calculated">Calculated</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {isHR && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5">Exit Interview Notes</label>
                  <textarea
                    defaultValue={selected.exitInterviewNotes || ""}
                    onBlur={(e) => handleUpdate(selected._id, { exitInterviewNotes: e.target.value })}
                    rows={3} maxLength={2000}
                    className="w-full px-3 py-2.5 border-2 border-black text-sm font-medium focus:outline-none focus:border-[#024BAB] resize-none"
                    placeholder="Notes from exit interview..."
                  />
                </div>
              )}

              {selected.reasonDetails && (
                <div className="bg-gray-50 border border-gray-200 px-4 py-3">
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Employee's Note</div>
                  <p className="text-sm text-gray-700">{selected.reasonDetails}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
