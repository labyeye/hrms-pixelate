import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  employeeAPI,
  attendanceAPI,
  payrollAPI,
  departmentAPI,
  leaveAPI,
} from "@/services/api";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import {
  Users,
  Clock,
  DollarSign,
  Download,
  Printer,
  Filter,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
  ChevronDown,
  CalendarDays,
} from "lucide-react";

const MONTHS = [
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

type Tab = "attendance" | "employee" | "payroll" | "leave";

// ─── helpers ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="nb-card bg-white p-4">
      <div
        className={cn(
          "w-8 h-8 border-2 border-black flex items-center justify-center mb-2 text-white text-xs font-bold",
          color,
        )}
      >
        {label[0]}
      </div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-black mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none border-2 border-black px-3 py-2 pr-8 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
    </div>
  );
}

function PrintButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white hover:bg-[#F8FAFF] nb-shadow transition-all"
    >
      <Printer className="w-4 h-4" /> Print
    </button>
  );
}

function ExportCSVButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white hover:bg-[#0239a0] nb-shadow transition-all"
    >
      <Download className="w-4 h-4" /> Export CSV
    </button>
  );
}

function exportCSV(rows: string[][], filename: string) {
  const csv = rows
    .map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printSection(id: string, title: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: sans-serif; font-size: 12px; margin: 20px; }
      h2 { font-size: 16px; margin-bottom: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
      th { background: #f0f6ff; font-weight: bold; }
      tr:nth-child(even) { background: #f9f9f9; }
      .badge { display: inline-block; padding: 1px 6px; border-radius: 2px; font-size: 11px; font-weight: bold; }
    </style></head><body>
    <h2>${title}</h2>
    ${el.innerHTML}
    </body></html>`);
  win.document.close();
  win.print();
}

// ─── ATTENDANCE REPORT ───────────────────────────────────────────────────────

function AttendanceReport({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year, dept]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { month, year, limit: "500" };
      if (dept !== "all") params.department = dept;
      const r = await attendanceAPI.getAll(params);
      if (r.success) setRecords(r.data);
    } catch {}
    setLoading(false);
  }

  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const onLeave = records.filter((r) => r.status === "on_leave").length;
  const pct = records.length
    ? (((present + late) / records.length) * 100).toFixed(1)
    : "0.0";

  const statusColor: Record<string, string> = {
    present: "bg-[#00C48C] text-white",
    late: "bg-[#FA731C] text-white",
    absent: "bg-[#EF4444] text-white",
    on_leave: "bg-[#024BAB] text-white",
    half_day: "bg-yellow-400 text-black",
    holiday: "bg-purple-400 text-white",
    weekend: "bg-gray-300 text-black",
  };

  function doExport() {
    const header = [
      "Date",
      "Employee",
      "Employee ID",
      "Department",
      "Status",
      "Check In",
      "Check Out",
      "Work Hours",
    ];
    const rows = records.map((r) => [
      formatDate(r.date),
      r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : "—",
      r.employee?.employeeId || "—",
      r.employee?.department?.name || "—",
      r.status,
      r.checkIn
        ? new Date(r.checkIn).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
      r.checkOut
        ? new Date(r.checkOut).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
      r.workHours ? String(r.workHours) : "",
    ]);
    exportCSV(
      [header, ...rows],
      `attendance_${MONTHS[Number(month) - 1]}_${year}.csv`,
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </Select>
        <Select value={year} onChange={setYear} className="w-28">
          {[2023, 2024, 2025, 2026].map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>
        <Select value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex gap-2">
          <PrintButton
            onClick={() =>
              printSection(
                "att-table",
                `Attendance Report — ${MONTHS[Number(month) - 1]} ${year}`,
              )
            }
          />
          <ExportCSVButton onClick={doExport} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard
          label="Total Records"
          value={records.length}
          color="bg-[#024BAB]"
        />
        <StatCard label="Present" value={present} color="bg-[#00C48C]" />
        <StatCard label="Late" value={late} color="bg-[#FA731C]" />
        <StatCard label="Absent" value={absent} color="bg-[#EF4444]" />
        <StatCard
          label="Attendance %"
          value={`${pct}%`}
          color="bg-[#024BAB]"
          sub={`${onLeave} on leave`}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
        </div>
      ) : records.length === 0 ? (
        <div className="nb-card bg-white p-10 flex flex-col items-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
          <p className="font-bold text-black">
            No attendance records for this period
          </p>
        </div>
      ) : (
        <div className="nb-card bg-white overflow-hidden">
          <div id="att-table" className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]/5">
                  {[
                    "Date",
                    "Employee",
                    "Emp ID",
                    "Department",
                    "Status",
                    "Check In",
                    "Check Out",
                    "Hours",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((rec, i) => (
                  <tr
                    key={rec._id}
                    className={cn(
                      "border-b border-black/10",
                      i % 2 !== 0 && "bg-[#F8FAFF]",
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-black whitespace-nowrap">
                      {formatDate(rec.date)}
                    </td>
                    <td className="px-4 py-2.5 text-black whitespace-nowrap">
                      {rec.employee
                        ? `${rec.employee.firstName} ${rec.employee.lastName}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {rec.employee?.employeeId || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                      {rec.employee?.department?.name || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs font-bold border border-black",
                          statusColor[rec.status] || "bg-gray-200 text-black",
                        )}
                      >
                        {rec.status?.toUpperCase().replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black whitespace-nowrap">
                      {rec.checkIn
                        ? new Date(rec.checkIn).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black whitespace-nowrap">
                      {rec.checkOut
                        ? new Date(rec.checkOut).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black">
                      {rec.workHours ? `${rec.workHours}h` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EMPLOYEE REPORT ─────────────────────────────────────────────────────────

function EmployeeReport({ departments }: { departments: any[] }) {
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [dept, status, type]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "500" };
      if (dept !== "all") params.department = dept;
      if (status !== "all") params.status = status;
      if (type !== "all") params.type = type;
      const r = await employeeAPI.getAll(params);
      if (r.success) setEmployees(r.data);
    } catch {}
    setLoading(false);
  }

  const active = employees.filter((e) => e.status === "active").length;
  const inactive = employees.filter((e) => e.status === "inactive").length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;
  const avgSalary = employees.length
    ? Math.round(
        employees.reduce((s, e) => s + (e.salary || 0), 0) / employees.length,
      )
    : 0;

  const statusColor: Record<string, string> = {
    active: "bg-[#00C48C] text-white",
    inactive: "bg-[#EF4444] text-white",
    on_leave: "bg-[#FA731C] text-white",
    terminated: "bg-gray-400 text-white",
  };

  function doExport() {
    const header = [
      "Emp ID",
      "Name",
      "Email",
      "Phone",
      "Department",
      "Designation",
      "Type",
      "Status",
      "Join Date",
      "Salary",
    ];
    const rows = employees.map((e) => [
      e.employeeId,
      `${e.firstName} ${e.lastName}`,
      e.email,
      e.phone || "",
      e.department?.name || "",
      e.designation,
      e.employmentType?.replace(/_/g, " "),
      e.status,
      formatDate(e.joinDate),
      String(e.salary || 0),
    ]);
    exportCSV([header, ...rows], `employees_report.csv`);
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={setStatus} className="w-36">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_leave">On Leave</option>
          <option value="terminated">Terminated</option>
        </Select>
        <Select value={type} onChange={setType} className="w-36">
          <option value="all">All Types</option>
          <option value="full_time">Full Time</option>
          <option value="part_time">Part Time</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
        </Select>
        <div className="ml-auto flex gap-2">
          <PrintButton
            onClick={() => printSection("emp-table", "Employee Report")}
          />
          <ExportCSVButton onClick={doExport} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Total Employees"
          value={employees.length}
          color="bg-[#024BAB]"
        />
        <StatCard label="Active" value={active} color="bg-[#00C48C]" />
        <StatCard
          label="Inactive / On Leave"
          value={inactive + onLeave}
          color="bg-[#FA731C]"
        />
        <StatCard
          label="Avg. Salary"
          value={formatCurrency(avgSalary)}
          color="bg-[#024BAB]"
          sub="per annum"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
        </div>
      ) : employees.length === 0 ? (
        <div className="nb-card bg-white p-10 flex flex-col items-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
          <p className="font-bold text-black">No employees match the filters</p>
        </div>
      ) : (
        <div className="nb-card bg-white overflow-hidden">
          <div id="emp-table" className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]/5">
                  {[
                    "Emp ID",
                    "Name",
                    "Department",
                    "Designation",
                    "Type",
                    "Join Date",
                    "Salary (p.a.)",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr
                    key={emp._id}
                    className={cn(
                      "border-b border-black/10",
                      i % 2 !== 0 && "bg-[#F8FAFF]",
                    )}
                  >
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                      {emp.employeeId}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-black whitespace-nowrap">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {emp.email}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-black whitespace-nowrap">
                      {emp.department?.name || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-black whitespace-nowrap">
                      {emp.designation}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black capitalize">
                      {emp.employmentType?.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black whitespace-nowrap">
                      {formatDate(emp.joinDate)}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-black whitespace-nowrap">
                      {formatCurrency(emp.salary || 0)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs font-bold border border-black",
                          statusColor[emp.status] || "bg-gray-200 text-black",
                        )}
                      >
                        {emp.status?.toUpperCase().replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PAYROLL REPORT ──────────────────────────────────────────────────────────

function PayrollReport({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [status, setStatus] = useState("all");
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year, status]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { month, year, limit: "500" };
      if (status !== "all") params.status = status;
      const r = await payrollAPI.getAll(params);
      if (r.success) setPayrolls(r.data);
    } catch {}
    setLoading(false);
  }

  const totalGross = payrolls.reduce((s, p) => s + (p.grossSalary || 0), 0);
  const totalNet = payrolls.reduce((s, p) => s + (p.netSalary || 0), 0);
  const totalDed = payrolls.reduce((s, p) => s + (p.totalDeductions || 0), 0);
  const totalPF = payrolls.reduce((s, p) => s + (p.pf || 0), 0);
  const totalTDS = payrolls.reduce((s, p) => s + (p.tds || 0), 0);
  const paid = payrolls.filter((p) => p.status === "paid").length;

  const statusColor: Record<string, string> = {
    paid: "bg-[#00C48C] text-white",
    processed: "bg-[#024BAB] text-white",
    draft: "bg-gray-300 text-black",
  };

  function doExport() {
    const header = [
      "Month",
      "Year",
      "Emp ID",
      "Name",
      "Department",
      "Basic",
      "HRA",
      "DA",
      "TA",
      "Medical",
      "Gross",
      "PF",
      "ESI",
      "TDS",
      "Total Ded.",
      "Net Pay",
      "Status",
    ];
    const rows = payrolls.map((p) => [
      MONTHS[(p.month || 1) - 1],
      String(p.year),
      p.employee?.employeeId || "",
      p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "",
      p.employee?.department?.name || "",
      String(p.basicSalary || 0),
      String(p.hra || 0),
      String(p.da || 0),
      String(p.ta || 0),
      String(p.medicalAllowance || 0),
      String(p.grossSalary || 0),
      String(p.pf || 0),
      String(p.esi || 0),
      String(p.tds || 0),
      String(p.totalDeductions || 0),
      String(p.netSalary || 0),
      p.status,
    ]);
    exportCSV(
      [header, ...rows],
      `payroll_${MONTHS[Number(month) - 1]}_${year}.csv`,
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </Select>
        <Select value={year} onChange={setYear} className="w-28">
          {[2023, 2024, 2025, 2026].map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={setStatus} className="w-36">
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="processed">Processed</option>
          <option value="paid">Paid</option>
        </Select>
        <div className="ml-auto flex gap-2">
          <PrintButton
            onClick={() =>
              printSection(
                "pay-table",
                `Payroll Report — ${MONTHS[Number(month) - 1]} ${year}`,
              )
            }
          />
          <ExportCSVButton onClick={doExport} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <StatCard
          label="Records"
          value={payrolls.length}
          color="bg-[#024BAB]"
          sub={`${paid} paid`}
        />
        <StatCard
          label="Total Gross"
          value={formatCurrency(totalGross)}
          color="bg-[#024BAB]"
        />
        <StatCard
          label="Total Ded."
          value={formatCurrency(totalDed)}
          color="bg-[#EF4444]"
        />
        <StatCard
          label="Net Payout"
          value={formatCurrency(totalNet)}
          color="bg-[#00C48C]"
        />
        <StatCard
          label="Total PF"
          value={formatCurrency(totalPF)}
          color="bg-[#FA731C]"
        />
        <StatCard
          label="Total TDS"
          value={formatCurrency(totalTDS)}
          color="bg-[#FA731C]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
        </div>
      ) : payrolls.length === 0 ? (
        <div className="nb-card bg-white p-10 flex flex-col items-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
          <p className="font-bold text-black">
            No payroll records for this period
          </p>
        </div>
      ) : (
        <div className="nb-card bg-white overflow-hidden">
          <div id="pay-table" className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]/5">
                  {[
                    "Employee",
                    "Emp ID",
                    "Department",
                    "Basic",
                    "HRA",
                    "DA",
                    "Gross",
                    "PF",
                    "TDS",
                    "Net Pay",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap"
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
                    <td className="px-4 py-2.5 font-bold text-black whitespace-nowrap">
                      {p.employee
                        ? `${p.employee.firstName} ${p.employee.lastName}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                      {p.employee?.employeeId || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black whitespace-nowrap">
                      {p.employee?.department?.name || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black">
                      {formatCurrency(p.basicSalary || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black">
                      {formatCurrency(p.hra || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black">
                      {formatCurrency(p.da || 0)}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-black whitespace-nowrap">
                      {formatCurrency(p.grossSalary || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#EF4444]">
                      -{formatCurrency(p.pf || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#EF4444]">
                      -{formatCurrency(p.tds || 0)}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-[#00C48C] whitespace-nowrap">
                      {formatCurrency(p.netSalary || 0)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs font-bold border border-black",
                          statusColor[p.status] || "bg-gray-200 text-black",
                        )}
                      >
                        {p.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-[#024BAB]/5 font-bold">
                  <td
                    colSpan={6}
                    className="px-4 py-3 text-sm font-bold text-black"
                  >
                    TOTAL ({payrolls.length} records)
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">
                    {formatCurrency(totalGross)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-[#EF4444] whitespace-nowrap">
                    -{formatCurrency(totalPF)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-[#EF4444] whitespace-nowrap">
                    -{formatCurrency(totalTDS)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-[#00C48C] whitespace-nowrap">
                    {formatCurrency(totalNet)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LEAVE REPORT ────────────────────────────────────────────────────────────

function LeaveReport({ departments }: { departments: any[] }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [leaveType, setLeaveType] = useState("all");
  const [status, setStatus] = useState("all");
  const [dept, setDept] = useState("all");
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [year, leaveType, status, dept]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "500", year };
      if (leaveType !== "all") params.leaveType = leaveType;
      if (status !== "all") params.status = status;
      if (dept !== "all") params.department = dept;
      const r = await leaveAPI.getAll(params);
      if (r.success) setLeaves(r.data);
    } catch {}
    setLoading(false);
  }

  const approved = leaves.filter((l) => l.status === "approved").length;
  const pending = leaves.filter((l) => l.status === "pending").length;
  const rejected = leaves.filter((l) => l.status === "rejected").length;
  const totalDays = leaves
    .filter((l) => l.status === "approved")
    .reduce((s, l) => s + (l.days || 0), 0);

  const statusColor: Record<string, string> = {
    approved: "bg-[#00C48C] text-white",
    pending: "bg-[#FA731C] text-white",
    rejected: "bg-[#EF4444] text-white",
    cancelled: "bg-gray-300 text-black",
  };

  const typeColor: Record<string, string> = {
    casual: "bg-blue-100 text-blue-800",
    sick: "bg-red-100 text-red-800",
    earned: "bg-green-100 text-green-800",
    maternity: "bg-pink-100 text-pink-800",
    paternity: "bg-indigo-100 text-indigo-800",
    unpaid: "bg-gray-100 text-gray-800",
    compensatory: "bg-yellow-100 text-yellow-800",
  };

  function doExport() {
    const header = [
      "Emp ID",
      "Name",
      "Department",
      "Leave Type",
      "Start Date",
      "End Date",
      "Days",
      "Reason",
      "Status",
      "Applied On",
    ];
    const rows = leaves.map((l) => [
      l.employee?.employeeId || "",
      l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : "",
      l.employee?.department?.name || "",
      l.leaveType,
      formatDate(l.startDate),
      formatDate(l.endDate),
      String(l.days),
      l.reason,
      l.status,
      formatDate(l.createdAt),
    ]);
    exportCSV([header, ...rows], `leave_report_${year}.csv`);
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={year} onChange={setYear} className="w-28">
          {[2023, 2024, 2025, 2026].map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>
        <Select value={leaveType} onChange={setLeaveType} className="w-40">
          <option value="all">All Leave Types</option>
          <option value="casual">Casual</option>
          <option value="sick">Sick</option>
          <option value="earned">Earned</option>
          <option value="maternity">Maternity</option>
          <option value="paternity">Paternity</option>
          <option value="unpaid">Unpaid</option>
          <option value="compensatory">Compensatory</option>
        </Select>
        <Select value={status} onChange={setStatus} className="w-36">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Select value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex gap-2">
          <PrintButton
            onClick={() =>
              printSection("leave-table", `Leave Report — ${year}`)
            }
          />
          <ExportCSVButton onClick={doExport} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Total Applications"
          value={leaves.length}
          color="bg-[#024BAB]"
        />
        <StatCard
          label="Approved"
          value={approved}
          color="bg-[#00C48C]"
          sub={`${totalDays} days taken`}
        />
        <StatCard label="Pending" value={pending} color="bg-[#FA731C]" />
        <StatCard label="Rejected" value={rejected} color="bg-[#EF4444]" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
        </div>
      ) : leaves.length === 0 ? (
        <div className="nb-card bg-white p-10 flex flex-col items-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
          <p className="font-bold text-black">
            No leave records match the filters
          </p>
        </div>
      ) : (
        <div className="nb-card bg-white overflow-hidden">
          <div id="leave-table" className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]/5">
                  {[
                    "Employee",
                    "Emp ID",
                    "Department",
                    "Leave Type",
                    "From",
                    "To",
                    "Days",
                    "Reason",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.map((l, i) => (
                  <tr
                    key={l._id}
                    className={cn(
                      "border-b border-black/10",
                      i % 2 !== 0 && "bg-[#F8FAFF]",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-black whitespace-nowrap">
                        {l.employee
                          ? `${l.employee.firstName} ${l.employee.lastName}`
                          : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                      {l.employee?.employeeId || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black whitespace-nowrap">
                      {l.employee?.department?.name || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs font-bold border border-black/10",
                          typeColor[l.leaveType] || "bg-gray-100 text-gray-800",
                        )}
                      >
                        {l.leaveType?.charAt(0).toUpperCase() +
                          l.leaveType?.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black whitespace-nowrap">
                      {formatDate(l.startDate)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-black whitespace-nowrap">
                      {formatDate(l.endDate)}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-bold text-black text-center">
                      {l.days}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">
                      {l.reason}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs font-bold border border-black",
                          statusColor[l.status] || "bg-gray-200 text-black",
                        )}
                      >
                        {l.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "attendance", label: "Attendance Report", icon: Clock },
  { id: "employee", label: "Employee Report", icon: Users },
  { id: "payroll", label: "Payroll Report", icon: DollarSign },
  { id: "leave", label: "Leave Report", icon: CalendarDays },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("attendance");
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    departmentAPI
      .getAll()
      .then((r) => r.success && setDepartments(r.data))
      .catch(() => {});
  }, []);

  return (
    <AppLayout title="Reports">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-black">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate, filter, and export HR reports
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-0 mb-6 border-2 border-black w-fit nb-shadow">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-r-2 border-black last:border-r-0",
              activeTab === id
                ? "bg-[#024BAB] text-white"
                : "bg-white text-black hover:bg-[#F0F6FF]",
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "attendance" && (
        <AttendanceReport departments={departments} />
      )}
      {activeTab === "employee" && <EmployeeReport departments={departments} />}
      {activeTab === "payroll" && <PayrollReport departments={departments} />}
      {activeTab === "leave" && <LeaveReport departments={departments} />}
    </AppLayout>
  );
}
