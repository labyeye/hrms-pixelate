import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { attendanceAPI, employeeAPI } from "@/services/api";
import { AttendanceRecord, Employee } from "@/types/hrms";
import { cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Fingerprint,
  CreditCard,
  Scan,
  KeyRound,
  MousePointerClick,
} from "lucide-react";

const VERIFY_MODE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  fingerprint: { label: "Finger",   icon: Fingerprint,       color: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]" },
  card:        { label: "Card",     icon: CreditCard,        color: "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]" },
  face:        { label: "Face",     icon: Scan,              color: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]" },
  password:    { label: "Password", icon: KeyRound,          color: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]" },
  manual:      { label: "Manual",   icon: MousePointerClick, color: "bg-gray-100 text-gray-500 border-gray-300"       },
};

const STATUS_COLORS: Record<string, string> = {
  present:  "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
  absent:   "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444] px-2 py-0.5",
  half_day: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  late:     "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  on_leave: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB] px-2 py-0.5",
  holiday:  "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7] px-2 py-0.5",
  weekend:  "bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  present: CheckCircle,
  absent: XCircle,
  half_day: AlertCircle,
  late: Clock,
  on_leave: Calendar,
};

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

export default function AttendancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [markModal, setMarkModal] = useState(false);
  const [markForm, setMarkForm] = useState({
    employee: "",
    date: new Date().toISOString().split("T")[0],
    status: "present",
    checkIn: "",
    checkOut: "",
    overtime: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [attRes, empRes] = await Promise.all([
        attendanceAPI.getAll({
          month: String(month),
          year: String(year),
          limit: "200",
        }),
        employeeAPI.getAll({ status: "active", limit: "200" }),
      ]);
      if (attRes.success) setRecords(attRes.data);
      if (empRes.success) setEmployees(empRes.data);
    } catch {}
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMark = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await attendanceAPI.mark({
        ...markForm,
        overtime: markForm.overtime ? parseFloat(markForm.overtime) : 0,
      });
      setMarkModal(false);
      load();
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  };

  const summary = {
    present: records.filter((r) => r.status === "present").length,
    absent: records.filter((r) => r.status === "absent").length,
    late: records.filter((r) => r.status === "late").length,
    leave: records.filter((r) => r.status === "on_leave").length,
  };

  return (
    <AppLayout title="Attendance">
      {/* Controls */}
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
            {[2023, 2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setMarkModal(true)}
          className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
        >
          <Clock className="w-4 h-4" /> Mark Attendance
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {
            label: "Present",
            value: summary.present,
            bg: "bg-[#024BAB]",
            textColor: "text-white",
          },
          {
            label: "Absent",
            value: summary.absent,
            bg: "bg-[#EF4444]",
            textColor: "text-white",
          },
          {
            label: "Late",
            value: summary.late,
            bg: "bg-[#FA731C]",
            textColor: "text-white",
          },
          {
            label: "On Leave",
            value: summary.leave,
            bg: "bg-[#0D9488]",
            textColor: "text-white",
          },
        ].map(({ label, value, bg, textColor }) => (
          <div key={label} className="border-2 bg-white p-4">
            <div
              className={cn(
                "w-10 h-10 border-2 border-black flex items-center justify-center mb-2",
                bg,
              )}
            >
              <Clock className={cn("w-5 h-5", textColor)} />
            </div>
            <p className="font-display font-bold text-2xl text-black">
              {value}
            </p>
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
      ) : records.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <Clock className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No attendance records</p>
          <p className="text-sm text-muted-foreground mt-1">
            for {MONTHS[month - 1]} {year}
          </p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Date",
                  "Check In",
                  "Check Out",
                  "Hours",
                  "OT Hrs",
                  "Via",
                  "Status",
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
              {records.map((rec, i) => {
                const Icon = STATUS_ICONS[rec.status] || Clock;
                return (
                  <tr
                    key={rec._id}
                    className={cn(
                      "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                      i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {(rec.employee as any)?.firstName?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-bold text-black text-xs">
                          {(rec.employee as any)?.firstName}{" "}
                          {(rec.employee as any)?.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-black text-xs">
                      {new Date(rec.date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-black text-xs">
                      {rec.checkIn
                        ? new Date(rec.checkIn).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-black text-xs">
                      {rec.checkOut
                        ? new Date(rec.checkOut).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-black text-xs">
                      {rec.workHours ? `${rec.workHours.toFixed(1)}h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(rec as any).overtime > 0 ? (
                        <span className="font-bold text-[#FA731C]">
                          {(rec as any).overtime.toFixed(1)}h
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const mode = (rec as any).verifyMode || "manual";
                        const cfg = VERIFY_MODE_CONFIG[mode] || VERIFY_MODE_CONFIG.manual;
                        const ModeIcon = cfg.icon;
                        return (
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border-2", cfg.color)}>
                            <ModeIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "border-2 text-[10px] capitalize flex items-center gap-1 w-fit",
                          STATUS_COLORS[rec.status],
                        )}
                      >
                        <Icon className="w-3 h-3" />{" "}
                        {rec.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mark Attendance Modal */}
      {markModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">
                Mark Attendance
              </h3>
              <button onClick={() => setMarkModal(false)}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleMark} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Employee
                </label>
                <select
                  value={markForm.employee}
                  onChange={(e) =>
                    setMarkForm({ ...markForm, employee: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
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
                  Date
                </label>
                <input
                  type="date"
                  value={markForm.date}
                  onChange={(e) =>
                    setMarkForm({ ...markForm, date: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Status
                </label>
                <select
                  value={markForm.status}
                  onChange={(e) =>
                    setMarkForm({ ...markForm, status: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half_day">Half Day</option>
                  <option value="late">Late</option>
                  <option value="on_leave">On Leave</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Check In
                  </label>
                  <input
                    type="datetime-local"
                    value={markForm.checkIn}
                    onChange={(e) =>
                      setMarkForm({ ...markForm, checkIn: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Check Out
                  </label>
                  <input
                    type="datetime-local"
                    value={markForm.checkOut}
                    onChange={(e) =>
                      setMarkForm({ ...markForm, checkOut: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Overtime Hours (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 1.5"
                  value={markForm.overtime}
                  onChange={(e) =>
                    setMarkForm({ ...markForm, overtime: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  {saving ? "Saving..." : "Mark Attendance"}
                </button>
                <button
                  type="button"
                  onClick={() => setMarkModal(false)}
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
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
