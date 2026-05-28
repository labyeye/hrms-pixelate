import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { holidayAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Gift,
  Flag,
  Lock,
} from "lucide-react";

interface Holiday {
  _id: string;
  name: string;
  date: string;
  type: "national" | "optional" | "restricted";
  description?: string;
  isActive: boolean;
}

const TYPE_META = {
  national: {
    label: "National",
    icon: Flag,
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  optional: {
    label: "Optional",
    icon: Gift,
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-700",
    dot: "bg-orange-400",
  },
  restricted: {
    label: "Restricted",
    icon: Lock,
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-700",
    dot: "bg-yellow-400",
  },
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
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function HolidayBadge({ type }: { type: Holiday["type"] }) {
  const m = TYPE_META[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-black uppercase border",
        m.bg,
        m.border,
        m.text,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export default function HolidaysPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "super_admin" || user?.role === "hr_manager";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    date: "",
    type: "national" as Holiday["type"],
    description: "",
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await holidayAPI.getAll({ year: String(year) });
      setHolidays(r.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const resetForm = () => {
    setForm({ name: "", date: "", type: "national", description: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.date || saving) return;
    setSaving(true);
    try {
      if (editingId) {
        const r = await holidayAPI.update(editingId, form);
        setHolidays((p) => p.map((h) => (h._id === editingId ? r.data : h)));
        toast({ title: "Holiday updated" });
      } else {
        const r = await holidayAPI.create(form);
        setHolidays((p) =>
          [...p, r.data].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          ),
        );
        toast({ title: "Holiday added" });
      }
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this holiday?")) return;
    try {
      await holidayAPI.delete(id);
      setHolidays((p) => p.filter((h) => h._id !== id));
      toast({ title: "Holiday deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const startEdit = (h: Holiday) => {
    setEditingId(h._id);
    setForm({
      name: h.name,
      date: h.date.slice(0, 10),
      type: h.type,
      description: h.description || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Group by month
  const grouped: Record<number, Holiday[]> = {};
  holidays.forEach((h) => {
    const m = new Date(h.date).getMonth();
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(h);
  });

  const totalNational = holidays.filter(
    (h) => h.type === "national" && h.isActive,
  ).length;
  const totalOptional = holidays.filter(
    (h) => h.type === "optional" && h.isActive,
  ).length;
  const totalRestricted = holidays.filter(
    (h) => h.type === "restricted" && h.isActive,
  ).length;

  return (
    <AppLayout title="Holidays">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display font-black text-3xl text-black">
              Company Holidays
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Declare holidays — attendance is automatically blocked on these
              dates
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-black text-sm uppercase nb-shadow-sm hover:nb-shadow transition-all"
            >
              <Plus className="w-4 h-4" /> Add Holiday
            </button>
          )}
        </div>

        {/* Year picker + stats */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2 border-2 border-black bg-white nb-shadow-sm overflow-hidden">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="px-3 py-2 font-black text-lg hover:bg-gray-50 border-r-2 border-black"
            >
              ‹
            </button>
            <span className="px-4 py-2 font-black text-base">{year}</span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="px-3 py-2 font-black text-lg hover:bg-gray-50 border-l-2 border-black"
            >
              ›
            </button>
          </div>
          <div className="flex gap-3">
            {(["national", "optional", "restricted"] as const).map((t) => {
              const m = TYPE_META[t];
              const count =
                t === "national"
                  ? totalNational
                  : t === "optional"
                    ? totalOptional
                    : totalRestricted;
              return (
                <div
                  key={t}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 border-2 text-sm font-black",
                    m.bg,
                    m.border,
                    m.text,
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", m.dot)} />
                  {m.label}: {count}
                </div>
              );
            })}
          </div>
          <span className="ml-auto text-sm font-bold text-gray-500">
            {holidays.length} total holidays
          </span>
        </div>

        {/* Add / Edit Form */}
        {showForm && canManage && (
          <div className="bg-white border-2 border-black p-6 mb-6 nb-shadow">
            <h3 className="font-black text-base mb-4">
              {editingId ? "Edit Holiday" : "Add Holiday"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">
                  Holiday Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Republic Day"
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, date: e.target.value }))
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">
                  Type *
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      type: e.target.value as Holiday["type"],
                    }))
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none"
                >
                  <option value="national">
                    National — applies to everyone, no attendance
                  </option>
                  <option value="optional">
                    Optional — employee can choose to take it
                  </option>
                  <option value="restricted">
                    Restricted — limited to specific employees
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">
                  Description (optional)
                </label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Additional notes"
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-black text-sm uppercase nb-shadow-sm disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={resetForm}
                className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-black text-sm uppercase"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Holiday List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
          </div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-16 bg-white border-2 border-black">
            <CalendarDays className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="font-black text-gray-400 text-lg">
              No holidays for {year}
            </p>
            {canManage && (
              <p className="text-sm text-gray-400 mt-1">
                Click "Add Holiday" to declare company holidays.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from({ length: 12 }, (_, i) => i)
              .filter((m) => grouped[m])
              .map((m) => (
                <div
                  key={m}
                  className="bg-white border-2 border-black nb-shadow-sm overflow-hidden"
                >
                  {/* Month header */}
                  <div className="bg-[#024BAB] px-5 py-3 flex items-center justify-between">
                    <span className="font-black text-white uppercase tracking-wider text-sm">
                      {MONTHS[m]}
                    </span>
                    <span className="text-blue-200 text-xs font-bold">
                      {grouped[m].length} holiday
                      {grouped[m].length > 1 ? "s" : ""}
                    </span>
                  </div>
                  {/* Holidays in this month */}
                  <div className="divide-y divide-gray-100">
                    {grouped[m].map((h) => {
                      const d = new Date(h.date);
                      const dayName = DAYS[d.getDay()];
                      const dayNum = d.getDate();
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div
                          key={h._id}
                          className={cn(
                            "flex items-center gap-4 px-5 py-4",
                            !h.isActive && "opacity-50",
                          )}
                        >
                          {/* Date block */}
                          <div
                            className={cn(
                              "w-14 h-14 border-2 border-black flex flex-col items-center justify-center shrink-0",
                              TYPE_META[h.type].bg,
                            )}
                          >
                            <span className="text-xs font-black uppercase text-gray-500">
                              {dayName}
                            </span>
                            <span
                              className={cn(
                                "text-2xl font-black leading-none",
                                TYPE_META[h.type].text,
                              )}
                            >
                              {dayNum}
                            </span>
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-black text-base">
                                {h.name}
                              </span>
                              <HolidayBadge type={h.type} />
                              {isWeekend && (
                                <span className="text-xs font-bold text-gray-400 border border-gray-200 px-1.5 py-0.5">
                                  Weekend
                                </span>
                              )}
                              {!h.isActive && (
                                <span className="text-xs font-bold text-gray-400 border border-gray-200 px-1.5 py-0.5">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {h.description && (
                              <p className="text-xs text-gray-500 mt-0.5 font-medium">
                                {h.description}
                              </p>
                            )}
                          </div>
                          {/* Actions */}
                          {canManage && (
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => startEdit(h)}
                                className="p-2 border border-gray-200 hover:border-black hover:bg-gray-50 transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(h._id)}
                                className="p-2 border border-gray-200 hover:border-red-500 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 p-4 bg-blue-50 border-2 border-[#024BAB]/20">
          <p className="text-xs font-black uppercase text-[#024BAB] mb-2">
            How holidays affect attendance
          </p>
          <ul className="text-xs text-gray-600 space-y-1 font-medium">
            <li>
              🔴 <strong>National:</strong> Attendance is automatically blocked.
              Any check-in/out on this day is recorded but attendance status is
              set to "holiday".
            </li>
            <li>
              🟠 <strong>Optional:</strong> Employee can choose whether to work.
              Attendance is recorded normally if they check in.
            </li>
            <li>
              🟡 <strong>Restricted:</strong> Only applicable to employees with
              leave balance. HR manages individually.
            </li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}
