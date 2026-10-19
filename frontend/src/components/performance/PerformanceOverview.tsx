import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, Banknote, CalendarCheck, ListChecks, Trophy, Users } from "lucide-react";
import { performanceAPI } from "@/services/api";
import { StatCard } from "@/components/ui/StatCard";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { ProgressBar } from "@/components/performance/LiveMetricsTable";
import { cn, formatCurrency } from "@/lib/utils";

interface Row {
  _id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  designation?: string;
  department: string;
  salary: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  earlyLeaving: number;
  workHours: number;
  overtimeHours: number;
  leaveDays: number;
  attendancePct: number | null;
  tasksTotal: number;
  tasksDone: number;
  tasksLate: number;
  taskPct: number | null;
  hasLoan: boolean;
  loanCount: number;
  loanBalance: number;
  loanEmi: number;
  reviewRating: number | null;
  score: number | null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SPLIT = [
  { key: "present", label: "Present", color: "#00C48C" },
  { key: "late", label: "Late", color: "#EAB308" },
  { key: "halfDay", label: "Half Day", color: "#A855F7" },
  { key: "onLeave", label: "Leave", color: "#024BAB" },
  { key: "absent", label: "Absent", color: "#EF4444" },
] as const;

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const scoreColor = (s: number | null) => (s == null ? "#9CA3AF" : s >= 80 ? "#00C48C" : s >= 50 ? "#FA731C" : "#EF4444");

/** HR / admin view: month-wise performance of every active employee — stat cards, charts, then the detail table. */
export function PerformanceOverview() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");

  useEffect(() => {
    setLoading(true);
    performanceAPI
      .getOverview({ month: String(month), year: String(year) })
      .then((r: any) => setRows(r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [month, year]);

  const depts = useMemo(() => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(), [rows]);
  const shown = useMemo(
    () =>
      rows
        .filter((r) => !dept || r.department === dept)
        .filter((r) => !search || `${r.firstName} ${r.lastName} ${r.employeeCode}`.toLowerCase().includes(search.toLowerCase())),
    [rows, dept, search],
  );

  const top = [...shown].filter((r) => r.score != null).sort((a, b) => b.score! - a.score!);
  const needsAttention = shown.filter((r) => r.score != null && r.score < 50).length;
  const withLoan = shown.filter((r) => r.hasLoan);
  const split = SPLIT.map((s) => ({ ...s, value: shown.reduce((t, r) => t + (r as any)[s.key], 0) })).filter((s) => s.value > 0);
  const scoreBars = top.slice(0, 12).map((r) => ({ name: r.firstName, score: r.score }));
  const deptBars = depts
    .map((d) => ({ name: d, score: avg(shown.filter((r) => r.department === d).map((r) => r.score)) ?? 0 }))
    .filter((d) => shown.some((r) => r.department === d.name));

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-[#024BAB]" />
        <p className="text-xs font-bold text-black uppercase tracking-wider mr-auto">Employee Performance Overview</p>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border-2 border-black px-2 py-1.5 text-xs font-semibold bg-white">
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border-2 border-black px-2 py-1.5 text-xs font-semibold bg-white">
          {Array.from({ length: 4 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="border-2 border-black px-2 py-1.5 text-xs font-semibold bg-white">
          <option value="">All Departments</option>
          {depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground border-2 bg-white p-6">Loading performance data...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground border-2 bg-white p-6">No active employees to show.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
            <StatCard label="Employees" value={shown.length} icon={Users} color="#024BAB" />
            <StatCard label="Avg Score" value={`${avg(shown.map((r) => r.score)) ?? "—"}${avg(shown.map((r) => r.score)) != null ? "%" : ""}`} icon={Activity} color="#00C48C" />
            <StatCard label="Avg Attendance" value={`${avg(shown.map((r) => r.attendancePct)) ?? "—"}${avg(shown.map((r) => r.attendancePct)) != null ? "%" : ""}`} icon={CalendarCheck} color="#A855F7" />
            <StatCard label="Task Completion" value={`${avg(shown.map((r) => r.taskPct)) ?? "—"}${avg(shown.map((r) => r.taskPct)) != null ? "%" : ""}`} icon={ListChecks} color="#FA731C" />
            <StatCard
              label="Employees With Loan"
              value={withLoan.length}
              sub={withLoan.length ? `${formatCurrency(withLoan.reduce((t, r) => t + r.loanBalance, 0))} outstanding` : undefined}
              icon={Banknote}
              color="#EF4444"
            />
            <StatCard
              label="Top Performer"
              value={top[0] ? top[0].firstName : "—"}
              sub={top[0] ? `${top[0].score}% · ${needsAttention} need attention` : undefined}
              icon={needsAttention ? AlertTriangle : Trophy}
              color="#EAB308"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            <div className="border-2 border-black bg-white p-4 lg:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wider mb-2">Performance score by employee (top 12)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scoreBars}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" name="Score %" radius={0}>
                    {scoreBars.map((b, i) => (
                      <Cell key={i} fill={scoreColor(b.score)} stroke="#000" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="border-2 border-black bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-2">Attendance split</p>
              {split.length ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={split} dataKey="value" nameKey="label" innerRadius={38} outerRadius={64} stroke="#000">
                        {split.map((s) => (
                          <Cell key={s.key} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
                    {split.map((s) => (
                      <span key={s.key} className="flex items-center gap-1 text-[10px] font-bold">
                        <span className="w-2.5 h-2.5 border border-black" style={{ backgroundColor: s.color }} />
                        {s.label} {s.value}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-10 text-center">No attendance marked yet.</p>
              )}
            </div>
            {deptBars.length > 1 && (
              <div className="border-2 border-black bg-white p-4 lg:col-span-3">
                <p className="text-xs font-bold uppercase tracking-wider mb-2">Average score by department</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={deptBars}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="score" name="Avg score %" fill="#024BAB" stroke="#000" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="border-2 border-black bg-white">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b-2 border-black">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or code..."
                className="border-2 border-black px-3 py-1.5 text-xs font-medium flex-1 min-w-40 outline-none"
              />
              <ExportMenu
                name={`performance_${year}_${String(month).padStart(2, "0")}`}
                rows={shown}
                cols={[
                  { header: "Emp Code", value: (r) => r.employeeCode },
                  { header: "Employee", value: (r) => `${r.firstName} ${r.lastName}` },
                  { header: "Designation", value: (r) => r.designation },
                  { header: "Department", value: (r) => r.department },
                  { header: "Salary", value: (r) => r.salary },
                  { header: "Attendance %", value: (r) => r.attendancePct },
                  { header: "Present", value: (r) => r.present },
                  { header: "Late", value: (r) => r.late },
                  { header: "Half Day", value: (r) => r.halfDay },
                  { header: "Absent", value: (r) => r.absent },
                  { header: "Leave", value: (r) => r.leaveDays },
                  { header: "Early Leaving", value: (r) => r.earlyLeaving },
                  { header: "Work Hrs", value: (r) => r.workHours },
                  { header: "OT Hrs", value: (r) => r.overtimeHours },
                  { header: "Tasks Done", value: (r) => `${r.tasksDone}/${r.tasksTotal}` },
                  { header: "Task %", value: (r) => r.taskPct },
                  { header: "Loan Taken", value: (r) => (r.hasLoan ? "Yes" : "No") },
                  { header: "Loan Balance", value: (r) => r.loanBalance },
                  { header: "Review Rating", value: (r) => r.reviewRating },
                  { header: "Score %", value: (r) => r.score },
                ]}
              />
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="border-b-2 border-black bg-[#024BAB]/5">
                    {["Emp Code", "Employee", "Designation", "Salary", "Attendance", "P / L / H / A", "Leave", "Hours (OT)", "Tasks", "Loan", "Review", "Score"].map((h) => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...shown]
                    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
                    .map((r, i) => (
                      <tr key={r._id} className={cn("border-b border-black/10", i % 2 && "bg-[#F8FAFF]")}>
                        <td className="px-3 py-2.5 text-xs font-bold whitespace-nowrap">{r.employeeCode}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {r.avatar ? (
                              <img src={r.avatar} alt="" className="w-7 h-7 border-2 border-black rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 bg-[#024BAB] border-2 border-black rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                {r.firstName?.[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="font-bold text-xs whitespace-nowrap">
                              {r.firstName} {r.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs">{r.designation || "—"}</td>
                        <td className="px-3 py-2.5 text-xs font-bold whitespace-nowrap">{r.salary ? formatCurrency(r.salary) : "—"}</td>
                        <td className="px-3 py-2.5">
                          <ProgressBar value={r.attendancePct} />
                        </td>
                        <td className="px-3 py-2.5 text-xs font-bold whitespace-nowrap">
                          <span className="text-[#00C48C]">{r.present}</span> / <span className="text-[#B58900]">{r.late}</span> /{" "}
                          <span className="text-[#A855F7]">{r.halfDay}</span> / <span className="text-[#EF4444]">{r.absent}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs">{r.leaveDays ? `${r.leaveDays}d` : "—"}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {r.workHours}h{r.overtimeHours > 0 && <span className="text-[#FA731C] font-bold"> (+{r.overtimeHours})</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {r.tasksTotal ? (
                            <>
                              <span className="font-bold">
                                {r.tasksDone}/{r.tasksTotal}
                              </span>
                              {r.tasksLate > 0 && <span className="text-[#EF4444]"> · {r.tasksLate} late</span>}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {r.hasLoan ? (
                            <span className="font-bold text-[#EF4444]" title={`EMI ${formatCurrency(r.loanEmi)}`}>
                              {formatCurrency(r.loanBalance)}
                            </span>
                          ) : (
                            <span className="text-[#00C48C] font-bold">No</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-bold">{r.reviewRating != null ? `${r.reviewRating}/5` : "—"}</td>
                        <td className="px-3 py-2.5">
                          <ProgressBar value={r.score} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
