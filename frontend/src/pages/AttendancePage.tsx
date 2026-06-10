import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { attendanceAPI, employeeAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
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
  Pencil,
} from "lucide-react";

const VERIFY_MODE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  fingerprint: {
    label: "Finger",
    icon: Fingerprint,
    color: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
  },
  card: {
    label: "Card",
    icon: CreditCard,
    color: "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]",
  },
  face: {
    label: "Face",
    icon: Scan,
    color: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  },
  password: {
    label: "Password",
    icon: KeyRound,
    color: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  },
  manual: {
    label: "Manual",
    icon: MousePointerClick,
    color: "bg-gray-100 text-gray-500 border-gray-300",
  },
};

const STATUS_COLORS: Record<string, string> = {
  present: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
  absent: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444] px-2 py-0.5",
  half_day: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  late: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  on_leave: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB] px-2 py-0.5",
  holiday: "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7] px-2 py-0.5",
  weekend: "bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
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
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";
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
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const attRes = await attendanceAPI.getAll({
        month: String(month),
        year: String(year),
        limit: "200",
      });
      if (attRes.success) setRecords(attRes.data);
      if (!isEmployee) {
        const empRes = await employeeAPI.getAll({
          status: "active",
          limit: "200",
        });
        if (empRes.success) setEmployees(empRes.data);
      }
    } catch {}
    setLoading(false);
  }, [month, year, isEmployee]);

  useEffect(() => {
    load();
  }, [load]);

  const toLocalInput = (iso: string | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEdit = (rec: AttendanceRecord) => {
    const emp = rec.employee as any;
    setMarkForm({
      employee: emp?._id ?? "",
      date: new Date(rec.date).toISOString().split("T")[0],
      status: rec.status,
      checkIn: toLocalInput(rec.checkIn as any),
      checkOut: toLocalInput(rec.checkOut as any),
      overtime: (rec as any).overtime ? String((rec as any).overtime) : "",
      notes: (rec as any).notes ?? "",
    });
    setEditingId(rec._id);
    setMarkModal(true);
  };

  // "2024-06-10T09:00" from datetime-local has no timezone.
  // new Date() in the browser parses it as local (IST), so .toISOString() gives
  // the correct UTC equivalent before it's sent to the server.
  const localToISO = (s: string) => (s ? new Date(s).toISOString() : undefined);

  const handleMark = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await attendanceAPI.mark({
        ...markForm,
        checkIn: localToISO(markForm.checkIn),
        checkOut: localToISO(markForm.checkOut),
        overtime: markForm.overtime ? parseFloat(markForm.overtime) : 0,
      });
      setMarkModal(false);
      setEditingId(null);
      load();
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  };

  const summary = {
    total: records.filter((r) => !["holiday", "weekend"].includes(r.status))
      .length,
    present: records.filter((r) => r.status === "present").length,
    absent: records.filter((r) => r.status === "absent").length,
    halfDay: records.filter((r) => r.status === "half_day").length,
    late: records.filter((r) => r.status === "late").length,
    earlyLeaving: records.filter((r) => {
      const rec = r as any;
      return rec.earlyLeaving || (r.status === "present" && rec.earlyCheckout);
    }).length,
    leave: records.filter((r) => r.status === "on_leave").length,
  };

  const displayedRecords = activeFilter
    ? activeFilter === "early_leaving"
      ? records.filter((r) => {
          const rec = r as any;
          return (
            rec.earlyLeaving || (r.status === "present" && rec.earlyCheckout)
          );
        })
      : records.filter((r) => r.status === activeFilter)
    : records;

  return (
    <AppLayout title="Attendance">
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
        {!isEmployee && (
          <button
            onClick={() => setMarkModal(true)}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
          >
            <Clock className="w-4 h-4" /> Mark Attendance
          </button>
        )}
      </div>

      {}
      <div className="border-2 border-black bg-white mb-5 flex flex-wrap">
        {[
          {
            label: "Total",
            value: summary.total,
            color: "text-[#024BAB]",
            filterKey: "total",
          },
          {
            label: "Present",
            value: summary.present,
            color: "text-[#22C55E]",
            filterKey: "present",
          },
          {
            label: "Absent",
            value: summary.absent,
            color: "text-[#EF4444]",
            filterKey: "absent",
          },
          {
            label: "Half Day",
            value: summary.halfDay,
            color: "text-[#F59E0B]",
            filterKey: "half_day",
          },
          {
            label: "Late Commers",
            value: summary.late,
            color: "text-[#A855F7]",
            filterKey: "late",
          },
          {
            label: "Early Leaving",
            value: summary.earlyLeaving,
            color: "text-[#3B82F6]",
            filterKey: "early_leaving",
          },
          {
            label: "On Leave",
            value: summary.leave,
            color: "text-[#EAB308]",
            filterKey: "on_leave",
          },
        ].map(({ label, value, color, filterKey }, idx, arr) => {
          const isActive = activeFilter === filterKey;
          return (
            <button
              key={label}
              onClick={() =>
                setActiveFilter(
                  isActive || filterKey === "total" ? null : filterKey,
                )
              }
              className={cn(
                "flex flex-col gap-1 px-6 py-4 flex-1 min-w-[100px] text-left transition-colors",
                idx === 0 ? "bg-[#F3F4FF]" : "",
                idx !== arr.length - 1 && "border-r border-black/10",
                isActive && "ring-2 ring-inset ring-black",
              )}
            >
              <p className="text-xs text-muted-foreground font-medium">
                {label}
              </p>
              <p className={cn("text-3xl font-bold", color)}>{value}</p>
            </button>
          );
        })}
      </div>

      {}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 bg-[#024BAB] border-2 border-black animate-bounce" />
        </div>
      ) : displayedRecords.length === 0 ? (
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
                  ...(isEmployee ? [] : [""]),
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
              {displayedRecords.map((rec, i) => {
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
                        const cfg =
                          VERIFY_MODE_CONFIG[mode] || VERIFY_MODE_CONFIG.manual;
                        const ModeIcon = cfg.icon;
                        return (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border-2",
                              cfg.color,
                            )}
                          >
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
                    {!isEmployee && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEdit(rec)}
                          title="Edit attendance"
                          className="p-1.5 border-2 border-black hover:bg-[#024BAB] hover:text-white transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {}
      {markModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">
                {editingId ? "Edit Attendance" : "Mark Attendance"}
              </h3>
              <button onClick={() => { setMarkModal(false); setEditingId(null); }}>
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
                  className="border-2 w-full px-3 py-2 text-sm disabled:opacity-60 disabled:bg-gray-50"
                  required
                  disabled={!!editingId}
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
                  {saving ? "Saving..." : editingId ? "Update Attendance" : "Mark Attendance"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMarkModal(false); setEditingId(null); }}
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
