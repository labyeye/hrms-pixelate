import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  employeeAPI,
  attendanceAPI,
  leaveAPI,
  payrollAPI,
  performanceAPI,
} from "@/services/api";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import {
  Calendar,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  Loader2,
  User,
  MapPin,
  Phone,
  Mail,
  Shield,
  CreditCard,
  Briefcase,
  Star,
  TrendingUp,
} from "lucide-react";

interface AttendanceStats {
  presentDays: number;
  absentDays: number;
  totalDays: number;
  attendancePercentage: number;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="nb-card bg-white mb-6">
      <div className="px-5 py-3 border-b-2 border-black bg-[#024BAB]/5">
        <h3 className="font-bold text-black text-sm uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b border-black/10 last:border-0">
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider w-44 shrink-0">
        {label}
      </span>
      <span className="text-sm font-medium text-black">{value || "—"}</span>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  // computed from recentAttendance records
  const [leaves, setLeaves] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) loadEmployeeData();
  }, [user?.email]);

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      if (!user?.email) return;

      const empRes = await employeeAPI.getAll({ search: user.email });
      if (empRes.success && empRes.data.length > 0) {
        const emp = empRes.data[0];
        setEmployee(emp);

        await Promise.allSettled([
          attendanceAPI
            .getAll({ employeeId: emp._id, limit: "60" })
            .then((r) => {
              if (r.success) {
                const records: any[] = r.data;
                setRecentAttendance(records.slice(0, 10));
                const present = records.filter(
                  (x) => x.status === "present" || x.status === "late",
                ).length;
                const absent = records.filter(
                  (x) => x.status === "absent",
                ).length;
                const total = records.length;
                setAttendance({
                  presentDays: present,
                  absentDays: absent,
                  totalDays: total,
                  attendancePercentage: total ? (present / total) * 100 : 0,
                });
              }
            })
            .catch(() => {}),
          leaveAPI
            .getAll({ employeeId: emp._id })
            .then((r) => r.success && setLeaves(r.data))
            .catch(() => {}),
          payrollAPI
            .getAll({ employeeId: emp._id, limit: "4" })
            .then((r) => r.success && setPayrolls(r.data))
            .catch(() => {}),
          performanceAPI
            .getAll({ employeeId: emp._id })
            .then((r) => r.success && setPerformance(r.data))
            .catch(() => {}),
        ]);
      }
    } catch (err) {
      console.error("Error loading employee data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="My Profile">
        <div className="flex h-[80vh] items-center justify-center">
          <div className="w-10 h-10 bg-[#024BAB] border-2 border-black nb-shadow animate-bounce flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!employee) {
    return (
      <AppLayout title="My Profile">
        <div className="nb-card bg-white p-12 flex flex-col items-center justify-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No employee record found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your HR manager to link your account
          </p>
        </div>
      </AppLayout>
    );
  }

  const leaveStatusColor: Record<string, string> = {
    approved: "bg-[#00C48C] text-white",
    pending: "bg-[#FA731C] text-white",
    rejected: "bg-[#EF4444] text-white",
    cancelled: "bg-gray-400 text-white",
  };

  const payrollStatusColor: Record<string, string> = {
    paid: "bg-[#00C48C] text-white",
    processed: "bg-[#024BAB] text-white",
    draft: "bg-gray-300 text-black",
  };

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    <AppLayout title="My Profile">
      {/* Hero Banner */}
      <div className="nb-card bg-[#024BAB] p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-20 h-20 border-2 border-white bg-white flex items-center justify-center text-3xl font-bold text-[#024BAB] shrink-0">
          {employee.avatar ? (
            <img
              src={employee.avatar}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            employee.firstName?.[0]?.toUpperCase()
          )}
        </div>
        <div className="flex-1 text-white">
          <h1 className="text-2xl font-display font-bold">
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-sm opacity-80">
            {employee.designation} · {employee.department?.name || "—"}
          </p>
          <p className="text-xs opacity-60 mt-1">{employee.employeeId}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="bg-white/10 border border-white/30 px-4 py-2 text-center">
            <p className="text-xs text-white/70 uppercase tracking-wider">
              Status
            </p>
            <p className="text-sm font-bold text-white mt-1 capitalize">
              {employee.status}
            </p>
          </div>
          <div className="bg-white/10 border border-white/30 px-4 py-2 text-center">
            <p className="text-xs text-white/70 uppercase tracking-wider">
              Monthly CTC
            </p>
            <p className="text-sm font-bold text-white mt-1">
              {formatCurrency(Math.round((employee.salary || 0) / 12))}
            </p>
          </div>
          <div className="bg-white/10 border border-white/30 px-4 py-2 text-center">
            <p className="text-xs text-white/70 uppercase tracking-wider">
              Joined
            </p>
            <p className="text-sm font-bold text-white mt-1">
              {formatDate(employee.joinDate)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-1 space-y-6">
          {/* Personal Info */}
          <Section title="Personal Information">
            <InfoRow
              label="Full Name"
              value={`${employee.firstName} ${employee.lastName}`}
            />
            <InfoRow
              label="Date of Birth"
              value={
                employee.dateOfBirth ? formatDate(employee.dateOfBirth) : null
              }
            />
            <InfoRow
              label="Gender"
              value={
                employee.gender
                  ? employee.gender.charAt(0).toUpperCase() +
                    employee.gender.slice(1)
                  : null
              }
            />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Phone" value={employee.phone} />
            <InfoRow
              label="Emergency Contact"
              value={employee.emergencyContact}
            />
          </Section>

          {/* Work Info */}
          <Section title="Work Information">
            <InfoRow label="Employee ID" value={employee.employeeId} />
            <InfoRow label="Department" value={employee.department?.name} />
            <InfoRow label="Designation" value={employee.designation} />
            <InfoRow
              label="Employment Type"
              value={employee.employmentType?.replace(/_/g, " ")}
            />
            <InfoRow label="Join Date" value={formatDate(employee.joinDate)} />
            {employee.reportingTo && (
              <InfoRow
                label="Reports To"
                value={`${employee.reportingTo.firstName} ${employee.reportingTo.lastName}`}
              />
            )}
          </Section>

          {/* Address */}
          <Section title="Address & Identity">
            <InfoRow label="Address" value={employee.address} />
            <InfoRow label="PAN Number" value={employee.panNumber} />
            {employee.bankAccount && (
              <InfoRow
                label="Bank Account"
                value={`****${employee.bankAccount.slice(-4)}`}
              />
            )}
            {employee.ifscCode && (
              <InfoRow label="IFSC Code" value={employee.ifscCode} />
            )}
          </Section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* Attendance Summary */}
          {attendance && (
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: "Present Days",
                  value: attendance.presentDays,
                  color: "bg-[#00C48C]",
                  symbol: "✓",
                },
                {
                  label: "Absent Days",
                  value: attendance.absentDays,
                  color: "bg-[#EF4444]",
                  symbol: "✕",
                },
                {
                  label: "Attendance %",
                  value: `${attendance.attendancePercentage.toFixed(1)}%`,
                  color: "bg-[#024BAB]",
                  symbol: "%",
                },
              ].map(({ label, value, color, symbol }) => (
                <div key={label} className="nb-card bg-white p-4">
                  <div
                    className={cn(
                      "w-8 h-8 border-2 border-black flex items-center justify-center text-sm font-bold text-white mb-2",
                      color,
                    )}
                  >
                    {symbol}
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">
                    {label}
                  </p>
                  <p className="text-2xl font-bold text-black mt-1">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recent Attendance */}
          {recentAttendance.length > 0 && (
            <Section title="Recent Attendance">
              <div className="overflow-auto -mx-5 -mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-black bg-[#024BAB]/5">
                      {["Date", "Status", "Check In", "Check Out", "Hours"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-2 text-left text-xs font-bold text-black uppercase"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendance.map((rec, i) => (
                      <tr
                        key={rec._id}
                        className={cn(
                          "border-b border-black/10",
                          i % 2 !== 0 && "bg-[#F8FAFF]",
                        )}
                      >
                        <td className="px-4 py-2 font-medium text-black">
                          {formatDate(rec.date)}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 text-xs font-bold border-2 border-black",
                              rec.status === "present"
                                ? "bg-[#00C48C] text-white"
                                : rec.status === "late"
                                  ? "bg-[#FA731C] text-white"
                                  : "bg-[#EF4444] text-white",
                            )}
                          >
                            {rec.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-black">
                          {rec.checkIn
                            ? new Date(rec.checkIn).toLocaleTimeString(
                                "en-IN",
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-black">
                          {rec.checkOut
                            ? new Date(rec.checkOut).toLocaleTimeString(
                                "en-IN",
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-black">
                          {rec.workHours ? `${rec.workHours}h` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Leave Records */}
          <Section title={`Leave Records (${leaves.length})`}>
            {leaves.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No leave records found
              </p>
            ) : (
              <div className="space-y-2">
                {leaves.map((lv) => (
                  <div
                    key={lv._id}
                    className="flex items-center justify-between border-2 border-black p-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-black capitalize">
                        {lv.leaveType?.replace("_", " ")} Leave
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(lv.startDate)} → {formatDate(lv.endDate)} ·{" "}
                        {lv.days} day{lv.days > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 italic">
                        "{lv.reason}"
                      </p>
                    </div>
                    <span
                      className={cn(
                        "px-2 py-1 text-xs font-bold border-2 border-black shrink-0",
                        leaveStatusColor[lv.status] || "bg-gray-200",
                      )}
                    >
                      {lv.status?.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Payroll */}
          <Section title="Payroll History">
            {payrolls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No payroll records found
              </p>
            ) : (
              <div className="overflow-auto -mx-5 -mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-black bg-[#024BAB]/5">
                      {[
                        "Month",
                        "Gross",
                        "Deductions",
                        "Net Pay",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2 text-left text-xs font-bold text-black uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payrolls.map((p, i) => (
                      <tr
                        key={p._id}
                        className={cn(
                          "border-b border-black/10",
                          i % 2 !== 0 && "bg-[#F8FAFF]",
                        )}
                      >
                        <td className="px-4 py-2 font-bold text-black">
                          {monthNames[(p.month || 1) - 1]} {p.year}
                        </td>
                        <td className="px-4 py-2 text-black">
                          {formatCurrency(p.grossSalary)}
                        </td>
                        <td className="px-4 py-2 text-[#EF4444]">
                          -{formatCurrency(p.totalDeductions)}
                        </td>
                        <td className="px-4 py-2 font-bold text-[#00C48C]">
                          {formatCurrency(p.netSalary)}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 text-xs font-bold border-2 border-black",
                              payrollStatusColor[p.status] || "bg-gray-200",
                            )}
                          >
                            {p.status?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Performance */}
          {performance.length > 0 && (
            <Section title="Performance Reviews">
              <div className="space-y-4">
                {performance.map((rev) => (
                  <div key={rev._id} className="border-2 border-black p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-black">
                          {rev.reviewPeriod}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {rev.reviewType?.replace("_", " ")} Review
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "w-4 h-4",
                                i < Math.round(rev.overallRating)
                                  ? "text-[#FA731C] fill-[#FA731C]"
                                  : "text-gray-300",
                              )}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rev.overallRating}/5
                        </p>
                      </div>
                    </div>
                    {rev.goals?.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {rev.goals.map((g: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-sm bg-[#F8FAFF] px-3 py-2 border border-black/10"
                          >
                            <div>
                              <span className="font-medium text-black">
                                {g.title}
                              </span>
                              {g.achieved && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  → {g.achieved}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              {Array.from({ length: 5 }).map((_, j) => (
                                <Star
                                  key={j}
                                  className={cn(
                                    "w-3 h-3",
                                    j < (g.rating || 0)
                                      ? "text-[#FA731C] fill-[#FA731C]"
                                      : "text-gray-300",
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {rev.strengths && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-bold text-black">Strengths:</span>{" "}
                        {rev.strengths}
                      </p>
                    )}
                    {rev.reviewerComments && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-bold text-black">Manager:</span>{" "}
                        {rev.reviewerComments}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
