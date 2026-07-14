import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { performanceAPI, employeeAPI } from "@/services/api";
import { PerformanceReview, Employee } from "@/types/hrms";
import { cn } from "@/lib/utils";
import {
  Plus,
  TrendingUp,
  Star,
  X,
  Activity,
  CalendarCheck,
  ListChecks,
} from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { useAuth } from "@/contexts/AuthContext";
import { EmployeeCombobox } from "@/components/employees/EmployeeCombobox";

type LiveMetrics = {
  employeeId?: string;
  firstName: string;
  lastName: string;
  attendancePct: number | null;
  taskPct: number | null;
  score: number | null;
  presentDays: number;
  totalTasks: number;
  completedTasks: number;
};

function scoreColor(score: number | null) {
  if (score == null) return "bg-gray-100 text-gray-500 border-black/20";
  if (score >= 80) return "bg-[#00C48C]/10 text-[#00815A] border-[#00C48C]";
  if (score >= 50) return "bg-[#FA731C]/10 text-[#B5540E] border-[#FA731C]";
  return "bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]";
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
  in_review: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  completed: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
};

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            "w-3.5 h-3.5",
            s <= value
              ? "fill-[#FA731C] text-[#FA731C]"
              : "text-muted-foreground",
          )}
        />
      ))}
    </div>
  );
}

export default function PerformancePage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";
  const confirm = useConfirm();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveMetrics, setLiveMetrics] = useState<
    LiveMetrics | LiveMetrics[] | null
  >(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    employee: "",
    reviewPeriod: "",
    year: String(new Date().getFullYear()),
    reviewType: "annual",
    overallRating: "",
    strengths: "",
    areasOfImprovement: "",
    status: "draft",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [revRes, empRes] = await Promise.all([
        performanceAPI.getAll(),
        employeeAPI.getAll({ status: "active", limit: "200" }),
      ]);
      if (revRes.success) setReviews(revRes.data);
      if (empRes.success) setEmployees(empRes.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const now = new Date();
    performanceAPI
      .getLive({
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
      })
      .then((r: any) => {
        if (r.success) setLiveMetrics(r.data);
      })
      .catch(() => {})
      .finally(() => setLiveLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await confirm({
      title: "Create performance review?",
      description:
        "This will create a new performance review for the selected employee.",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await performanceAPI.create({
        ...form,
        year: Number(form.year),
        overallRating: Number(form.overallRating) || undefined,
      });
      setShowModal(false);
      load();
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await performanceAPI.update(id, { status });
      load();
    } catch {}
  };

  return (
    <AppLayout title="Performance">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm font-medium text-muted-foreground">
          {reviews.length} review{reviews.length !== 1 ? "s" : ""} ·{" "}
          {reviews.filter((r) => r.status === "completed").length} completed
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New Review
        </button>
      </div>

      {/* Live performance — auto-computed from this month's attendance + tasks */}
      <div className="border-2 bg-white p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-[#024BAB]" />
          <p className="text-xs font-bold text-black uppercase tracking-wider">
            Live Performance — This Month
          </p>
        </div>

        {liveLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : isEmployee ? (
          liveMetrics && !Array.isArray(liveMetrics) ? (
            <div className="flex flex-wrap items-center gap-4">
              <div
                className={cn(
                  "border-2 px-4 py-2 font-display font-bold text-2xl shrink-0",
                  scoreColor(liveMetrics.score),
                )}
              >
                {liveMetrics.score != null ? `${liveMetrics.score}%` : "—"}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarCheck className="w-3.5 h-3.5" />
                Attendance:{" "}
                <span className="font-bold text-black">
                  {liveMetrics.attendancePct != null
                    ? `${liveMetrics.attendancePct}%`
                    : "No data"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ListChecks className="w-3.5 h-3.5" />
                Tasks:{" "}
                <span className="font-bold text-black">
                  {liveMetrics.totalTasks > 0
                    ? `${liveMetrics.completedTasks}/${liveMetrics.totalTasks} done`
                    : "None assigned"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No data yet this month.
            </p>
          )
        ) : Array.isArray(liveMetrics) && liveMetrics.length > 0 ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black">
                  {["Employee", "Score", "Attendance", "Tasks"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...liveMetrics]
                  .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
                  .map((m) => (
                    <tr key={m.employeeId} className="border-b border-black/10">
                      <td className="px-3 py-2 text-xs font-bold text-black">
                        {m.firstName} {m.lastName}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "border-2 px-2 py-0.5 text-xs font-bold",
                            scoreColor(m.score),
                          )}
                        >
                          {m.score != null ? `${m.score}%` : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-black">
                        {m.attendancePct != null ? `${m.attendancePct}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-black">
                        {m.totalTasks > 0
                          ? `${m.completedTasks}/${m.totalTasks}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No employees to show.</p>
        )}
      </div>

      {}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            label: "Draft",
            count: reviews.filter((r) => r.status === "draft").length,
            bg: "bg-white",
            textBg: "bg-black/10",
          },
          {
            label: "In Review",
            count: reviews.filter((r) => r.status === "in_review").length,
            bg: "bg-[#FA731C]",
            textBg: "bg-white",
          },
          {
            label: "Completed",
            count: reviews.filter((r) => r.status === "completed").length,
            bg: "bg-[#024BAB]",
            textBg: "bg-white",
          },
        ].map(({ label, count, bg, textBg }) => (
          <div
            key={label}
            className="border-2 bg-white p-4 flex items-center gap-3"
          >
            <div
              className={cn(
                "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
                bg,
              )}
            >
              <TrendingUp
                className={cn(
                  "w-5 h-5",
                  textBg === "bg-white" ? "text-white" : "text-black",
                )}
              />
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-black">
                {count}
              </p>
              <p className="text-xs font-bold text-muted-foreground uppercase">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No performance reviews yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm mt-4"
          >
            Create First Review
          </button>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Period",
                  "Year",
                  "Type",
                  "Rating",
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
              {reviews.map((rev, i) => (
                <tr
                  key={rev._id}
                  className={cn(
                    "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {(rev.employee as any)?.avatar ? (
                        <img
                          src={(rev.employee as any).avatar}
                          alt={(rev.employee as any)?.firstName}
                          className="w-7 h-7 border-2 border-black object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {(rev.employee as any)?.firstName?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-black text-xs">
                          {(rev.employee as any)?.firstName}{" "}
                          {(rev.employee as any)?.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(rev.employee as any)?.designation}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-black">
                    {rev.reviewPeriod}
                  </td>
                  <td className="px-4 py-3 text-xs text-black">{rev.year}</td>
                  <td className="px-4 py-3 text-xs capitalize text-black">
                    {rev.reviewType.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3">
                    {rev.overallRating ? (
                      <StarRating value={rev.overallRating} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Not rated
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "border-2 text-[10px] capitalize",
                        STATUS_COLORS[rev.status],
                      )}
                    >
                      {rev.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {rev.status === "draft" && (
                        <button
                          onClick={() => handleStatus(rev._id, "in_review")}
                          className="text-xs font-bold border-2 border-black px-2 py-1 hover:bg-[#FA731C] hover:text-white transition-colors"
                        >
                          Start Review
                        </button>
                      )}
                      {rev.status === "in_review" && (
                        <button
                          onClick={() => handleStatus(rev._id, "completed")}
                          className="text-xs font-bold border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">
                New Performance Review
              </h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Employee
                </label>
                <EmployeeCombobox
                  employees={employees}
                  value={form.employee}
                  onChange={(id) => setForm({ ...form, employee: id })}
                  className="border-2 w-full px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Review Period
                  </label>
                  <input
                    value={form.reviewPeriod}
                    onChange={(e) =>
                      setForm({ ...form, reviewPeriod: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                    placeholder="e.g. Q1 2026"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    className="border-2 w-full px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Review Type
                  </label>
                  <select
                    value={form.reviewType}
                    onChange={(e) =>
                      setForm({ ...form, reviewType: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="annual">Annual</option>
                    <option value="half_yearly">Half Yearly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="probation">Probation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Overall Rating (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={form.overallRating}
                    onChange={(e) =>
                      setForm({ ...form, overallRating: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Strengths
                </label>
                <textarea
                  value={form.strengths}
                  onChange={(e) =>
                    setForm({ ...form, strengths: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Key strengths..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Areas of Improvement
                </label>
                <textarea
                  value={form.areasOfImprovement}
                  onChange={(e) =>
                    setForm({ ...form, areasOfImprovement: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Areas to improve..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  {saving ? "Creating..." : "Create Review"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
