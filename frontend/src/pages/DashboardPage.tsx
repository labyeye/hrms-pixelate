import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { dashboardAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  Clock,
  CalendarDays,
  DollarSign,
  Briefcase,
  Building2,
  ArrowUpRight,
  TrendingUp,
  Users2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  bg,
  iconColor = "text-white",
  trend,
  to,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  bg: string;
  iconColor?: string;
  trend?: "up" | "down";
  to?: string;
}) {
  const inner = (
    <div className="nb-card p-4 flex flex-col gap-3 nb-card-hover bg-white">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
            bg,
          )}
        >
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 border-2 border-black nb-shadow-sm bg-[#A3E635] text-black">
            <ArrowUpRight className="w-3 h-3" />
          </span>
        )}
      </div>
      <div>
        <p className="font-display font-bold text-3xl text-black">{value}</p>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
          {title}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

const DEPT_COLORS = [
  "#024BAB",
  "#FA731C",
  "#00C48C",
  "#A855F7",
  "#EF4444",
  "#FFD60A",
];

const NbTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-black nb-shadow-sm px-3 py-2 text-xs">
      <p className="font-bold text-black mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 border border-black shrink-0"
            style={{ background: p.color }}
          />
          <span className="font-bold text-black capitalize">
            {p.name}: {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI
      .getStats()
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex h-[80vh] items-center justify-center">
          <div className="w-10 h-10 bg-[#024BAB] border-2 border-black nb-shadow animate-bounce flex items-center justify-center">
            <Users2 className="w-5 h-5 text-white" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const { stats, recentHires, pendingLeaveList, deptHeadcounts } = data;

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Good morning"
      : greetingHour < 17
        ? "Good afternoon"
        : "Good evening";

  return (
    <AppLayout title="Dashboard">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            {greeting}, {user?.name?.split(" ")[0]} 👋
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Here's your HR overview for today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/employees">
            <button className="nb-btn bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Employees
            </button>
          </Link>
          <Link to="/leave">
            <button className="nb-btn bg-[#FA731C] text-white px-4 py-2 text-sm flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" /> Leave Requests
            </button>
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {stats.pendingLeaves > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 p-3 border-2 border-[#FA731C] bg-[#FA731C]/5 nb-shadow-sm">
          <span className="text-xs font-bold text-[#FA731C] uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Action needed
          </span>
          <Link to="/leave">
            <span className="nb-badge nb-tag-orange flex items-center gap-1 text-[11px]">
              <CalendarDays className="w-3 h-3" /> {stats.pendingLeaves} leave
              requests pending
            </span>
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard
          title="Total Employees"
          value={stats.totalEmployees}
          sub={`${stats.activeEmployees} active`}
          icon={Users}
          bg="bg-[#024BAB]"
          to="/employees"
        />
        <KpiCard
          title="Today's Attendance"
          value={`${stats.attendanceRate}%`}
          sub={`${stats.todayPresent} present`}
          icon={Clock}
          bg="bg-[#FA731C]"
          to="/attendance"
        />
        <KpiCard
          title="Pending Leaves"
          value={stats.pendingLeaves}
          sub="Awaiting approval"
          icon={CalendarDays}
          bg="bg-[#024BAB]"
          to="/leave"
        />
        <KpiCard
          title="New Hires"
          value={stats.newHires}
          sub="This month"
          icon={TrendingUp}
          bg="bg-[#A3E635]"
          iconColor="text-black"
          to="/employees"
          trend="up"
        />
        <KpiCard
          title="Monthly Payroll"
          value={formatCurrency(stats.monthlyPayroll)}
          sub="Paid this month"
          icon={DollarSign}
          bg="bg-[#FA731C]"
          to="/payroll"
        />
        <KpiCard
          title="Open Positions"
          value={stats.openPositions}
          sub="Active job listings"
          icon={Briefcase}
          bg="bg-[#024BAB]"
          to="/recruitment"
        />
        <KpiCard
          title="Departments"
          value={stats.departments}
          sub="Active teams"
          icon={Building2}
          bg="bg-[#00C48C]"
          to="/departments"
        />
        <KpiCard
          title="Attendance Rate"
          value={`${stats.attendanceRate}%`}
          sub="Team health"
          icon={CheckCircle2}
          bg="bg-[#024BAB]"
          to="/attendance"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        {/* Department headcount */}
        <div className="lg:col-span-2 nb-card bg-white p-5">
          <h3 className="font-display font-bold text-base text-black mb-1">
            Headcount by Dept
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Active employees per department
          </p>
          {deptHeadcounts?.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={deptHeadcounts}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="name"
                    stroke="#0A0A0A"
                    strokeWidth={2}
                  >
                    {deptHeadcounts.map((_: any, i: number) => (
                      <Cell
                        key={i}
                        fill={DEPT_COLORS[i % DEPT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {deptHeadcounts.map((d: any, i: number) => (
                  <span
                    key={d.name}
                    className="flex items-center gap-1 text-[11px] font-bold text-black"
                  >
                    <span
                      className="w-2.5 h-2.5 border border-black shrink-0"
                      style={{
                        background: DEPT_COLORS[i % DEPT_COLORS.length],
                      }}
                    />
                    {d.name} ({d.count})
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm font-bold">
              No data yet
            </div>
          )}
        </div>

        {/* Attendance chart placeholder */}
        <div className="lg:col-span-3 nb-card bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-base text-black">
                Attendance Overview
              </h3>
              <p className="text-xs text-muted-foreground">Weekly breakdown</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart
              data={[
                { day: "Mon", present: stats.todayPresent || 0, absent: 5 },
                { day: "Tue", present: stats.todayPresent || 0, absent: 3 },
                { day: "Wed", present: stats.todayPresent || 0, absent: 4 },
                { day: "Thu", present: stats.todayPresent || 0, absent: 2 },
                { day: "Fri", present: stats.todayPresent || 0, absent: 6 },
              ]}
              barGap={4}
              barCategoryGap="30%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E5E7EB"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<NbTooltip />} cursor={{ fill: "#024BAB22" }} />
              <Bar
                dataKey="present"
                name="Present"
                fill="#024BAB"
                stroke="#0A0A0A"
                strokeWidth={2}
              />
              <Bar
                dataKey="absent"
                name="Absent"
                fill="#FA731C"
                stroke="#0A0A0A"
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent hires */}
        <div className="nb-card bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-bold text-base text-black">
                Recent Hires
              </h3>
              <p className="text-xs text-muted-foreground">
                {stats.newHires} new this month
              </p>
            </div>
            <Link to="/employees">
              <button className="text-xs font-bold text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors nb-shadow-sm">
                View all →
              </button>
            </Link>
          </div>
          {recentHires?.length > 0 ? (
            <div className="space-y-2">
              {recentHires.slice(0, 5).map((emp: any) => (
                <Link key={emp._id} to="/employees">
                  <div className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-black hover:nb-shadow-sm transition-all">
                    <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {emp.firstName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-black truncate">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emp.designation} · {emp.department?.name}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-36 text-center text-muted-foreground">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm font-bold">No new hires this month</p>
            </div>
          )}
        </div>

        {/* Pending leaves */}
        <div className="nb-card bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-bold text-base text-black">
                Pending Leave Requests
              </h3>
              <p className="text-xs text-muted-foreground">
                {stats.pendingLeaves} awaiting action
              </p>
            </div>
            <Link to="/leave">
              <button className="text-xs font-bold text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors nb-shadow-sm">
                Manage →
              </button>
            </Link>
          </div>
          {pendingLeaveList?.length > 0 ? (
            <div className="space-y-2">
              {pendingLeaveList.slice(0, 5).map((leave: any) => (
                <Link key={leave._id} to="/leave">
                  <div className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-black hover:nb-shadow-sm transition-all">
                    <div className="w-8 h-8 bg-[#FA731C] border-2 border-black flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {leave.employee?.firstName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-black truncate">
                        {leave.employee?.firstName} {leave.employee?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate capitalize">
                        {leave.leaveType} · {leave.days} day
                        {leave.days > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="nb-badge nb-tag-orange text-[10px]">
                      Pending
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-36 text-center">
              <CheckCircle2 className="w-8 h-8 mb-2 text-[#00C48C]" />
              <p className="text-sm font-bold text-black">All clear!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No pending leave requests
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
