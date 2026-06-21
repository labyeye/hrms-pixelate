import { useState, useEffect, useMemo } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { buildReportHTML } from "@/lib/reportPrintHTML";
import * as XLSX from "xlsx";
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
  employeeAPI,
  attendanceAPI,
  payrollAPI,
  departmentAPI,
  leaveAPI,
} from "@/services/api";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import {
  Download,
  Printer,
  ChevronDown,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Search,
  FileText,
  BarChart2,
  Users,
  Calendar,
  IndianRupee,
  Clock,
  TrendingUp,
  Shield,
  CreditCard,
  BookOpen,
  Building2,
  X,
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
const YEARS = Array.from(
  { length: 5 },
  (_, i) => new Date().getFullYear() - 2 + i,
);

type Category = "payroll" | "attendance" | "employee";

interface ReportDef {
  id: string;
  name: string;
  desc: string;
  category: Category;
  icon: typeof FileText;
  available: boolean;
}

const REPORTS: ReportDef[] = [
  {
    id: "pay-report",
    name: "Pay Report",
    desc: "Employee datewise present, absent and half day status with attendance summary and payment details.",
    category: "payroll",
    icon: IndianRupee,
    available: true,
  },
  {
    id: "salary-register",
    name: "Salary Register",
    desc: "Full salary register with all components — basic, HRA, allowances, deductions and net pay.",
    category: "payroll",
    icon: BookOpen,
    available: true,
  },
  {
    id: "net-salary",
    name: "Net Salary Report",
    desc: "Employee net salary report showing take-home pay after all deductions.",
    category: "payroll",
    icon: TrendingUp,
    available: true,
  },
  {
    id: "salary-slip",
    name: "Salary Slip",
    desc: "Individual salary slip showing earnings, deductions and net pay. Printable per employee.",
    category: "payroll",
    icon: FileText,
    available: true,
  },
  {
    id: "pf-register",
    name: "PF Register",
    desc: "Provident Fund register showing employee and employer PF contributions.",
    category: "payroll",
    icon: Shield,
    available: true,
  },
  {
    id: "esic-register",
    name: "ESIC Register Report",
    desc: "ESIC register showing employee-wise ESIC contributions.",
    category: "payroll",
    icon: Shield,
    available: true,
  },
  {
    id: "bank-upload",
    name: "Bank Upload Report",
    desc: "Bank transfer file for salary disbursement. Account numbers and net pay for bulk upload.",
    category: "payroll",
    icon: CreditCard,
    available: true,
  },
  {
    id: "absent-leave-summary",
    name: "Absent/Leave Summary Report",
    desc: "Total leave of employee — unpaid leave and paid leave summary.",
    category: "payroll",
    icon: Calendar,
    available: true,
  },
  {
    id: "late-coming-summary",
    name: "Late Coming Summary Report",
    desc: "Summary of late arrivals per employee for the selected period.",
    category: "payroll",
    icon: Clock,
    available: true,
  },
  {
    id: "designation-summary",
    name: "Designation Summary Report",
    desc: "Monthly summary of employee counts and payroll grouped by designation.",
    category: "payroll",
    icon: Building2,
    available: true,
  },
  {
    id: "pt-register",
    name: "PT Register Report",
    desc: "Professional Tax register for all employees.",
    category: "payroll",
    icon: Shield,
    available: false,
  },
  {
    id: "lwf-register",
    name: "LWF Register Report",
    desc: "Labour Welfare Fund register showing employee LWF contributions.",
    category: "payroll",
    icon: Shield,
    available: false,
  },
  {
    id: "loan-report",
    name: "Loan Report",
    desc: "Loan details — Previous Loan Balance, New Loan Taken, Loan Cleared, Loan Balance.",
    category: "payroll",
    icon: BookOpen,
    available: false,
  },
  {
    id: "bonus-report",
    name: "Bonus Report",
    desc: "Yearly/Monthly bonus report calculated according to custom formula.",
    category: "payroll",
    icon: TrendingUp,
    available: false,
  },
  {
    id: "overtime-summary",
    name: "Overtime Summary Report",
    desc: "Summary of overtime hours and amounts for all employees in the period.",
    category: "payroll",
    icon: Clock,
    available: false,
  },
  {
    id: "compliance-report",
    name: "Compliance Report",
    desc: "Employee compliance summary — PF, ESI, PT, TDS compliance details.",
    category: "payroll",
    icon: Shield,
    available: false,
  },
  {
    id: "early-going-summary",
    name: "Early Going Summary Report",
    desc: "Summary of early departures per employee for the selected period.",
    category: "payroll",
    icon: Clock,
    available: false,
  },
  {
    id: "excess-break-summary",
    name: "Excess Break Summary Report",
    desc: "Summary of employees who exceeded allowed break time in the period.",
    category: "payroll",
    icon: Clock,
    available: false,
  },
  {
    id: "pf-challan",
    name: "PF Challan ECR Report",
    desc: "PF Electronic Challan cum Return (ECR) file for PF authority submission.",
    category: "payroll",
    icon: FileText,
    available: false,
  },
  {
    id: "esic-challan",
    name: "ESIC Challan Report",
    desc: "ESIC challan report for submission to ESIC authority.",
    category: "payroll",
    icon: FileText,
    available: false,
  },

  {
    id: "attendance-report",
    name: "Employee Attendance Report",
    desc: "Employee datewise present, absent and half day status with attendance summary.",
    category: "attendance",
    icon: BarChart2,
    available: true,
  },
  {
    id: "attendance-inout",
    name: "Attendance In/Out Report",
    desc: "Attendance in and out times for each employee for each date in the selected period.",
    category: "attendance",
    icon: Clock,
    available: true,
  },
  {
    id: "attendance-summary",
    name: "Attendance Summary",
    desc: "Attendance summary with datewise present, absent and half day status for all employees.",
    category: "attendance",
    icon: BarChart2,
    available: true,
  },
  {
    id: "leave-report",
    name: "Leave Report",
    desc: "Employee datewise leave report showing leave types and days for the period.",
    category: "attendance",
    icon: Calendar,
    available: true,
  },
  {
    id: "miss-punch",
    name: "Miss Punch Report",
    desc: "Employees with missing punch-in or punch-out entries for each date.",
    category: "attendance",
    icon: AlertCircle,
    available: true,
  },
  {
    id: "attendance-inout-vertical",
    name: "Attendance In Out Vertical Report",
    desc: "Vertical format attendance in/out — one date per row showing all employees.",
    category: "attendance",
    icon: BarChart2,
    available: false,
  },
  {
    id: "locationwise",
    name: "Locationwise Report",
    desc: "Attendance report grouped by location/branch showing all employees presence data.",
    category: "attendance",
    icon: Building2,
    available: false,
  },
  {
    id: "punch-log",
    name: "Punch Log Detail Report",
    desc: "Detail of each punch — all in/out punches from biometric device for the period.",
    category: "attendance",
    icon: FileText,
    available: false,
  },
  {
    id: "attendance-history",
    name: "Attendance History",
    desc: "History of all attendance changes. Shows original and modified attendance records.",
    category: "attendance",
    icon: BookOpen,
    available: false,
  },

  {
    id: "employee-directory",
    name: "Employee Directory",
    desc: "Full employee list with all details including contact, department, designation, salary.",
    category: "employee",
    icon: Users,
    available: true,
  },
  {
    id: "employee-report",
    name: "Employee Report",
    desc: "Select an employee and report type — attendance, salary slip, leave, or full profile.",
    category: "employee",
    icon: FileText,
    available: true,
  },
];

function exportCSV(rows: string[][], filename: string) {
  const csv = rows
    .map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportXLSX(rows: string[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, filename.replace(".csv", ".xlsx"));
}

function printReport(title: string, period: string, headers: string[], rows: string[][]) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(buildReportHTML(title, period, headers, rows));
  win.document.close();
}

function NbSelect({
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

function CategoryTag({ cat }: { cat: Category }) {
  const styles: Record<Category, string> = {
    payroll: "bg-[#024BAB] text-white",
    attendance: "bg-[#00C48C] text-white",
    employee: "bg-[#FA731C] text-white",
  };
  const labels: Record<Category, string> = {
    payroll: "PayRoll",
    attendance: "Attendance",
    employee: "Employee",
  };
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-black",
        styles[cat],
      )}
    >
      {labels[cat]}
    </span>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="border-2 bg-white p-12 flex flex-col items-center gap-3">
      <AlertCircle className="w-10 h-10 text-black/20" />
      <p className="font-bold text-black">{msg}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex justify-center py-16">
      <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  present: "bg-green-100 text-green-700 border border-green-300",
  late: "bg-orange-100 text-orange-700 border border-orange-300",
  absent: "bg-red-100 text-red-700 border border-red-300",
  half_day: "bg-yellow-100 text-yellow-700 border border-yellow-300",
  "half day": "bg-yellow-100 text-yellow-700 border border-yellow-300",
  on_leave: "bg-blue-100 text-blue-700 border border-blue-300",
  "on leave": "bg-blue-100 text-blue-700 border border-blue-300",
  leave: "bg-blue-100 text-blue-700 border border-blue-300",
  holiday: "bg-purple-100 text-purple-700 border border-purple-300",
  weekend: "bg-gray-100 text-gray-500 border border-gray-200",
  paid: "bg-green-100 text-green-700 border border-green-300",
  pending: "bg-orange-100 text-orange-700 border border-orange-300",
  approved: "bg-green-100 text-green-700 border border-green-300",
  rejected: "bg-red-100 text-red-700 border border-red-300",
  cancelled: "bg-gray-100 text-gray-500 border border-gray-200",
  active: "bg-green-100 text-green-700 border border-green-300",
  inactive: "bg-red-100 text-red-700 border border-red-300",
  terminated: "bg-red-100 text-red-700 border border-red-300",
  missing: "bg-red-100 text-red-700 border border-red-300",
  neft: "bg-blue-100 text-blue-700 border border-blue-300",
};

const AVATAR_PALETTE = ["#024BAB", "#00C48C", "#FA731C", "#7C3AED", "#0891B2", "#DC2626"];
function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function StatusCell({ val }: { val: string }) {
  const key = val.toLowerCase().trim();
  const cls = STATUS_BADGE[key];
  if (cls) return <span className={cn("px-2 py-0.5 text-[10px] font-black uppercase rounded", cls)}>{val}</span>;
  return <span>{val}</span>;
}

function NameCell({ name }: { name: string }) {
  if (!name || name === "—") return <span>{name}</span>;
  const color = getAvatarColor(name);
  const initials = getInitials(name);
  return (
    <span className="flex items-center gap-2">
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {initials}
      </span>
      <span>{name}</span>
    </span>
  );
}

function ReportTable({
  id,
  headers,
  rows,
}: {
  id: string;
  headers: string[];
  rows: string[][];
}) {
  const nameColIdx = headers.findIndex((h) =>
    ["employee", "name", "employee name"].includes(h.toLowerCase()),
  );
  const statusColIdx = headers.findIndex((h) =>
    ["status", "payment status"].includes(h.toLowerCase()),
  );

  return (
    <div className="border-2 bg-white overflow-hidden">
      <div id={id} className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black bg-[#024BAB]/5">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-black text-black uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b border-black/10",
                  i % 2 !== 0 && "bg-[#F8FAFF]",
                )}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-4 py-2.5 text-sm text-black whitespace-nowrap"
                  >
                    {j === nameColIdx ? (
                      <NameCell name={cell} />
                    ) : j === statusColIdx ? (
                      <StatusCell val={cell} />
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayReportGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Employee",
    "Emp ID",
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
    "Net Pay",
    "Status",
  ];
  const rows = data.map((p) => [
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.employeeId || "—",
    p.employee?.department?.name || "—",
    formatCurrency(p.basicSalary || 0),
    formatCurrency(p.hra || 0),
    formatCurrency(p.da || 0),
    formatCurrency(p.ta || 0),
    formatCurrency(p.medicalAllowance || 0),
    formatCurrency(p.grossSalary || 0),
    formatCurrency(p.pf || 0),
    formatCurrency(p.esi || 0),
    formatCurrency(p.tds || 0),
    formatCurrency(p.netSalary || 0),
    p.status?.toUpperCase() || "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Pay Report",
                `${MONTHS[+month - 1]} ${year}`,
                headers,
                rows,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `pay_report_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={() =>
              exportXLSX(
                [headers, ...rows],
                `pay_report_${MONTHS[+month - 1]}_${year}.xlsx`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#00C48C] text-white"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <ReportTable id="pay-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function SalaryRegisterGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Name",
    "Dept",
    "Basic",
    "HRA",
    "DA",
    "TA",
    "Medical",
    "Other Allow.",
    "Gross",
    "PF Emp.",
    "ESI Emp.",
    "TDS",
    "Prof Tax",
    "Total Ded.",
    "Net Pay",
  ];
  const rows = data.map((p) => [
    p.employee?.employeeId || "—",
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.department?.name || "—",
    formatCurrency(p.basicSalary || 0),
    formatCurrency(p.hra || 0),
    formatCurrency(p.da || 0),
    formatCurrency(p.ta || 0),
    formatCurrency(p.medicalAllowance || 0),
    formatCurrency(0),
    formatCurrency(p.grossSalary || 0),
    formatCurrency(p.pf || 0),
    formatCurrency(p.esi || 0),
    formatCurrency(p.tds || 0),
    formatCurrency(0),
    formatCurrency(p.totalDeductions || 0),
    formatCurrency(p.netSalary || 0),
  ]);

  const totalGross = data.reduce((s, p) => s + (p.grossSalary || 0), 0);
  const totalNet = data.reduce((s, p) => s + (p.netSalary || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Salary Register",
                `${MONTHS[+month - 1]} ${year}`,
                headers,
                rows,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `salary_register_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {data.length > 0 && (
        <div className="flex gap-4">
          <div className="border-2 bg-[#024BAB] text-white p-4 flex-1">
            <p className="text-xs font-black uppercase tracking-wider opacity-80">
              Total Gross
            </p>
            <p className="text-2xl font-black mt-1">
              {formatCurrency(totalGross)}
            </p>
          </div>
          <div className="border-2 bg-[#00C48C] text-white p-4 flex-1">
            <p className="text-xs font-black uppercase tracking-wider opacity-80">
              Total Net Pay
            </p>
            <p className="text-2xl font-black mt-1">
              {formatCurrency(totalNet)}
            </p>
          </div>
          <div className="border-2 bg-[#EF4444] text-white p-4 flex-1">
            <p className="text-xs font-black uppercase tracking-wider opacity-80">
              Total Deductions
            </p>
            <p className="text-2xl font-black mt-1">
              {formatCurrency(totalGross - totalNet)}
            </p>
          </div>
        </div>
      )}
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <ReportTable id="sal-reg-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function NetSalaryGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Employee Name",
    "Department",
    "Designation",
    "Gross Salary",
    "Total Deductions",
    "Net Pay",
    "Payment Status",
  ];
  const rows = data.map((p) => [
    p.employee?.employeeId || "—",
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.department?.name || "—",
    p.employee?.designation || "—",
    formatCurrency(p.grossSalary || 0),
    formatCurrency(p.totalDeductions || 0),
    formatCurrency(p.netSalary || 0),
    p.status?.toUpperCase() || "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `net_salary_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <ReportTable id="net-sal-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function SalarySlipGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    load();
    setSelected(null);
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  function printSlip() {
    if (!selected) return;
    const p = selected;
    const emp = p.employee || {};
    const win = window.open("", "_blank");
    if (!win) return;
    win.document
      .write(`<html><head><title>Salary Slip</title><style>body{font-family:sans-serif;font-size:12px;margin:20px;max-width:700px}h2{font-size:18px;border-bottom:2px solid black;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee}.label{color:#555}.amount{font-weight:bold}.total{font-weight:bold;font-size:14px;background:#f0f6ff;padding:8px}.section{margin-top:16px;font-weight:bold;font-size:13px;border-bottom:1px solid black;margin-bottom:8px}</style></head><body>
    <h2>Salary Slip — ${MONTHS[+month - 1]} ${year}</h2>
    <div class="grid">
      <div><b>Employee:</b> ${emp.firstName} ${emp.lastName}</div>
      <div><b>Emp ID:</b> ${emp.employeeId || "—"}</div>
      <div><b>Department:</b> ${emp.department?.name || "—"}</div>
      <div><b>Designation:</b> ${emp.designation || "—"}</div>
    </div>
    <div class="section">Earnings</div>
    <div class="row"><span class="label">Basic Salary</span><span class="amount">₹${(p.basicSalary || 0).toLocaleString()}</span></div>
    <div class="row"><span class="label">HRA</span><span class="amount">₹${(p.hra || 0).toLocaleString()}</span></div>
    <div class="row"><span class="label">DA</span><span class="amount">₹${(p.da || 0).toLocaleString()}</span></div>
    <div class="row"><span class="label">TA</span><span class="amount">₹${(p.ta || 0).toLocaleString()}</span></div>
    <div class="row"><span class="label">Medical Allowance</span><span class="amount">₹${(p.medicalAllowance || 0).toLocaleString()}</span></div>
    <div class="row total"><span>Gross Salary</span><span>₹${(p.grossSalary || 0).toLocaleString()}</span></div>
    <div class="section">Deductions</div>
    <div class="row"><span class="label">Provident Fund</span><span class="amount">₹${(p.pf || 0).toLocaleString()}</span></div>
    <div class="row"><span class="label">ESI</span><span class="amount">₹${(p.esi || 0).toLocaleString()}</span></div>
    <div class="row"><span class="label">TDS</span><span class="amount">₹${(p.tds || 0).toLocaleString()}</span></div>
    <div class="row total"><span>Total Deductions</span><span>₹${(p.totalDeductions || 0).toLocaleString()}</span></div>
    <div class="row total" style="background:#e8f5e9"><span>NET PAY</span><span>₹${(p.netSalary || 0).toLocaleString()}</span></div>
    </body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        {selected && (
          <button
            onClick={printSlip}
            className="ml-auto flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print Slip
          </button>
        )}
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Select an employee to view salary slip
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.map((p) => (
              <button
                key={p._id}
                onClick={() => setSelected(selected?._id === p._id ? null : p)}
                className={cn(
                  "border-2 p-4 text-left transition-all hover:-translate-y-0.5",
                  selected?._id === p._id
                    ? "bg-[#024BAB] text-white"
                    : "bg-white",
                )}
              >
                <p
                  className={cn(
                    "font-black text-sm",
                    selected?._id === p._id ? "text-white" : "text-black",
                  )}
                >
                  {p.employee
                    ? `${p.employee.firstName} ${p.employee.lastName}`
                    : "—"}
                </p>
                <p
                  className={cn(
                    "text-xs mt-0.5",
                    selected?._id === p._id
                      ? "text-white/70"
                      : "text-muted-foreground",
                  )}
                >
                  {p.employee?.department?.name} · {p.employee?.designation}
                </p>
                <p
                  className={cn(
                    "text-sm font-black mt-2",
                    selected?._id === p._id ? "text-white" : "text-[#00C48C]",
                  )}
                >
                  Net: {formatCurrency(p.netSalary || 0)}
                </p>
              </button>
            ))}
          </div>
          {selected && (
            <div className="border-2 bg-white p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-black text-black">
                    {selected.employee?.firstName} {selected.employee?.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selected.employee?.employeeId} ·{" "}
                    {selected.employee?.department?.name} ·{" "}
                    {selected.employee?.designation}
                  </p>
                </div>
                <span className="px-3 py-1 border-2 border-black bg-[#024BAB] text-white text-xs font-black">
                  {MONTHS[+month - 1]} {year}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
                    Earnings
                  </p>
                  {[
                    ["Basic Salary", selected.basicSalary],
                    ["HRA", selected.hra],
                    ["DA", selected.da],
                    ["TA", selected.ta],
                    ["Medical Allow.", selected.medicalAllowance],
                  ].map(([l, v]) => (
                    <div
                      key={String(l)}
                      className="flex justify-between py-1.5 border-b border-black/10 text-sm"
                    >
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-bold text-black">
                        {formatCurrency(Number(v) || 0)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 mt-1 bg-[#024BAB]/5 px-2 text-sm font-black">
                    <span>Gross Salary</span>
                    <span>{formatCurrency(selected.grossSalary || 0)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
                    Deductions
                  </p>
                  {[
                    ["Provident Fund", selected.pf],
                    ["ESI", selected.esi],
                    ["TDS", selected.tds],
                  ].map(([l, v]) => (
                    <div
                      key={String(l)}
                      className="flex justify-between py-1.5 border-b border-black/10 text-sm"
                    >
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-bold text-[#EF4444]">
                        -{formatCurrency(Number(v) || 0)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 mt-1 bg-red-50 px-2 text-sm font-black">
                    <span>Total Deductions</span>
                    <span className="text-[#EF4444]">
                      -{formatCurrency(selected.totalDeductions || 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="border-2 border-black bg-[#00C48C] p-4 flex justify-between items-center">
                <span className="text-white font-black text-lg uppercase tracking-wide">
                  Net Pay
                </span>
                <span className="text-white font-black text-2xl">
                  {formatCurrency(selected.netSalary || 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PFRegisterGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data.filter((p: any) => (p.pf || 0) > 0));
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Employee Name",
    "Department",
    "UAN / PF No.",
    "Basic Salary",
    "PF (Employee 12%)",
    "PF (Employer 12%)",
    "Total PF",
  ];
  const rows = data.map((p) => [
    p.employee?.employeeId || "—",
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.department?.name || "—",
    p.employee?.pfNumber || "—",
    formatCurrency(p.basicSalary || 0),
    formatCurrency(p.pf || 0),
    formatCurrency(p.pf || 0),
    formatCurrency((p.pf || 0) * 2),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `pf_register_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No PF records for this period" />
      ) : (
        <ReportTable id="pf-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function ESICRegisterGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data.filter((p: any) => (p.esi || 0) > 0));
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Employee Name",
    "Department",
    "ESIC No.",
    "Gross Salary",
    "ESI (Employee 0.75%)",
    "ESI (Employer 3.25%)",
    "Total ESI",
  ];
  const rows = data.map((p) => [
    p.employee?.employeeId || "—",
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.department?.name || "—",
    p.employee?.esicNumber || "—",
    formatCurrency(p.grossSalary || 0),
    formatCurrency(p.esi || 0),
    formatCurrency(Math.round((p.esi || 0) * (3.25 / 0.75))),
    formatCurrency(p.esi || 0 + Math.round((p.esi || 0) * (3.25 / 0.75))),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `esic_register_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No ESIC records for this period" />
      ) : (
        <ReportTable id="esic-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function BankUploadGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Employee Name",
    "Bank Name",
    "Account Number",
    "IFSC Code",
    "Net Pay",
    "Payment Mode",
  ];
  const rows = data.map((p) => [
    p.employee?.employeeId || "—",
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.bankName || "—",
    p.employee?.bankAccount || "—",
    p.employee?.ifsc || "—",
    formatCurrency(p.netSalary || 0),
    "NEFT",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `bank_upload_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <ReportTable id="bank-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function AbsentLeaveSummaryGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
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
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const empMap = new Map<string, any>();
  data.forEach((rec) => {
    if (!rec.employee) return;
    const id = rec.employee._id;
    if (!empMap.has(id))
      empMap.set(id, {
        emp: rec.employee,
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        halfDay: 0,
        total: 0,
      });
    const e = empMap.get(id);
    e.total++;
    if (rec.status === "present") e.present++;
    else if (rec.status === "late") e.late++;
    else if (rec.status === "absent") e.absent++;
    else if (rec.status === "on_leave") e.leave++;
    else if (rec.status === "half_day") e.halfDay++;
  });

  const summaryRows = Array.from(empMap.values());
  const headers = [
    "Emp ID",
    "Employee Name",
    "Department",
    "Total Days",
    "Present",
    "Late",
    "Absent",
    "On Leave",
    "Half Day",
    "Attendance %",
  ];
  const rows = summaryRows.map(
    ({ emp, present, late, absent, leave, halfDay, total }) => [
      emp.employeeId || "—",
      `${emp.firstName} ${emp.lastName}`,
      emp.department?.name || "—",
      String(total),
      String(present),
      String(late),
      String(absent),
      String(leave),
      String(halfDay),
      total > 0 ? `${(((present + late) / total) * 100).toFixed(1)}%` : "0%",
    ],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `absent_leave_summary_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No attendance records for this period" />
      ) : (
        <ReportTable id="al-summary-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function LateComingGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
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
      if (r.success)
        setData(r.data.filter((rec: any) => rec.status === "late"));
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Date",
    "Emp ID",
    "Employee Name",
    "Department",
    "Check In Time",
    "Expected Time",
    "Late By",
  ];
  const rows = data.map((rec) => {
    const checkIn = rec.checkIn ? new Date(rec.checkIn) : null;
    const expectedHr = 9;
    const lateMinutes = checkIn
      ? Math.max(
          0,
          (checkIn.getHours() - expectedHr) * 60 + checkIn.getMinutes(),
        )
      : 0;
    return [
      formatDate(rec.date),
      rec.employee?.employeeId || "—",
      rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : "—",
      rec.employee?.department?.name || "—",
      checkIn
        ? checkIn.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      "09:00 AM",
      lateMinutes > 0 ? `${lateMinutes} min` : "—",
    ];
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `late_coming_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No late arrivals for this period" />
      ) : (
        <ReportTable id="late-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function DesignationSummaryGen({ departments }: { departments: any[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);
  async function load() {
    setLoading(true);
    try {
      const r = await employeeAPI.getAll({ limit: "500", status: "active" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const desigMap = new Map<
    string,
    { count: number; totalSalary: number; dept: string }
  >();
  data.forEach((emp) => {
    const key = emp.designation || "Unknown";
    if (!desigMap.has(key))
      desigMap.set(key, {
        count: 0,
        totalSalary: 0,
        dept: emp.department?.name || "—",
      });
    const e = desigMap.get(key)!;
    e.count++;
    e.totalSalary += emp.salary || 0;
  });

  const headers = [
    "Designation",
    "Department",
    "Employee Count",
    "Total Payroll (p.a.)",
    "Avg. Salary (p.a.)",
  ];
  const rows = Array.from(desigMap.entries()).map(
    ([desig, { count, totalSalary, dept }]) => [
      desig,
      dept,
      String(count),
      formatCurrency(totalSalary),
      formatCurrency(count > 0 ? totalSalary / count : 0),
    ],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() =>
            exportCSV([headers, ...rows], `designation_summary.csv`)
          }
          className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No active employees found" />
      ) : (
        <ReportTable id="desig-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function AttendanceReportGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
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
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Date",
    "Employee",
    "Emp ID",
    "Department",
    "Status",
    "Check In",
    "Check Out",
    "Work Hours",
  ];
  const rows = data.map((rec) => [
    formatDate(rec.date),
    rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : "—",
    rec.employee?.employeeId || "—",
    rec.employee?.department?.name || "—",
    rec.status?.toUpperCase().replace("_", " ") || "—",
    rec.checkIn
      ? new Date(rec.checkIn).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    rec.checkOut
      ? new Date(rec.checkOut).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    rec.workHours ? `${rec.workHours}h` : "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Employee Attendance Report",
                `${MONTHS[+month - 1]} ${year}`,
                headers,
                rows,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `attendance_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No attendance records for this period" />
      ) : (
        <ReportTable id="att-rpt-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function AttendanceInOutGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
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
      if (r.success) setData(r.data.filter((rec: any) => rec.checkIn));
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Date",
    "Employee",
    "Emp ID",
    "Department",
    "In Time",
    "Out Time",
    "Total Hours",
    "Status",
  ];
  const rows = data.map((rec) => [
    formatDate(rec.date),
    rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : "—",
    rec.employee?.employeeId || "—",
    rec.employee?.department?.name || "—",
    rec.checkIn
      ? new Date(rec.checkIn).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    rec.checkOut
      ? new Date(rec.checkOut).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Missing",
    rec.workHours ? `${rec.workHours}h` : "—",
    rec.status?.toUpperCase().replace("_", " ") || "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `attendance_inout_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No punch records for this period" />
      ) : (
        <ReportTable id="inout-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function AttendanceSummaryGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
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
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const empMap = new Map<string, any>();
  data.forEach((rec) => {
    if (!rec.employee) return;
    const id = rec.employee._id;
    if (!empMap.has(id))
      empMap.set(id, {
        emp: rec.employee,
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        halfDay: 0,
        total: 0,
      });
    const e = empMap.get(id);
    e.total++;
    if (rec.status === "present") e.present++;
    else if (rec.status === "late") e.late++;
    else if (rec.status === "absent") e.absent++;
    else if (rec.status === "on_leave") e.leave++;
    else if (rec.status === "half_day") e.halfDay++;
  });

  const headers = [
    "Emp ID",
    "Employee",
    "Department",
    "Present",
    "Late",
    "Absent",
    "On Leave",
    "Half Day",
    "Total",
    "Attendance %",
  ];
  const rows = Array.from(empMap.values()).map(
    ({ emp, present, late, absent, leave, halfDay, total }) => [
      emp.employeeId || "—",
      `${emp.firstName} ${emp.lastName}`,
      emp.department?.name || "—",
      String(present),
      String(late),
      String(absent),
      String(leave),
      String(halfDay),
      String(total),
      total > 0 ? `${(((present + late) / total) * 100).toFixed(1)}%` : "0%",
    ],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `attendance_summary_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No attendance records for this period" />
      ) : (
        <ReportTable id="att-sum-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function LeaveReportGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [leaveType, setLeaveType] = useState("all");
  const [status, setStatus] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [year, leaveType, status]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "500", year };
      if (leaveType !== "all") params.leaveType = leaveType;
      if (status !== "all") params.status = status;
      const r = await leaveAPI.getAll(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Employee",
    "Department",
    "Leave Type",
    "From",
    "To",
    "Days",
    "Reason",
    "Status",
  ];
  const rows = data.map((l) => [
    l.employee?.employeeId || "—",
    l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : "—",
    l.employee?.department?.name || "—",
    l.leaveType?.charAt(0).toUpperCase() + l.leaveType?.slice(1) || "—",
    formatDate(l.startDate),
    formatDate(l.endDate),
    String(l.days || 0),
    l.reason || "—",
    l.status?.toUpperCase() || "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={leaveType} onChange={setLeaveType} className="w-40">
          <option value="all">All Types</option>
          {[
            "casual",
            "sick",
            "earned",
            "maternity",
            "paternity",
            "unpaid",
            "compensatory",
          ].map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={status} onChange={setStatus} className="w-36">
          <option value="all">All Statuses</option>
          {["pending", "approved", "rejected", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `leave_report_${year}.csv`)
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No leave records for this period" />
      ) : (
        <ReportTable id="leave-rpt-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function MissPunchGen({ departments }: { departments: any[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
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
      if (r.success)
        setData(r.data.filter((rec: any) => rec.checkIn && !rec.checkOut));
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Date",
    "Emp ID",
    "Employee",
    "Department",
    "Check In",
    "Check Out",
    "Remark",
  ];
  const rows = data.map((rec) => [
    formatDate(rec.date),
    rec.employee?.employeeId || "—",
    rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : "—",
    rec.employee?.department?.name || "—",
    rec.checkIn
      ? new Date(rec.checkIn).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    "MISSING",
    "Punch-out not recorded",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `miss_punch_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No missing punch records for this period" />
      ) : (
        <ReportTable id="miss-punch-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function EmployeeDirectoryGen({ departments }: { departments: any[] }) {
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [dept, status]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "500" };
      if (dept !== "all") params.department = dept;
      if (status !== "all") params.status = status;
      const r = await employeeAPI.getAll(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Name",
    "Email",
    "Phone",
    "Department",
    "Designation",
    "Type",
    "Join Date",
    "Salary (p.a.)",
    "Status",
  ];
  const rows = data.map((e) => [
    e.employeeId || "—",
    `${e.firstName} ${e.lastName}`,
    e.email || "—",
    e.phone || "—",
    e.department?.name || "—",
    e.designation || "—",
    e.employmentType?.replace(/_/g, " ") || "—",
    formatDate(e.joinDate),
    formatCurrency(e.salary || 0),
    e.status?.toUpperCase() || "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={status} onChange={setStatus} className="w-36">
          <option value="all">All Statuses</option>
          {["active", "inactive", "on_leave", "terminated"].map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ").charAt(0).toUpperCase() +
                s.replace("_", " ").slice(1)}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => printReport("Employee Directory", new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }), headers, rows)}
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `employee_directory.csv`)
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No employees match the filters" />
      ) : (
        <ReportTable id="emp-dir-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

const EMP_REPORT_TYPES = [
  { id: "attendance", label: "Attendance Report", desc: "Monthly attendance — daily status, check-in/out times" },
  { id: "salary-slip", label: "Salary Slip", desc: "Monthly salary slip with earnings, deductions, net pay" },
  { id: "leave", label: "Leave Report", desc: "Yearly leave history — types, dates, approval status" },
  { id: "profile", label: "Employee Profile", desc: "Full profile — personal, employment, bank details" },
];

function EmployeeReportGen({ departments: _departments }: { departments: any[] }) {
  const now = new Date();
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [reportType, setReportType] = useState<string | null>(null);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [empLoading, setEmpLoading] = useState(true);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    employeeAPI.getAll({ limit: "500", status: "active" }).then((r) => {
      if (r.success) setEmployees(r.data);
      setEmpLoading(false);
    }).catch(() => setEmpLoading(false));
  }, []);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      !q ||
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      (e.employeeId || "").toLowerCase().includes(q) ||
      (e.department?.name || "").toLowerCase().includes(q)
    );
  });

  async function generate() {
    if (!selectedEmp || !reportType) return;
    setLoading(true);
    setGenerated(false);
    try {
      if (reportType === "attendance") {
        const r = await attendanceAPI.getAll({ employeeId: selectedEmp._id, month, year, limit: "60" });
        setData(r.data || []);
      } else if (reportType === "salary-slip") {
        const r = await payrollAPI.getAll({ employeeId: selectedEmp._id, month, year });
        setData(r.data || []);
      } else if (reportType === "leave") {
        const r = await leaveAPI.getAll({ employeeId: selectedEmp._id, year, limit: "200" });
        setData(r.data || []);
      } else if (reportType === "profile") {
        setData([selectedEmp]);
      }
    } catch {}
    setLoading(false);
    setGenerated(true);
  }

  function getHeaders() {
    if (reportType === "attendance") return ["Date", "Status", "Check In", "Check Out", "Work Hours"];
    if (reportType === "salary-slip") return ["Component", "Amount"];
    if (reportType === "leave") return ["From", "To", "Days", "Type", "Reason", "Status"];
    if (reportType === "profile") return ["Field", "Value"];
    return [];
  }

  function getRows(): string[][] {
    if (reportType === "attendance") {
      return data.map((r) => [
        new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" }),
        (r.status || "").toUpperCase().replace("_", " "),
        r.checkIn ? new Date(r.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—",
        r.checkOut ? new Date(r.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—",
        r.workHours ? `${r.workHours}h` : "—",
      ]);
    }
    if (reportType === "salary-slip" && data[0]) {
      const p = data[0];
      return [
        ["Basic Salary", formatCurrency(p.basicSalary || 0)],
        ["HRA", formatCurrency(p.hra || 0)],
        ["DA", formatCurrency(p.da || 0)],
        ["TA", formatCurrency(p.ta || 0)],
        ["Medical Allowance", formatCurrency(p.medicalAllowance || 0)],
        ["Gross Salary", formatCurrency(p.grossSalary || 0)],
        ["PF (Deduction)", `- ${formatCurrency(p.pf || 0)}`],
        ["ESI (Deduction)", `- ${formatCurrency(p.esi || 0)}`],
        ["TDS (Deduction)", `- ${formatCurrency(p.tds || 0)}`],
        ["Total Deductions", `- ${formatCurrency(p.totalDeductions || 0)}`],
        ["NET PAY", formatCurrency(p.netSalary || 0)],
      ];
    }
    if (reportType === "leave") {
      return data.map((l) => [
        formatDate(l.startDate),
        formatDate(l.endDate),
        String(l.days || 0),
        (l.leaveType || "").charAt(0).toUpperCase() + (l.leaveType || "").slice(1),
        l.reason || "—",
        (l.status || "").toUpperCase(),
      ]);
    }
    if (reportType === "profile" && data[0]) {
      const e = data[0];
      return [
        ["Employee ID", e.employeeId || "—"],
        ["Full Name", `${e.firstName} ${e.lastName}`],
        ["Email", e.email || "—"],
        ["Phone", e.phone || "—"],
        ["Department", e.department?.name || "—"],
        ["Designation", e.designation || "—"],
        ["Employment Type", (e.employmentType || "").replace("_", " ")],
        ["Join Date", formatDate(e.joinDate)],
        ["Salary (p.a.)", formatCurrency(e.salary || 0)],
        ["Status", (e.status || "").toUpperCase()],
        ["Bank Name", e.bankName || "—"],
        ["Account No.", e.bankAccount || "—"],
        ["IFSC", e.ifsc || "—"],
        ["PF Number", e.pfNumber || "—"],
        ["ESIC Number", e.esicNumber || "—"],
      ];
    }
    return [];
  }

  const headers = getHeaders();
  const rows = getRows();
  const period = reportType === "leave" ? `Year ${year}` : `${MONTHS[+month - 1]} ${year}`;
  const empName = selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : "";
  const color = selectedEmp ? getAvatarColor(empName) : "#024BAB";
  const initials = selectedEmp ? getInitials(empName) : "";

  return (
    <div className="space-y-5">
      {/* Step 1: Select Employee */}
      <div className="border-2 border-black bg-white p-5">
        <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-3">Step 1 — Select Employee</p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID or department..."
            className="w-full border-2 border-black pl-9 pr-4 py-2 text-sm font-medium bg-white focus:outline-none"
          />
        </div>
        {empLoading ? (
          <LoadingState />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {filtered.map((emp) => {
              const name = `${emp.firstName} ${emp.lastName}`;
              const isSelected = selectedEmp?._id === emp._id;
              const bg = getAvatarColor(name);
              return (
                <button
                  key={emp._id}
                  onClick={() => { setSelectedEmp(emp); setGenerated(false); setData([]); }}
                  className={cn(
                    "flex items-center gap-2 border-2 p-2.5 text-left transition-all",
                    isSelected ? "border-[#024BAB] bg-[#024BAB]/5" : "border-black/20 bg-white hover:border-black",
                  )}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
                    style={{ backgroundColor: bg }}
                  >
                    {getInitials(name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-black truncate">{name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{emp.department?.name || emp.designation}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Select Report Type */}
      {selectedEmp && (
        <div className="border-2 border-black bg-white p-5">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black"
              style={{ backgroundColor: color }}
            >
              {initials}
            </span>
            <div>
              <p className="font-black text-black">{empName}</p>
              <p className="text-xs text-muted-foreground">{selectedEmp.employeeId} · {selectedEmp.department?.name} · {selectedEmp.designation}</p>
            </div>
            <button onClick={() => { setSelectedEmp(null); setReportType(null); setGenerated(false); }} className="ml-auto border-2 border-black p-1 bg-white hover:bg-gray-50">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-3">Step 2 — Select Report Type</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {EMP_REPORT_TYPES.map((rt) => (
              <button
                key={rt.id}
                onClick={() => { setReportType(rt.id); setGenerated(false); setData([]); }}
                className={cn(
                  "border-2 p-3 text-left transition-all",
                  reportType === rt.id ? "border-[#024BAB] bg-[#024BAB] text-white" : "border-black bg-white hover:border-[#024BAB]",
                )}
              >
                <p className={cn("text-xs font-black", reportType === rt.id ? "text-white" : "text-black")}>{rt.label}</p>
                <p className={cn("text-[10px] mt-0.5", reportType === rt.id ? "text-white/70" : "text-muted-foreground")}>{rt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Period + Generate */}
      {selectedEmp && reportType && (
        <div className="border-2 border-black bg-white p-5 space-y-4">
          <p className="text-xs font-black uppercase tracking-wider text-[#024BAB]">Step 3 — Select Period & Generate</p>
          <div className="flex flex-wrap gap-3 items-center">
            {reportType !== "leave" && reportType !== "profile" && (
              <NbSelect value={month} onChange={setMonth} className="w-32">
                {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
              </NbSelect>
            )}
            {reportType !== "profile" && (
              <NbSelect value={year} onChange={setYear} className="w-28">
                {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </NbSelect>
            )}
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-2 border-2 border-black px-4 py-2 text-sm font-black bg-[#024BAB] text-white disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generate
            </button>
            {generated && rows.length > 0 && (
              <>
                <button
                  onClick={() => printReport(`${EMP_REPORT_TYPES.find(r => r.id === reportType)?.label} — ${empName}`, period, headers, rows)}
                  className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white hover:bg-gray-50"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() => exportCSV([headers, ...rows], `${reportType}_${empName.replace(" ", "_")}_${period}.csv`)}
                  className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#00C48C] text-white"
                >
                  <Download className="w-4 h-4" /> CSV
                </button>
              </>
            )}
          </div>

          {generated && (
            rows.length === 0 ? (
              <EmptyState msg="No data for the selected period" />
            ) : (
              <ReportTable id="emp-rpt-tbl" headers={headers} rows={rows} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function ComingSoonGen() {
  return (
    <div className="border-2 bg-white p-12 flex flex-col items-center gap-4">
      <div className="w-16 h-16 border-2 border-black bg-[#024BAB]/10 flex items-center justify-center">
        <FileText className="w-8 h-8 text-[#024BAB]" />
      </div>
      <div className="text-center">
        <p className="font-black text-black text-lg">Coming Soon</p>
        <p className="text-sm text-muted-foreground mt-1">
          This report requires additional data configuration.
          <br />
          It will be available in a future update.
        </p>
      </div>
    </div>
  );
}

const REPORT_COMPONENT: Record<
  string,
  React.ComponentType<{ departments: any[] }>
> = {
  "pay-report": PayReportGen,
  "salary-register": SalaryRegisterGen,
  "net-salary": NetSalaryGen,
  "salary-slip": SalarySlipGen,
  "pf-register": PFRegisterGen,
  "esic-register": ESICRegisterGen,
  "bank-upload": BankUploadGen,
  "absent-leave-summary": AbsentLeaveSummaryGen,
  "late-coming-summary": LateComingGen,
  "designation-summary": DesignationSummaryGen,
  "attendance-report": AttendanceReportGen,
  "attendance-inout": AttendanceInOutGen,
  "attendance-summary": AttendanceSummaryGen,
  "leave-report": LeaveReportGen,
  "miss-punch": MissPunchGen,
  "employee-directory": EmployeeDirectoryGen,
  "employee-report": EmployeeReportGen,
};

const CATEGORY_META: Record<
  Category,
  { label: string; color: string; count: number }
> = {
  payroll: { label: "PayRoll", color: "#024BAB", count: 0 },
  attendance: { label: "Attendance", color: "#00C48C", count: 0 },
  employee: { label: "Employee", color: "#FA731C", count: 0 },
};

const CHART_COLORS = [
  "#024BAB",
  "#FA731C",
  "#00C48C",
  "#A855F7",
  "#EF4444",
  "#FFD60A",
];

function AnalyticsTab({ departments }: { departments: any[] }) {
  const now = new Date();
  const [attTab, setAttTab] = useState("headcount");
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      employeeAPI.getAll({ limit: "500", status: "active" }),
      payrollAPI.getAll({
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
        limit: "500",
      }),
      attendanceAPI.getAll({
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
        limit: "500",
      }),
    ])
      .then(([e, p, a]) => {
        if (e.success) setEmployees(e.data);
        if (p.success) setPayrolls(p.data);
        if (a.success) setAttendance(a.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const deptData = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        count: number;
        male: number;
        female: number;
        salary: number;
      }
    >();
    employees.forEach((e) => {
      const name = e.department?.name || "No Dept";
      if (!map.has(name))
        map.set(name, { name, count: 0, male: 0, female: 0, salary: 0 });
      const d = map.get(name)!;
      d.count++;
      d.salary += e.salary || 0;
      if (e.gender === "male") d.male++;
      else if (e.gender === "female") d.female++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [employees]);

  const attSummary = useMemo(
    () => ({
      present: attendance.filter((a) => a.status === "present").length,
      late: attendance.filter((a) => a.status === "late").length,
      absent: attendance.filter((a) => a.status === "absent").length,
      leave: attendance.filter((a) => a.status === "on_leave").length,
    }),
    [attendance],
  );

  const payrollSummary = useMemo(
    () => ({
      gross: payrolls.reduce((s, p) => s + (p.grossSalary || 0), 0),
      net: payrolls.reduce((s, p) => s + (p.netSalary || 0), 0),
      ded: payrolls.reduce((s, p) => s + (p.totalDeductions || 0), 0),
      pf: payrolls.reduce((s, p) => s + (p.pf || 0), 0),
      esi: payrolls.reduce((s, p) => s + (p.esi || 0), 0),
      tds: payrolls.reduce((s, p) => s + (p.tds || 0), 0),
    }),
    [payrolls],
  );

  const TABS = [
    { id: "headcount", label: "Headcount" },
    { id: "attendance", label: "Attendance" },
    { id: "salary", label: "Salary" },
    { id: "compliance", label: "PF / ESI" },
  ];

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
      </div>
    );

  return (
    <div className="space-y-5">
      {}
      <div className="flex gap-0 border-2 border-black w-fit">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setAttTab(id)}
            className={cn(
              "px-4 py-2 text-sm font-black border-r-2 border-black last:border-r-0 transition-all",
              attTab === id
                ? "bg-[#024BAB] text-white"
                : "bg-white text-black hover:bg-gray-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {attTab === "headcount" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Total Active",
                value: employees.length,
                color: "#024BAB",
              },
              {
                label: "Male",
                value: employees.filter((e) => e.gender === "male").length,
                color: "#00C48C",
              },
              {
                label: "Female",
                value: employees.filter((e) => e.gender === "female").length,
                color: "#FA731C",
              },
              {
                label: "Departments",
                value: deptData.length,
                color: "#A855F7",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="border-2 bg-white p-4">
                <p className="text-2xl font-black" style={{ color }}>
                  {value}
                </p>
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mt-0.5">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border-2 bg-white p-5">
              <h3 className="font-black text-sm text-black mb-3">
                Dept Headcount
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={deptData} barCategoryGap="35%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#E5E7EB"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={24}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Employees"
                    stroke="#0A0A0A"
                    strokeWidth={1}
                  >
                    {deptData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="border-2 bg-white p-5">
              <h3 className="font-black text-sm text-black mb-3">
                Dept Breakdown Table
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-black">
                      {["Dept", "Total", "Male", "Female", "Avg Salary"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-black uppercase tracking-wider text-muted-foreground"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {deptData.map((d, i) => (
                      <tr
                        key={d.name}
                        className={cn(
                          "border-b border-black/10",
                          i % 2 !== 0 && "bg-[#F8FAFF]",
                        )}
                      >
                        <td className="px-3 py-2 font-bold text-black">
                          {d.name}
                        </td>
                        <td className="px-3 py-2">{d.count}</td>
                        <td className="px-3 py-2">{d.male}</td>
                        <td className="px-3 py-2">{d.female}</td>
                        <td className="px-3 py-2">
                          {d.count > 0
                            ? formatCurrency(Math.round(d.salary / d.count))
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {attTab === "attendance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Present", value: attSummary.present, color: "#00C48C" },
              { label: "Late", value: attSummary.late, color: "#FA731C" },
              { label: "Absent", value: attSummary.absent, color: "#EF4444" },
              { label: "On Leave", value: attSummary.leave, color: "#024BAB" },
            ].map(({ label, value, color }) => (
              <div key={label} className="border-2 bg-white p-4">
                <p className="text-2xl font-black" style={{ color }}>
                  {value}
                </p>
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mt-0.5">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="border-2 bg-white p-5">
            <h3 className="font-black text-sm text-black mb-3">
              Attendance Distribution
            </h3>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Present",
                        value: attSummary.present,
                        color: "#00C48C",
                      },
                      {
                        name: "Late",
                        value: attSummary.late,
                        color: "#FA731C",
                      },
                      {
                        name: "Absent",
                        value: attSummary.absent,
                        color: "#EF4444",
                      },
                      {
                        name: "On Leave",
                        value: attSummary.leave,
                        color: "#024BAB",
                      },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#0A0A0A"
                    strokeWidth={2}
                  >
                    {[
                      attSummary.present,
                      attSummary.late,
                      attSummary.absent,
                      attSummary.leave,
                    ].map((_, i) => (
                      <Cell
                        key={i}
                        fill={["#00C48C", "#FA731C", "#EF4444", "#024BAB"][i]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {[
                  {
                    label: "Present",
                    value: attSummary.present,
                    color: "#00C48C",
                  },
                  { label: "Late", value: attSummary.late, color: "#FA731C" },
                  {
                    label: "Absent",
                    value: attSummary.absent,
                    color: "#EF4444",
                  },
                  {
                    label: "On Leave",
                    value: attSummary.leave,
                    color: "#024BAB",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 border border-black"
                        style={{ background: color }}
                      />
                      <span className="text-xs font-bold text-black">
                        {label}
                      </span>
                    </div>
                    <span className="text-xs font-black text-black">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {attTab === "salary" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: "Total Gross",
                value: formatCurrency(payrollSummary.gross),
                color: "#024BAB",
              },
              {
                label: "Total Net",
                value: formatCurrency(payrollSummary.net),
                color: "#00C48C",
              },
              {
                label: "Total Deductions",
                value: formatCurrency(payrollSummary.ded),
                color: "#EF4444",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="border-2 bg-white p-4">
                <p className="text-xl font-black" style={{ color }}>
                  {value}
                </p>
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mt-0.5">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="border-2 bg-white p-5">
            <h3 className="font-black text-sm text-black mb-3">
              Dept-wise Payroll
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={deptData.map((d) => ({ name: d.name, salary: d.salary }))}
                barCategoryGap="35%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5E7EB"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar
                  dataKey="salary"
                  name="Total Salary"
                  fill="#024BAB"
                  stroke="#0A0A0A"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {attTab === "compliance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: "PF Contribution",
                value: formatCurrency(payrollSummary.pf * 2),
                color: "#024BAB",
                sub: "Employee + Employer",
              },
              {
                label: "ESI Contribution",
                value: formatCurrency(payrollSummary.esi),
                color: "#00C48C",
                sub: "Employee share",
              },
              {
                label: "TDS Collected",
                value: formatCurrency(payrollSummary.tds),
                color: "#FA731C",
                sub: "This month",
              },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="border-2 bg-white p-4">
                <p className="text-xl font-black" style={{ color }}>
                  {value}
                </p>
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mt-0.5">
                  {label}
                </p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
          {payrolls.length > 0 ? (
            <div className="border-2 bg-white overflow-hidden">
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-black bg-[#024BAB]/5">
                      {[
                        "Employee",
                        "Gross",
                        "PF (Emp)",
                        "PF (Employer)",
                        "ESI",
                        "TDS",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-black uppercase tracking-wider"
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
                        <td className="px-4 py-2.5 font-bold text-black">
                          {p.employee
                            ? `${p.employee.firstName} ${p.employee.lastName}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrency(p.grossSalary || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrency(p.pf || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrency(p.pf || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrency(p.esi || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrency(p.tds || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              "border-2 text-[10px]",
                              p.status === "paid"
                                ? "bg-[#00C48C] text-white border-black"
                                : "bg-[#FA731C] text-white border-black",
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
            </div>
          ) : (
            <EmptyState msg="No payroll data for this month" />
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<Category | "all">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pageMode, setPageMode] = useState<"catalog" | "analytics">("catalog");

  useEffect(() => {
    departmentAPI
      .getAll()
      .then((r) => r.success && setDepartments(r.data))
      .catch(() => {});
  }, []);

  const filtered = REPORTS.filter((r) => {
    const matchCat = filterCat === "all" || r.category === filterCat;
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const grouped: Record<Category, ReportDef[]> = {
    payroll: [],
    attendance: [],
    employee: [],
  };
  filtered.forEach((r) => grouped[r.category].push(r));

  const activeReport = REPORTS.find((r) => r.id === activeId);
  const ActiveComponent = activeId
    ? REPORT_COMPONENT[activeId] || ComingSoonGen
    : null;

  const catCounts: Record<Category, number> = {
    payroll: 0,
    attendance: 0,
    employee: 0,
  };
  REPORTS.forEach((r) => catCounts[r.category]++);

  return (
    <AppLayout title="Reports">
      {}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-black">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate, filter, and export HR reports
          </p>
        </div>
        <div className="flex gap-0 border-2 border-black shrink-0">
          <button
            onClick={() => setPageMode("catalog")}
            className={cn(
              "px-4 py-2 text-sm font-black border-r-2 border-black transition-all",
              pageMode === "catalog"
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-gray-50",
            )}
          >
            All Reports
          </button>
          <button
            onClick={() => setPageMode("analytics")}
            className={cn(
              "px-4 py-2 text-sm font-black transition-all",
              pageMode === "analytics"
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-gray-50",
            )}
          >
            Analytics
          </button>
        </div>
      </div>

      {}
      {pageMode === "analytics" && <AnalyticsTab departments={departments} />}

      {}
      {pageMode === "catalog" && (
        <>
          {}
          {activeId && activeReport && ActiveComponent && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setActiveId(null)}
                  className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" /> All Reports
                </button>
                <div className="flex items-center gap-2">
                  <CategoryTag cat={activeReport.category} />
                  <h2 className="text-xl font-black text-black">
                    {activeReport.name}
                  </h2>
                </div>
                <button
                  onClick={() => setActiveId(null)}
                  className="ml-auto border-2 border-black p-1.5 bg-white hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="border-2 bg-white p-5">
                <ActiveComponent departments={departments} />
              </div>
            </div>
          )}

          {}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border-2 border-black pl-9 pr-4 py-2.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
              />
            </div>
            <div className="flex gap-1 border-2 border-black">
              {(
                [
                  ["all", "All"],
                  ["payroll", "PayRoll"],
                  ["attendance", "Attendance"],
                  ["employee", "Employee"],
                ] as [Category | "all", string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilterCat(id)}
                  className={cn(
                    "px-4 py-2 text-sm font-black border-r-2 border-black last:border-r-0 transition-all",
                    filterCat === id
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-gray-50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {}
          <div className="flex gap-3 mb-6">
            {(Object.entries(catCounts) as [Category, number][]).map(
              ([cat, count]) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 border-2 border-black px-3 py-1.5 bg-white"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-none"
                    style={{ backgroundColor: CATEGORY_META[cat].color }}
                  />
                  <span className="text-xs font-black text-black uppercase tracking-wider">
                    {CATEGORY_META[cat].label}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {count} reports
                  </span>
                </div>
              ),
            )}
          </div>

          {}
          {(["payroll", "attendance", "employee"] as Category[]).map((cat) => {
            const catReports = grouped[cat];
            if (catReports.length === 0) return null;
            return (
              <div key={cat} className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="h-5 w-1 border border-black"
                    style={{ backgroundColor: CATEGORY_META[cat].color }}
                  />
                  <h2 className="text-base font-black text-black uppercase tracking-wider">
                    {CATEGORY_META[cat].label} ({catReports.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {catReports.map((report) => {
                    const Icon = report.icon;
                    const isActive = activeId === report.id;
                    return (
                      <div
                        key={report.id}
                        className={cn(
                          "border-2 bg-white p-4 flex flex-col gap-3 transition-all",
                          isActive && "border-[#024BAB] bg-[#F0F6FF]",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "w-10 h-10 border-2 border-black flex items-center justify-center flex-shrink-0",
                              report.available ? "bg-[#024BAB]" : "bg-gray-200",
                            )}
                          >
                            <Icon
                              className={cn(
                                "w-5 h-5",
                                report.available
                                  ? "text-white"
                                  : "text-gray-400",
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <CategoryTag cat={report.category} />
                              {!report.available && (
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-black bg-gray-100 text-gray-500">
                                  Coming Soon
                                </span>
                              )}
                            </div>
                            <p className="font-black text-black text-sm leading-tight">
                              {report.name}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                          {report.desc}
                        </p>
                        <button
                          onClick={() =>
                            setActiveId(isActive ? null : report.id)
                          }
                          disabled={!report.available}
                          className={cn(
                            "w-full py-2 text-sm font-black border-2 border-black transition-all",
                            isActive
                              ? "bg-black text-white"
                              : report.available
                                ? "bg-white text-black hover:bg-[#024BAB] hover:text-white border-2"
                                : "bg-gray-100 text-gray-400 cursor-not-allowed",
                          )}
                        >
                          {isActive
                            ? "Close Report"
                            : report.available
                              ? "Generate"
                              : "Unavailable"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <EmptyState msg={`No reports found matching "${search}"`} />
          )}
        </>
      )}
    </AppLayout>
  );
}
