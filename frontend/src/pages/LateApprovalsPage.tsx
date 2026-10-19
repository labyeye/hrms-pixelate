import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { lateApprovalAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { DateStrip } from "@/components/ui/DateStrip";
import {
  AlarmClock,
  CheckCircle,
  Clock3,
  XCircle,
  Timer,
  Hourglass,
  BadgeCheck,
  X,
} from "lucide-react";

interface LateApproval {
  _id: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    designation?: string;
    salary?: number;
    avatar?: string;
  };
  date: string;
  checkInTime?: string;
  minutesLate: number;
  reason?: string;
  status: string; // pending | approved (= marked)
  resolvedStatus?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ACTIONS: { status: string; label: string; icon: any; className: string }[] = [
  { status: "present", label: "Present", icon: CheckCircle, className: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] hover:bg-[#00C48C]/20" },
  { status: "late", label: "Late", icon: Clock3, className: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] hover:bg-[#FA731C]/20" },
  { status: "half_day", label: "Half Day", icon: Timer, className: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB] hover:bg-[#024BAB]/20" },
  { status: "absent", label: "Absent", icon: XCircle, className: "bg-red-50 text-red-600 border-red-600 hover:bg-red-100" },
];
const LABEL: Record<string, string> = { present: "Present", late: "Late", half_day: "Half Day", absent: "Absent" };

// Use LOCAL date so IST midnight stored as UTC doesn't shift the day
const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function LateApprovalsPage() {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [items, setItems] = useState<LateApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lateApprovalAPI.getAll({ month: String(month), year: String(year) });
      setItems(res.data ?? []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setSelectedDate(null), [month, year]);

  const resolve = async (id: string, resolvedStatus: string) => {
    setResolvingId(id);
    try {
      await lateApprovalAPI.resolve(id, resolvedStatus);
      toast({ title: "Marked", description: `Marked as ${LABEL[resolvedStatus]}`, variant: "success" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setResolvingId(null);
    }
  };

  // records belonging to the visible month (server sends +-1 day slack)
  const inMonth = items.filter((i) => localDate(i.date).startsWith(`${year}-${String(month).padStart(2, "0")}`));
  const shown = selectedDate ? inMonth.filter((i) => localDate(i.date) === selectedDate) : inMonth;

  const count = (f: (i: LateApproval) => boolean) => shown.filter(f).length;
  const cards = [
    { label: "Pending", value: count((i) => i.status === "pending"), icon: Hourglass, color: "#FA731C" },
    { label: "Marked", value: count((i) => i.status !== "pending"), icon: BadgeCheck, color: "#024BAB" },
    { label: "Present", value: count((i) => i.resolvedStatus === "present"), icon: CheckCircle, color: "#00C48C" },
    { label: "Late", value: count((i) => i.resolvedStatus === "late"), icon: Clock3, color: "#EAB308" },
    { label: "Half Day", value: count((i) => i.resolvedStatus === "half_day"), icon: Timer, color: "#A855F7" },
    { label: "Absent", value: count((i) => i.resolvedStatus === "absent"), icon: XCircle, color: "#EF4444" },
  ];

  const badges = (iso: string) => {
    const day = inMonth.filter((i) => localDate(i.date) === iso);
    const pending = day.filter((i) => i.status === "pending").length;
    const marked = day.length - pending;
    return [
      ...(pending ? [{ text: `${pending} pending`, color: "#FA731C" }] : []),
      ...(marked ? [{ text: `${marked} marked`, color: "#00C48C" }] : []),
    ];
  };

  return (
    <AppLayout title="Late Approvals">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display font-bold text-3xl text-black">Late Approvals</h1>
          <p className="text-gray-600 font-medium mt-1">
            Employees who exceeded their monthly late allowance — set the final attendance status for each record.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="border-2 border-black px-3 py-2 text-xs font-bold bg-white hover:bg-gray-50 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear date
            </button>
          )}
          <ExportMenu
            name={`late_approvals_${year}_${String(month).padStart(2, "0")}`}
            rows={shown}
            cols={[
              { header: "Emp Code", value: (i) => i.employee?.employeeId },
              { header: "Employee", value: (i) => `${i.employee?.firstName || ""} ${i.employee?.lastName || ""}`.trim() },
              { header: "Designation", value: (i) => i.employee?.designation },
              { header: "Salary", value: (i) => i.employee?.salary ?? "" },
              { header: "Late Date", value: (i) => localDate(i.date) },
              { header: "Minutes Late", value: (i) => i.minutesLate },
              { header: "Reason", value: (i) => i.reason },
              { header: "Status", value: (i) => (i.status === "pending" ? "Pending" : `Marked - ${LABEL[i.resolvedStatus || ""] || ""}`) },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} color={c.color} />
        ))}
      </div>

      <DateStrip year={year} month={month} selected={selectedDate} onSelect={setSelectedDate} badges={badges} />

      {loading ? (
        <div className="flex justify-center py-20">
          <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
        </div>
      ) : shown.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <AlarmClock className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No late approvals {selectedDate ? "on this date" : "this month"}</p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {["Emp Code", "Employee", "Designation", "Salary", "Late Date", "Min Late", "Reason", "Status", "Action"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((item, i) => (
                <tr key={item._id} className={cn("border-b border-black/10", i % 2 ? "bg-[#F8FAFF]" : "")}>
                  <td className="px-3 py-3 text-xs font-bold whitespace-nowrap">{item.employee?.employeeId}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {item.employee?.avatar ? (
                        <img src={item.employee.avatar} alt="" className="w-7 h-7 border-2 border-black object-cover rounded-full shrink-0" />
                      ) : (
                        <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white rounded-full shrink-0">
                          {item.employee?.firstName?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <p className="font-bold text-black text-xs whitespace-nowrap">
                        {item.employee?.firstName} {item.employee?.lastName}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs">{item.employee?.designation || "—"}</td>
                  <td className="px-3 py-3 text-xs font-bold whitespace-nowrap">
                    {item.employee?.salary ? formatCurrency(item.employee.salary) : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">{formatDate(item.date)}</td>
                  <td className="px-3 py-3 text-xs font-bold whitespace-nowrap">{item.minutesLate} min</td>
                  <td className="px-3 py-3 text-xs max-w-48">{item.reason || "—"}</td>
                  <td className="px-3 py-3">
                    {item.status === "pending" ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 border-2 border-[#FA731C] text-[#FA731C] bg-[#FA731C]/10">
                        Pending
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 border-2 border-[#00C48C] text-[#00C48C] bg-[#00C48C]/10 whitespace-nowrap">
                        Marked · {LABEL[item.resolvedStatus || ""] || "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {ACTIONS.map((a) => (
                        <button
                          key={a.status}
                          disabled={resolvingId === item._id || item.resolvedStatus === a.status}
                          onClick={() => resolve(item._id, a.status)}
                          className={cn(
                            "flex items-center gap-1 border-2 px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-40",
                            a.className,
                          )}
                        >
                          <a.icon className="w-3 h-3" />
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
