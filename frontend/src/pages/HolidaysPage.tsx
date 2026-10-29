import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { holidayAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";
import { ActionModal } from "@/components/ui/ActionModal";
import { StatCard } from "@/components/ui/StatCard";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { ImportButton } from "@/components/ui/ImportButton";
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
  ChevronLeft,
  ChevronRight,
  CalendarClock,
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
    color: "#EF4444",
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700",
  },
  optional: {
    label: "Optional",
    color: "#FA731C",
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-700",
  },
  restricted: {
    label: "Restricted",
    color: "#EAB308",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-700",
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
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function HolidaysPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canManage = user?.role === "super_admin" || user?.role === "hr_manager";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

  // Clicked calendar day (YYYY-MM-DD) -> modal listing its holidays + add/edit form
  const [dayModal, setDayModal] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "national" as Holiday["type"],
    description: "",
  });

  const load = useCallback(async () => {
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
    load();
  }, [load]);

  const byDate = new Map<string, Holiday[]>();
  holidays.forEach((h) => {
    const k = h.date.slice(0, 10);
    byDate.set(k, [...(byDate.get(k) || []), h]);
  });

  const closeDay = () => {
    setDayModal(null);
    setEditingId(null);
    setForm({ name: "", type: "national", description: "" });
  };

  const handleSave = async () => {
    if (saving || !dayModal) return;
    if (!form.name.trim()) {
      setActionModal({
        show: true,
        type: "error",
        title: "Required Field Missing",
        message: "Please fill in: Holiday Name",
      });
      return;
    }
    const ok = await confirm({
      title: editingId ? "Save changes?" : "Add this holiday?",
      description: editingId
        ? "This will update the holiday details."
        : "Attendance of all employees will be marked as holiday for this day.",
    });
    if (!ok) return;
    setSaving(true);
    try {
      if (editingId)
        await holidayAPI.update(editingId, { ...form, date: dayModal });
      else await holidayAPI.create({ ...form, date: dayModal });
      toast({ title: editingId ? "Holiday updated" : "Holiday added" });
      setEditingId(null);
      setForm({ name: "", type: "national", description: "" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this holiday?",
      description: "This action cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
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
    setForm({ name: h.name, type: h.type, description: h.description || "" });
  };

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  // calendar grid
  const first = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const todayKey = iso(now.getFullYear(), now.getMonth(), now.getDate());

  const active = holidays.filter((h) => h.isActive);
  const count = (t: Holiday["type"]) =>
    active.filter((h) => h.type === t).length;
  const upcoming = [...active]
    .filter((h) => h.date.slice(0, 10) >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const thisMonth = active.filter(
    (h) => new Date(h.date).getMonth() === month,
  ).length;

  const dayHolidays = dayModal ? byDate.get(dayModal) || [] : [];

  return (
    <AppLayout title="Holidays">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">
              Company Holidays
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Click a date to see or add a holiday. National holidays are marked
              in everyone's attendance automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <ImportButton
                name="holidays"
                headers={[
                  "Name",
                  "Date (YYYY-MM-DD)",
                  "Type (national/optional/restricted)",
                  "Description",
                ]}
                example={[
                  "Republic Day",
                  `${year}-01-26`,
                  "national",
                  "Public holiday",
                ]}
                onRows={async (rows) => {
                  let ok = 0;
                  for (const r of rows) {
                    const name = String(r["Name"] || "").trim();
                    const date = String(r["Date (YYYY-MM-DD)"] || "").slice(
                      0,
                      10,
                    );
                    const type = String(
                      r["Type (national/optional/restricted)"] || "national",
                    ).toLowerCase();
                    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
                    try {
                      await holidayAPI.create({
                        name,
                        date,
                        type: ["optional", "restricted"].includes(type)
                          ? type
                          : "national",
                        description: String(r["Description"] || ""),
                      });
                      ok++;
                    } catch {}
                  }
                  load();
                  return `${ok} of ${rows.length} holidays imported`;
                }}
              />
            )}
            <ExportMenu
              name={`holidays_${year}`}
              rows={[...holidays].sort((a, b) => a.date.localeCompare(b.date))}
              cols={[
                { header: "Date", value: (h) => h.date.slice(0, 10) },
                {
                  header: "Day",
                  value: (h) => DAYS[new Date(h.date).getDay()],
                },
                { header: "Holiday", value: (h) => h.name },
                { header: "Type", value: (h) => TYPE_META[h.type].label },
                { header: "Description", value: (h) => h.description || "" },
                {
                  header: "Status",
                  value: (h) => (h.isActive ? "Active" : "Inactive"),
                },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <StatCard
            label={`Total ${year}`}
            value={active.length}
            icon={CalendarDays}
            color="#024BAB"
          />
          <StatCard
            label="National"
            value={count("national")}
            icon={Flag}
            color="#EF4444"
          />
          <StatCard
            label="Optional"
            value={count("optional")}
            icon={Gift}
            color="#FA731C"
          />
          <StatCard
            label="Restricted"
            value={count("restricted")}
            icon={Lock}
            color="#EAB308"
          />
          <StatCard
            label="Next Holiday"
            value={upcoming ? upcoming.name : "None"}
            sub={
              upcoming
                ? new Date(upcoming.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })
                : undefined
            }
            icon={CalendarClock}
            color="#00C48C"
          />
        </div>

        {loading && holidays.length === 0 ? (
          <div className="flex justify-center py-16">
            <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
          </div>
        ) : (
          <div className="border-2 border-black bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-[#024BAB]/5">
              <button
                onClick={() => shift(-1)}
                className="p-1.5 border-2 border-black bg-white hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center">
                <p className="font-bold text-lg">
                  {MONTHS[month]} {year}
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  {thisMonth} holiday{thisMonth !== 1 ? "s" : ""} this month
                </p>
              </div>
              <button
                onClick={() => shift(1)}
                className="p-1.5 border-2 border-black bg-white hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 border-b-2 border-black">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-bold uppercase text-gray-500"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                if (!d)
                  return (
                    <div
                      key={i}
                      className="min-h-20 border-r border-b border-black/10 bg-gray-50/50"
                    />
                  );
                const key = iso(year, month, d);
                const list = byDate.get(key) || [];
                const isToday = key === todayKey;
                const isSun = i % 7 === 0;
                return (
                  <button
                    key={i}
                    onClick={() => setDayModal(key)}
                    className={cn(
                      "min-h-20 p-1.5 text-left border-r border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors flex flex-col gap-1",
                      isSun && "bg-gray-50",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex w-6 h-6 items-center justify-center text-xs font-bold",
                        isToday && "bg-[#024BAB] text-white",
                        isSun && !isToday && "text-red-500",
                      )}
                    >
                      {d}
                    </span>
                    {list.slice(0, 2).map((h) => (
                      <span
                        key={h._id}
                        className={cn(
                          "text-[10px] font-bold px-1 py-0.5 border truncate",
                          TYPE_META[h.type].bg,
                          TYPE_META[h.type].border,
                          TYPE_META[h.type].text,
                          !h.isActive && "opacity-50",
                        )}
                      >
                        {h.name}
                      </span>
                    ))}
                    {list.length > 2 && (
                      <span className="text-[10px] font-bold text-gray-500">
                        +{list.length - 2} more
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 px-4 py-2 border-t-2 border-black text-xs font-bold">
              {(Object.keys(TYPE_META) as Holiday["type"][]).map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: TYPE_META[t].color }}
                  />
                  {TYPE_META[t].label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {dayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black bg-[#024BAB] text-white">
              <h3 className="font-bold">
                {new Date(dayModal + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <button onClick={closeDay}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              {dayHolidays.length === 0 ? (
                <p className="text-sm text-muted-foreground font-medium">
                  No holiday on this date.
                </p>
              ) : (
                <div className="space-y-2">
                  {dayHolidays.map((h) => (
                    <div
                      key={h._id}
                      className={cn(
                        "border-2 p-3 flex items-start gap-2",
                        TYPE_META[h.type].border,
                        TYPE_META[h.type].bg,
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-black">{h.name}</p>
                        <p
                          className={cn(
                            "text-[10px] font-bold uppercase",
                            TYPE_META[h.type].text,
                          )}
                        >
                          {TYPE_META[h.type].label}
                        </p>
                        {h.description && (
                          <p className="text-xs text-gray-600 mt-1">
                            {h.description}
                          </p>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(h)}
                            className="p-1.5 border border-gray-300 bg-white hover:border-black"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(h._id)}
                            className="p-1.5 border border-gray-300 bg-white hover:border-red-500 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canManage && (
                <div className="border-t-2 border-black pt-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB]">
                    {editingId ? "Edit holiday" : "Add holiday on this date"}
                  </p>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Holiday name, e.g. Republic Day"
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                  />
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
                      National - applies to everyone
                    </option>
                    <option value="optional">
                      Optional - employee can choose
                    </option>
                    <option value="restricted">
                      Restricted - limited to specific employees
                    </option>
                  </select>
                  <input
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Description (optional)"
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : editingId ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      {saving
                        ? "Saving..."
                        : editingId
                          ? "Save"
                          : "Add Holiday"}
                    </button>
                    {editingId && (
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setForm({
                            name: "",
                            type: "national",
                            description: "",
                          });
                        }}
                        className="border-2 border-black px-4 py-2 font-bold text-sm uppercase"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
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
