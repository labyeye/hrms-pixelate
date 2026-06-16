import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Share,
  Alert,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import RNPrint from 'react-native-print';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BarChart2,
  IndianRupee,
  Clock,
  Calendar,
  Users,
  FileText,
  TrendingUp,
  Shield,
  CreditCard,
  BookOpen,
  AlertCircle,
  Building2,
  X,
  Download,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import {
  payrollAPI,
  attendanceAPI,
  employeeAPI,
  leaveAPI,
  departmentAPI,
} from '../api/api';
import { C } from '../theme';

const { width: SW } = Dimensions.get('window');
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const YEARS = Array.from(
  { length: 5 },
  (_, i) => new Date().getFullYear() - 2 + i,
);

type Category = 'payroll' | 'attendance' | 'employee';
const CAT_COLORS: Record<Category, string> = {
  payroll: C.primary,
  attendance: C.success,
  employee: '#7C3AED',
};

interface ReportDef {
  id: string;
  label: string;
  desc: string;
  category: Category;
  icon: any;
  color: string;
  needsMonth?: boolean;
  needsDept?: boolean;
  needsYear?: boolean;
}

const REPORTS: ReportDef[] = [
  {
    id: 'pay-report',
    label: 'Pay Report',
    desc: 'Employee salary with attendance summary and payment details.',
    category: 'payroll',
    icon: IndianRupee,
    color: C.primary,
    needsMonth: true,
  },
  {
    id: 'salary-register',
    label: 'Salary Register',
    desc: 'Full salary register — basic, HRA, allowances, deductions, net pay.',
    category: 'payroll',
    icon: BookOpen,
    color: C.primary,
    needsMonth: true,
  },
  {
    id: 'net-salary',
    label: 'Net Salary Report',
    desc: 'Net take-home salary after all deductions for the period.',
    category: 'payroll',
    icon: TrendingUp,
    color: C.primary,
    needsMonth: true,
  },
  {
    id: 'salary-slip',
    label: 'Salary Slip',
    desc: 'Individual salary slip — earnings, deductions, net pay.',
    category: 'payroll',
    icon: FileText,
    color: C.primary,
    needsMonth: true,
  },
  {
    id: 'pf-register',
    label: 'PF Register',
    desc: 'Provident Fund register — employee & employer PF contributions.',
    category: 'payroll',
    icon: Shield,
    color: '#7C3AED',
    needsMonth: true,
  },
  {
    id: 'esic-register',
    label: 'ESIC Register',
    desc: 'ESIC register showing employee-wise ESIC contributions.',
    category: 'payroll',
    icon: Shield,
    color: '#0891B2',
    needsMonth: true,
  },
  {
    id: 'bank-upload',
    label: 'Bank Upload',
    desc: 'Bank transfer file with account numbers and net pay.',
    category: 'payroll',
    icon: CreditCard,
    color: C.success,
    needsMonth: true,
  },
  {
    id: 'absent-leave',
    label: 'Absent/Leave Summary',
    desc: 'Total leave — unpaid and paid leave summary per employee.',
    category: 'payroll',
    icon: Calendar,
    color: C.warning,
    needsMonth: true,
    needsDept: true,
  },
  {
    id: 'late-coming',
    label: 'Late Coming Summary',
    desc: 'Summary of late arrivals per employee for the period.',
    category: 'payroll',
    icon: Clock,
    color: C.warning,
    needsMonth: true,
    needsDept: true,
  },
  {
    id: 'designation-summary',
    label: 'Designation Summary',
    desc: 'Employee count and payroll grouped by designation.',
    category: 'payroll',
    icon: Building2,
    color: C.primary,
  },
  {
    id: 'attendance-report',
    label: 'Attendance Report',
    desc: 'Datewise present, absent, half day status for all employees.',
    category: 'attendance',
    icon: BarChart2,
    color: C.success,
    needsMonth: true,
    needsDept: true,
  },
  {
    id: 'attendance-inout',
    label: 'Attendance In/Out',
    desc: 'Check-in and check-out times for each employee per date.',
    category: 'attendance',
    icon: Clock,
    color: C.success,
    needsMonth: true,
    needsDept: true,
  },
  {
    id: 'attendance-summary',
    label: 'Attendance Summary',
    desc: 'Present, absent, half day counts per employee for the period.',
    category: 'attendance',
    icon: BarChart2,
    color: C.success,
    needsMonth: true,
    needsDept: true,
  },
  {
    id: 'leave-report',
    label: 'Leave Report',
    desc: 'Employee leave report showing types and days for the year.',
    category: 'attendance',
    icon: Calendar,
    color: C.warning,
    needsYear: true,
  },
  {
    id: 'miss-punch',
    label: 'Miss Punch',
    desc: 'Employees with missing punch-out entries for the period.',
    category: 'attendance',
    icon: AlertCircle,
    color: C.danger,
    needsMonth: true,
    needsDept: true,
  },
  {
    id: 'employee-directory',
    label: 'Employee Directory',
    desc: 'Full employee list with contact, department, designation, salary.',
    category: 'employee',
    icon: Users,
    color: '#7C3AED',
  },
];

// ── CSV helper ─────────────────────────────────────────────────────────────────
function toCSV(headers: string[], rows: string[][]): string {
  return [headers, ...rows]
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function fmt(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function fmtCur(n: number) {
  return `₹${(n || 0).toLocaleString('en-IN')}`;
}

// ── Data generators ─────────────────────────────────────────────────────────────
async function generateReport(
  id: string,
  month: string,
  year: string,
  dept: string,
): Promise<{ headers: string[]; rows: string[][] }> {
  switch (id) {
    case 'pay-report': {
      const r = await payrollAPI.getAll({ month, year });
      const data: any[] = r.data || [];
      return {
        headers: [
          'Employee',
          'Emp ID',
          'Dept',
          'Basic',
          'HRA',
          'Gross',
          'PF',
          'ESI',
          'TDS',
          'Net Pay',
          'Status',
        ],
        rows: data.map(p => [
          p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—',
          p.employee?.employeeId || '—',
          p.employee?.department?.name || '—',
          fmtCur(p.basicSalary),
          fmtCur(p.hra || 0),
          fmtCur(p.grossSalary),
          fmtCur(p.pf || 0),
          fmtCur(p.esi || 0),
          fmtCur(p.tds || 0),
          fmtCur(p.netSalary),
          (p.status || '').toUpperCase(),
        ]),
      };
    }
    case 'salary-register': {
      const r = await payrollAPI.getAll({ month, year });
      const data: any[] = r.data || [];
      return {
        headers: [
          'Emp ID',
          'Name',
          'Dept',
          'Basic',
          'HRA',
          'DA',
          'TA',
          'Medical',
          'Gross',
          'PF',
          'ESI',
          'TDS',
          'Total Ded.',
          'Net Pay',
        ],
        rows: data.map(p => [
          p.employee?.employeeId || '—',
          p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—',
          p.employee?.department?.name || '—',
          fmtCur(p.basicSalary),
          fmtCur(p.hra || 0),
          fmtCur(p.da || 0),
          fmtCur(p.ta || 0),
          fmtCur(p.medicalAllowance || 0),
          fmtCur(p.grossSalary),
          fmtCur(p.pf || 0),
          fmtCur(p.esi || 0),
          fmtCur(p.tds || 0),
          fmtCur(p.totalDeductions || 0),
          fmtCur(p.netSalary),
        ]),
      };
    }
    case 'net-salary': {
      const r = await payrollAPI.getAll({ month, year });
      const data: any[] = r.data || [];
      return {
        headers: [
          'Emp ID',
          'Employee',
          'Department',
          'Designation',
          'Gross',
          'Deductions',
          'Net Pay',
          'Status',
        ],
        rows: data.map(p => [
          p.employee?.employeeId || '—',
          p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—',
          p.employee?.department?.name || '—',
          p.employee?.designation || '—',
          fmtCur(p.grossSalary),
          fmtCur(p.totalDeductions || 0),
          fmtCur(p.netSalary),
          (p.status || '').toUpperCase(),
        ]),
      };
    }
    case 'salary-slip': {
      const r = await payrollAPI.getAll({ month, year });
      const data: any[] = r.data || [];
      return {
        headers: [
          'Emp ID',
          'Employee',
          'Dept',
          'Designation',
          'Basic',
          'HRA',
          'Gross',
          'PF',
          'ESI',
          'TDS',
          'Total Ded.',
          'Net Pay',
        ],
        rows: data.map(p => [
          p.employee?.employeeId || '—',
          p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—',
          p.employee?.department?.name || '—',
          p.employee?.designation || '—',
          fmtCur(p.basicSalary),
          fmtCur(p.hra || 0),
          fmtCur(p.grossSalary),
          fmtCur(p.pf || 0),
          fmtCur(p.esi || 0),
          fmtCur(p.tds || 0),
          fmtCur(p.totalDeductions || 0),
          fmtCur(p.netSalary),
        ]),
      };
    }
    case 'pf-register': {
      const r = await payrollAPI.getAll({ month, year });
      const data: any[] = (r.data || []).filter((p: any) => (p.pf || 0) > 0);
      return {
        headers: [
          'Emp ID',
          'Employee',
          'Department',
          'UAN/PF No.',
          'Basic',
          'PF (Emp 12%)',
          'PF (Emp 12%)',
          'Total PF',
        ],
        rows: data.map(p => [
          p.employee?.employeeId || '—',
          p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—',
          p.employee?.department?.name || '—',
          p.employee?.pfNumber || '—',
          fmtCur(p.basicSalary),
          fmtCur(p.pf || 0),
          fmtCur(p.pf || 0),
          fmtCur((p.pf || 0) * 2),
        ]),
      };
    }
    case 'esic-register': {
      const r = await payrollAPI.getAll({ month, year });
      const data: any[] = (r.data || []).filter((p: any) => (p.esi || 0) > 0);
      return {
        headers: [
          'Emp ID',
          'Employee',
          'Department',
          'ESIC No.',
          'Gross',
          'ESI (Emp 0.75%)',
          'ESI (Employer 3.25%)',
          'Total ESI',
        ],
        rows: data.map(p => [
          p.employee?.employeeId || '—',
          p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—',
          p.employee?.department?.name || '—',
          p.employee?.esicNumber || '—',
          fmtCur(p.grossSalary),
          fmtCur(p.esi || 0),
          fmtCur(Math.round((p.esi || 0) * (3.25 / 0.75))),
          fmtCur((p.esi || 0) + Math.round((p.esi || 0) * (3.25 / 0.75))),
        ]),
      };
    }
    case 'bank-upload': {
      const r = await payrollAPI.getAll({ month, year });
      const data: any[] = r.data || [];
      return {
        headers: [
          'Emp ID',
          'Employee',
          'Bank Name',
          'Account No.',
          'IFSC',
          'Net Pay',
          'Mode',
        ],
        rows: data.map(p => [
          p.employee?.employeeId || '—',
          p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—',
          p.employee?.bankName || '—',
          p.employee?.bankAccount || '—',
          p.employee?.ifsc || '—',
          fmtCur(p.netSalary),
          'NEFT',
        ]),
      };
    }
    case 'absent-leave': {
      const params: any = { month, year };
      if (dept !== 'all') params.department = dept;
      const r = await attendanceAPI.getAll(params);
      const data: any[] = r.data || [];
      const map = new Map<string, any>();
      data.forEach((rec: any) => {
        if (!rec.employee) return;
        const id = rec.employee._id;
        if (!map.has(id))
          map.set(id, {
            emp: rec.employee,
            present: 0,
            late: 0,
            absent: 0,
            leave: 0,
            halfDay: 0,
            total: 0,
          });
        const e = map.get(id);
        e.total++;
        if (rec.status === 'present') e.present++;
        else if (rec.status === 'late') e.late++;
        else if (rec.status === 'absent') e.absent++;
        else if (rec.status === 'on_leave') e.leave++;
        else if (rec.status === 'half_day') e.halfDay++;
      });
      return {
        headers: [
          'Emp ID',
          'Employee',
          'Dept',
          'Total',
          'Present',
          'Late',
          'Absent',
          'On Leave',
          'Half Day',
          'Att %',
        ],
        rows: Array.from(map.values()).map(
          ({ emp, present, late, absent, leave, halfDay, total }) => [
            emp.employeeId || '—',
            `${emp.firstName} ${emp.lastName}`,
            emp.department?.name || '—',
            String(total),
            String(present),
            String(late),
            String(absent),
            String(leave),
            String(halfDay),
            total > 0
              ? `${(((present + late) / total) * 100).toFixed(1)}%`
              : '0%',
          ],
        ),
      };
    }
    case 'late-coming': {
      const params: any = { month, year };
      if (dept !== 'all') params.department = dept;
      const r = await attendanceAPI.getAll(params);
      const data: any[] = (r.data || []).filter(
        (rec: any) => rec.status === 'late',
      );
      return {
        headers: [
          'Date',
          'Emp ID',
          'Employee',
          'Department',
          'Check In',
          'Expected',
          'Late By',
        ],
        rows: data.map((rec: any) => {
          const checkIn = rec.checkIn ? new Date(rec.checkIn) : null;
          const late = checkIn
            ? Math.max(0, (checkIn.getHours() - 9) * 60 + checkIn.getMinutes())
            : 0;
          return [
            fmtDate(rec.date),
            rec.employee?.employeeId || '—',
            rec.employee
              ? `${rec.employee.firstName} ${rec.employee.lastName}`
              : '—',
            rec.employee?.department?.name || '—',
            checkIn
              ? checkIn.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—',
            '09:00 AM',
            late > 0 ? `${late} min` : '—',
          ];
        }),
      };
    }
    case 'designation-summary': {
      const r = await employeeAPI.getAll({ status: 'active' });
      const data: any[] = r.data || [];
      const map = new Map<
        string,
        { count: number; totalSalary: number; dept: string }
      >();
      data.forEach((emp: any) => {
        const key = emp.designation || 'Unknown';
        if (!map.has(key))
          map.set(key, {
            count: 0,
            totalSalary: 0,
            dept: emp.department?.name || '—',
          });
        const e = map.get(key)!;
        e.count++;
        e.totalSalary += emp.salary || 0;
      });
      return {
        headers: [
          'Designation',
          'Department',
          'Count',
          'Total Payroll',
          'Avg Salary',
        ],
        rows: Array.from(map.entries()).map(
          ([desig, { count, totalSalary, dept }]) => [
            desig,
            dept,
            String(count),
            fmtCur(totalSalary),
            fmtCur(count > 0 ? totalSalary / count : 0),
          ],
        ),
      };
    }
    case 'attendance-report': {
      const params: any = { month, year };
      if (dept !== 'all') params.department = dept;
      const r = await attendanceAPI.getAll(params);
      const data: any[] = r.data || [];
      return {
        headers: [
          'Date',
          'Employee',
          'Emp ID',
          'Department',
          'Status',
          'Check In',
          'Check Out',
          'Work Hours',
        ],
        rows: data.map((rec: any) => [
          fmtDate(rec.date),
          rec.employee
            ? `${rec.employee.firstName} ${rec.employee.lastName}`
            : '—',
          rec.employee?.employeeId || '—',
          rec.employee?.department?.name || '—',
          (rec.status || '').toUpperCase().replace('_', ' '),
          fmt(rec.checkIn),
          fmt(rec.checkOut),
          rec.workingHours ? `${rec.workingHours}h` : '—',
        ]),
      };
    }
    case 'attendance-inout': {
      const params: any = { month, year };
      if (dept !== 'all') params.department = dept;
      const r = await attendanceAPI.getAll(params);
      const data: any[] = (r.data || []).filter((rec: any) => rec.checkIn);
      return {
        headers: [
          'Date',
          'Employee',
          'Emp ID',
          'Department',
          'In Time',
          'Out Time',
          'Total Hours',
          'Status',
        ],
        rows: data.map((rec: any) => {
          const hours =
            rec.checkIn && rec.checkOut
              ? (
                  (new Date(rec.checkOut).getTime() -
                    new Date(rec.checkIn).getTime()) /
                  3600000
                ).toFixed(1) + 'h'
              : '—';
          return [
            fmtDate(rec.date),
            rec.employee
              ? `${rec.employee.firstName} ${rec.employee.lastName}`
              : '—',
            rec.employee?.employeeId || '—',
            rec.employee?.department?.name || '—',
            fmt(rec.checkIn),
            rec.checkOut ? fmt(rec.checkOut) : 'MISSING',
            hours,
            (rec.status || '').toUpperCase().replace('_', ' '),
          ];
        }),
      };
    }
    case 'attendance-summary': {
      const params: any = { month, year };
      if (dept !== 'all') params.department = dept;
      const r = await attendanceAPI.getAll(params);
      const data: any[] = r.data || [];
      const map = new Map<string, any>();
      data.forEach((rec: any) => {
        if (!rec.employee) return;
        const id = rec.employee._id;
        if (!map.has(id))
          map.set(id, {
            emp: rec.employee,
            present: 0,
            late: 0,
            absent: 0,
            leave: 0,
            halfDay: 0,
            total: 0,
          });
        const e = map.get(id);
        e.total++;
        if (rec.status === 'present') e.present++;
        else if (rec.status === 'late') e.late++;
        else if (rec.status === 'absent') e.absent++;
        else if (rec.status === 'on_leave') e.leave++;
        else if (rec.status === 'half_day') e.halfDay++;
      });
      return {
        headers: [
          'Emp ID',
          'Employee',
          'Dept',
          'Present',
          'Late',
          'Absent',
          'On Leave',
          'Half Day',
          'Total',
          'Att %',
        ],
        rows: Array.from(map.values()).map(
          ({ emp, present, late, absent, leave, halfDay, total }) => [
            emp.employeeId || '—',
            `${emp.firstName} ${emp.lastName}`,
            emp.department?.name || '—',
            String(present),
            String(late),
            String(absent),
            String(leave),
            String(halfDay),
            String(total),
            total > 0
              ? `${(((present + late) / total) * 100).toFixed(1)}%`
              : '0%',
          ],
        ),
      };
    }
    case 'leave-report': {
      const r = await leaveAPI.getAll({ year });
      const data: any[] = r.data || [];
      return {
        headers: [
          'Emp ID',
          'Employee',
          'Department',
          'Leave Type',
          'From',
          'To',
          'Days',
          'Reason',
          'Status',
        ],
        rows: data.map((l: any) => [
          l.employee?.employeeId || '—',
          l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : '—',
          l.employee?.department?.name || '—',
          l.leaveType
            ? l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1)
            : '—',
          fmtDate(l.startDate),
          fmtDate(l.endDate),
          String(l.days || 0),
          l.reason || '—',
          (l.status || '').toUpperCase(),
        ]),
      };
    }
    case 'miss-punch': {
      const params: any = { month, year };
      if (dept !== 'all') params.department = dept;
      const r = await attendanceAPI.getAll(params);
      const data: any[] = (r.data || []).filter(
        (rec: any) => rec.checkIn && !rec.checkOut,
      );
      return {
        headers: [
          'Date',
          'Emp ID',
          'Employee',
          'Department',
          'Check In',
          'Check Out',
          'Remark',
        ],
        rows: data.map((rec: any) => [
          fmtDate(rec.date),
          rec.employee?.employeeId || '—',
          rec.employee
            ? `${rec.employee.firstName} ${rec.employee.lastName}`
            : '—',
          rec.employee?.department?.name || '—',
          fmt(rec.checkIn),
          'MISSING',
          'Punch-out not recorded',
        ]),
      };
    }
    case 'employee-directory': {
      const r = await employeeAPI.getAll();
      const data: any[] = r.data || [];
      return {
        headers: [
          'Emp ID',
          'First Name',
          'Last Name',
          'Email',
          'Phone',
          'Department',
          'Designation',
          'Type',
          'Status',
          'Salary',
          'Joined',
        ],
        rows: data.map((emp: any) => [
          emp.employeeId || '—',
          emp.firstName || '—',
          emp.lastName || '—',
          emp.email || '—',
          emp.phone || '—',
          typeof emp.department === 'object'
            ? emp.department?.name || '—'
            : '—',
          emp.designation || '—',
          (emp.employmentType || '').replace('_', ' ').toUpperCase(),
          (emp.status || '').toUpperCase(),
          fmtCur(emp.salary || 0),
          fmtDate(emp.joiningDate),
        ]),
      };
    }
    default:
      return { headers: [], rows: [] };
  }
}

// ── Report Detail Modal ─────────────────────────────────────────────────────────
function ReportModal({
  report,
  visible,
  onClose,
}: {
  report: ReportDef | null;
  visible: boolean;
  onClose: () => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState('all');
  const [departments, setDepartments] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const loadDepts = useCallback(async () => {
    try {
      const r = await departmentAPI.getAll();
      setDepartments(r.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (visible && report?.needsDept) loadDepts();
    if (visible) {
      setHeaders([]);
      setRows([]);
      setGenerated(false);
    }
  }, [visible, report, loadDepts]);

  const handleGenerate = async () => {
    if (!report) return;
    setLoading(true);
    try {
      const result = await generateReport(report.id, month, year, dept);
      setHeaders(result.headers);
      setRows(result.rows);
      setGenerated(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleShareCSV = async () => {
    if (!headers.length) return;
    try {
      const csv = toCSV(headers, rows);
      const fn = `${report?.id}_${MONTHS[+month - 1]}_${year}.csv`;
      await Share.share({ message: csv, title: fn });
    } catch {}
  };

  const handlePDF = async () => {
    if (!headers.length) return;
    const label = report?.label || 'Report';
    const period = `${MONTHS[+month - 1]} ${year}`;
    const thCells = headers.map(h => `<th>${h}</th>`).join('');
    const trRows = rows
      .map(
        (r, i) =>
          `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8faff'}">${r.map(c => `<td>${c}</td>`).join('')}</tr>`,
      )
      .join('');
    const html = `<html><head><style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:20px}
      h2{font-size:16px;border-bottom:2px solid #024BAB;padding-bottom:6px;color:#024BAB}
      p{font-size:11px;color:#6b7280;margin:4px 0 12px}
      table{border-collapse:collapse;width:100%}
      th{background:#024BAB;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}
      td{padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}
    </style></head><body>
      <h2>${label}</h2><p>${period} · ${rows.length} records</p>
      <table><thead><tr>${thCells}</tr></thead><tbody>${trRows}</tbody></table>
    </body></html>`;
    try {
      await RNPrint.print({ html });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'PDF generation failed');
    }
  };

  if (!report) return null;

  const needsMonth = !!report.needsMonth;
  const needsDept = !!report.needsDept;
  const needsYear = !!report.needsYear;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={ms.safe} edges={['top']}>
        {/* Header */}
        <View style={ms.header}>
          <View style={{ flex: 1 }}>
            <Text style={ms.title}>{report.label}</Text>
            <Text style={ms.desc} numberOfLines={2}>
              {report.desc}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={ms.closeBtn}>
            <X size={20} color={C.black} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[]}
        >
          {/* Filters */}
          <View style={ms.filterBlock}>
            {needsMonth && (
              <>
                <Text style={ms.filterLabel}>Month</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {MONTHS.map((m, i) => {
                    const val = String(i + 1);
                    const active = month === val;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[ms.chip, active && ms.chipActive]}
                        onPress={() => {
                          setMonth(val);
                          setGenerated(false);
                        }}
                      >
                        <Text
                          style={[ms.chipText, active && { color: C.white }]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
            {(needsMonth || needsYear) && (
              <>
                <Text
                  style={[ms.filterLabel, { marginTop: needsMonth ? 10 : 0 }]}
                >
                  Year
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {YEARS.map(y => {
                    const val = String(y);
                    const active = year === val;
                    return (
                      <TouchableOpacity
                        key={y}
                        style={[ms.chip, active && ms.chipActive]}
                        onPress={() => {
                          setYear(val);
                          setGenerated(false);
                        }}
                      >
                        <Text
                          style={[ms.chipText, active && { color: C.white }]}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
            {needsDept && departments.length > 0 && (
              <>
                <Text style={[ms.filterLabel, { marginTop: 10 }]}>
                  Department
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {[{ _id: 'all', name: 'All Depts' }, ...departments].map(
                    d => {
                      const active = dept === d._id;
                      return (
                        <TouchableOpacity
                          key={d._id}
                          style={[ms.chip, active && ms.chipActive]}
                          onPress={() => {
                            setDept(d._id);
                            setGenerated(false);
                          }}
                        >
                          <Text
                            style={[ms.chipText, active && { color: C.white }]}
                          >
                            {d.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </ScrollView>
              </>
            )}
          </View>

          {/* Generate button */}
          <TouchableOpacity
            style={[ms.genBtn, { backgroundColor: report.color }]}
            onPress={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={ms.genBtnText}>Generate Report</Text>
            )}
          </TouchableOpacity>

          {/* Table */}
          {generated && rows.length === 0 && (
            <View style={ms.empty}>
              <AlertCircle size={32} color="#D1D5DB" />
              <Text style={ms.emptyText}>No data for selected period</Text>
            </View>
          )}

          {generated && rows.length > 0 && (
            <>
              {/* Export buttons */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[
                    ms.exportBtn,
                    { backgroundColor: C.primary, flex: 1 },
                  ]}
                  onPress={handleShareCSV}
                >
                  <Download size={13} color={C.white} />
                  <Text style={ms.exportBtnText}>CSV ({rows.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ms.exportBtn, { backgroundColor: C.danger, flex: 1 }]}
                  onPress={handlePDF}
                >
                  <FileText size={13} color={C.white} />
                  <Text style={ms.exportBtnText}>PDF / Print</Text>
                </TouchableOpacity>
              </View>

              {/* Scrollable table */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={ms.tableOuter}
              >
                <View>
                  {/* Header row */}
                  <View style={ms.tableHeaderRow}>
                    {headers.map((h, i) => (
                      <Text key={i} style={ms.tableHeaderCell}>
                        {h}
                      </Text>
                    ))}
                  </View>
                  {/* Data rows */}
                  {rows.map((row, ri) => (
                    <View
                      key={ri}
                      style={[ms.tableRow, ri % 2 !== 0 && ms.tableRowAlt]}
                    >
                      {row.map((cell, ci) => (
                        <Text key={ci} style={ms.tableCell} numberOfLines={1}>
                          {cell}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const navigation = useNavigation<any>();
  const [catFilter, setCatFilter] = useState<'all' | Category>('all');
  const [activeReport, setActiveReport] = useState<ReportDef | null>(null);

  const CATS: { key: 'all' | Category; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'payroll', label: 'Payroll' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'employee', label: 'Employee' },
  ];

  const visible =
    catFilter === 'all'
      ? REPORTS
      : REPORTS.filter(r => r.category === catFilter);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 4 }}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Text style={s.logoText}>Nest<Text style={{ color: C.primary }}>HR</Text></Text>
        <BarChart2 size={20} color={C.primary} />
        <Text style={s.headerTitle}>Reports</Text>
        <View style={s.countBadge}>
          <Text style={s.countText}>{REPORTS.length}</Text>
        </View>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.catBar}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {CATS.map(c => {
          const active = catFilter === c.key;
          const color =
            c.key === 'all' ? C.black : CAT_COLORS[c.key as Category];
          return (
            <TouchableOpacity
              key={c.key}
              style={[
                s.catChip,
                active && { backgroundColor: color, borderColor: color },
              ]}
              onPress={() => setCatFilter(c.key)}
            >
              <Text style={[s.catChipText, active && { color: C.white }]} numberOfLines={1}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const Icon = item.icon;
          const catColor = CAT_COLORS[item.category];
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => setActiveReport(item)}
              activeOpacity={0.8}
            >
              <View
                style={[s.iconWrap, { backgroundColor: item.color + '18' }]}
              >
                <Icon size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 3,
                  }}
                >
                  <Text style={s.cardLabel}>{item.label}</Text>
                  <View style={[s.catTag, { backgroundColor: catColor }]}>
                    <Text style={s.catTagText}>
                      {item.category.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={s.cardDesc} numberOfLines={2}>
                  {item.desc}
                </Text>
              </View>
              <ChevronRight size={16} color={C.textMuted} />
            </TouchableOpacity>
          );
        }}
      />

      <ReportModal
        report={activeReport}
        visible={!!activeReport}
        onClose={() => setActiveReport(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  logoText: { fontSize: 16, fontWeight: '900', color: C.black },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black, flex: 1 },
  countBadge: {
    backgroundColor: C.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: C.black,
  },
  countText: { color: C.white, fontSize: 10, fontWeight: '700' },
  catBar: {
    maxHeight: 50,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingVertical: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
    minWidth: 90,
    flexShrink: 0,
    alignItems: 'center',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.black,
  },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: { fontSize: 14, fontWeight: '700', color: C.black },
  cardDesc: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    lineHeight: 16,
  },
  catTag: { paddingHorizontal: 6, paddingVertical: 1 },
  catTagText: { fontSize: 8, fontWeight: '700', color: C.white },
});

const CELL_W = 120;
const ms = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: C.black },
  desc: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 17,
  },
  closeBtn: { padding: 4 },
  filterBlock: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: C.black },
  genBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.black,
  },
  genBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 11,
  },
  exportBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  tableOuter: { borderWidth: 2, borderColor: C.black },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  tableHeaderCell: {
    width: CELL_W,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.black,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#F8FAFF' },
  tableCell: {
    width: CELL_W,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: '500',
    color: C.black,
  },
});
