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
  TextInput,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import { NESTHR_LOGO_B64 } from '../assets/nesthrLogoB64';
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
  Search,
  User,
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
  {
    id: 'employee-report',
    label: 'Employee Report',
    desc: 'Select an employee and report type — attendance, salary slip, leave, or profile.',
    category: 'employee',
    icon: FileText,
    color: '#024BAB',
    needsMonth: true,
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
    case 'employee-report':
      return { headers: [], rows: [] };
    default:
      return { headers: [], rows: [] };
  }
}

async function generateEmployeeReport(
  subType: string,
  empId: string,
  month: string,
  year: string,
): Promise<{ headers: string[]; rows: string[][] }> {
  switch (subType) {
    case 'attendance': {
      const r = await attendanceAPI.getAll({ employeeId: empId, month, year, limit: '60' });
      const data: any[] = (r.data || []).sort(
        (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      return {
        headers: ['Date', 'Status', 'Check In', 'Check Out', 'Hours'],
        rows: data.map((rec: any) => {
          const hours =
            rec.checkIn && rec.checkOut
              ? ((new Date(rec.checkOut).getTime() - new Date(rec.checkIn).getTime()) / 3600000).toFixed(1) + 'h'
              : '—';
          return [
            fmtDate(rec.date),
            (rec.status || '').toUpperCase().replace('_', ' '),
            fmt(rec.checkIn),
            fmt(rec.checkOut),
            hours,
          ];
        }),
      };
    }
    case 'salary-slip': {
      const r = await payrollAPI.getAll({ employeeId: empId, month, year });
      const data: any[] = r.data || [];
      const p = data[0];
      if (!p) return { headers: ['Component', 'Amount'], rows: [] };
      return {
        headers: ['Component', 'Amount'],
        rows: [
          ['Basic Salary', fmtCur(p.basicSalary || 0)],
          ['HRA', fmtCur(p.hra || 0)],
          ['DA', fmtCur(p.da || 0)],
          ['TA', fmtCur(p.ta || 0)],
          ['Medical Allowance', fmtCur(p.medicalAllowance || 0)],
          ['Gross Salary', fmtCur(p.grossSalary || 0)],
          ['PF (Deduction)', `- ${fmtCur(p.pf || 0)}`],
          ['ESI (Deduction)', `- ${fmtCur(p.esi || 0)}`],
          ['TDS (Deduction)', `- ${fmtCur(p.tds || 0)}`],
          ['Total Deductions', `- ${fmtCur(p.totalDeductions || 0)}`],
          ['NET PAY', fmtCur(p.netSalary || 0)],
        ],
      };
    }
    case 'leave': {
      const r = await leaveAPI.getAll({ employeeId: empId, year, limit: '200' });
      const data: any[] = r.data || [];
      return {
        headers: ['From', 'To', 'Days', 'Type', 'Reason', 'Status'],
        rows: data.map((l: any) => [
          fmtDate(l.startDate),
          fmtDate(l.endDate),
          String(l.days || 0),
          l.leaveType ? l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1) : '—',
          l.reason || '—',
          (l.status || '').toUpperCase(),
        ]),
      };
    }
    default:
      return { headers: [], rows: [] };
  }
}

const EMP_REPORT_SUB_TYPES = [
  { id: 'attendance', label: 'Attendance', desc: 'Monthly attendance — daily status & times' },
  { id: 'salary-slip', label: 'Salary Slip', desc: 'Earnings, deductions & net pay' },
  { id: 'leave', label: 'Leave Report', desc: 'Yearly leave history & approval' },
];

const AVATAR_PALETTE_M = ['#024BAB','#00C48C','#FA731C','#7C3AED','#0891B2','#DC2626'];
function avatarBgM(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_PALETTE_M[Math.abs(h) % AVATAR_PALETTE_M.length];
}
function initialsM(name: string) {
  return name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
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

  // Employee report sub-state
  const isEmpReport = report?.id === 'employee-report';
  const [empSearch, setEmpSearch] = useState('');
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [empSubType, setEmpSubType] = useState('attendance');

  const loadDepts = useCallback(async () => {
    try {
      const r = await departmentAPI.getAll();
      setDepartments(r.data || []);
    } catch {}
  }, []);

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const r = await employeeAPI.getAll({ status: 'active', limit: '500' });
      setAllEmployees(r.data || []);
    } catch {}
    setEmpLoading(false);
  }, []);

  useEffect(() => {
    if (visible && report?.needsDept) loadDepts();
    if (visible && isEmpReport) loadEmployees();
    if (visible) {
      setHeaders([]);
      setRows([]);
      setGenerated(false);
      setSelectedEmp(null);
      setEmpSearch('');
    }
  }, [visible, report, loadDepts, isEmpReport, loadEmployees]);

  const handleGenerate = async () => {
    if (!report) return;
    setLoading(true);
    try {
      let result: { headers: string[]; rows: string[][] };
      if (isEmpReport && selectedEmp) {
        result = await generateEmployeeReport(empSubType, selectedEmp._id, month, year);
      } else {
        result = await generateReport(report.id, month, year, dept);
      }
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

    const STATUS_COLORS: Record<string, string> = {
      present: 'background:#DCFCE7;color:#15803D;border:1px solid #86EFAC',
      late: 'background:#FFF7ED;color:#C2410C;border:1px solid #FED7AA',
      absent: 'background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA',
      'half day': 'background:#FEFCE8;color:#A16207;border:1px solid #FDE68A',
      'half_day': 'background:#FEFCE8;color:#A16207;border:1px solid #FDE68A',
      'on leave': 'background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE',
      'on_leave': 'background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE',
      leave: 'background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE',
      holiday: 'background:#FAF5FF;color:#7C3AED;border:1px solid #DDD6FE',
      weekend: 'background:#F9FAFB;color:#6B7280;border:1px solid #E5E7EB',
      paid: 'background:#DCFCE7;color:#15803D;border:1px solid #86EFAC',
      pending: 'background:#FFF7ED;color:#C2410C;border:1px solid #FED7AA',
      approved: 'background:#DCFCE7;color:#15803D;border:1px solid #86EFAC',
      rejected: 'background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA',
      cancelled: 'background:#F9FAFB;color:#6B7280;border:1px solid #E5E7EB',
      active: 'background:#DCFCE7;color:#15803D;border:1px solid #86EFAC',
      inactive: 'background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA',
      terminated: 'background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA',
      missing: 'background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA',
    };
    const AVATAR_PALETTE = ['#024BAB','#00C48C','#FA731C','#7C3AED','#0891B2','#DC2626'];
    function avatarBg(name: string) {
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
      return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
    }
    function initials(name: string) {
      return name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
    }

    const nameColIdx = headers.findIndex(h => ['employee','name','employee name'].includes(h.toLowerCase()));
    const statusColIdx = headers.findIndex(h => ['status','payment status'].includes(h.toLowerCase()));

    const thCells = headers.map(h =>
      `<th style="background:#024BAB;color:#fff;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">${h}</th>`
    ).join('');

    const trRows = rows.map((row, i) =>
      `<tr style="background:${i % 2 === 0 ? '#fff' : '#F8FAFF'}">
        ${row.map((cell, ci) => {
          let content = cell;
          if (ci === statusColIdx) {
            const key = cell.toLowerCase().trim();
            const style = STATUS_COLORS[key];
            if (style) content = `<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;text-transform:uppercase;${style}">${cell}</span>`;
          } else if (ci === nameColIdx && cell && cell !== '—') {
            const bg = avatarBg(cell);
            const ini = initials(cell);
            content = `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${bg};color:#fff;font-size:9px;font-weight:700;flex-shrink:0;">${ini}</span><span>${cell}</span></span>`;
          }
          return `<td style="padding:7px 10px;border-bottom:1px solid #E5E7EB;font-size:11px;white-space:nowrap;vertical-align:middle;">${content}</td>`;
        }).join('')}
      </tr>`
    ).join('');

    const now = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${label}</title>
    <style>
      @page { size: A4 landscape; margin: 15mm 12mm 20mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size:9px;color:#6B7280; } }
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:12px;color:#111}
      .hdr{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #024BAB;padding-bottom:10px;margin-bottom:14px}
      .hdr-l{display:flex;align-items:center;gap:12px}
      .logo{height:38px}
      .brand{font-size:11px;color:#6B7280;line-height:1.4}
      .brand b{font-size:18px;color:#024BAB;display:block;font-weight:900}
      .meta{text-align:right}
      .meta-title{font-size:16px;font-weight:700;color:#024BAB}
      .meta-period{font-size:11px;color:#6B7280;margin-top:2px}
      .meta-gen{font-size:9px;color:#9CA3AF;margin-top:2px}
      .stat{border-left:3px solid #024BAB;padding:4px 10px;margin-bottom:12px;display:inline-block}
      .stat-v{font-size:16px;font-weight:700;color:#024BAB}
      .stat-l{font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px}
      table{border-collapse:collapse;width:100%;table-layout:auto}
      thead{display:table-header-group}
      tr{page-break-inside:avoid}
      .footer{margin-top:14px;border-top:1px solid #E5E7EB;padding-top:6px;display:flex;justify-content:space-between;font-size:9px;color:#9CA3AF}
    </style></head><body>
      <div class="hdr">
        <div class="hdr-l">
          <img src="${NESTHR_LOGO_B64}" class="logo" alt="NestHR"/>
          <div class="brand"><b>NestHR</b>Human Resource Management System</div>
        </div>
        <div class="meta">
          <div class="meta-title">${label}</div>
          <div class="meta-period">${period}</div>
          <div class="meta-gen">Generated: ${now}</div>
        </div>
      </div>
      <div class="stat"><div class="stat-v">${rows.length}</div><div class="stat-l">Total Records</div></div>
      <table>
        <thead><tr>${thCells}</tr></thead>
        <tbody>${trRows}</tbody>
      </table>
      <div class="footer"><span>NestHR — Confidential HR Report</span><span>${label} · ${period}</span></div>
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
          {/* Employee picker — only for employee-report */}
          {isEmpReport && (
            <View style={ms.filterBlock}>
              <Text style={ms.filterLabel}>Step 1 — Select Employee</Text>
              <View style={ms.searchRow}>
                <Search size={14} color={C.textMuted} />
                <TextInput
                  style={ms.searchInput}
                  placeholder="Search by name or ID..."
                  placeholderTextColor={C.textMuted}
                  value={empSearch}
                  onChangeText={setEmpSearch}
                />
              </View>
              {empLoading ? (
                <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />
              ) : (
                <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                  {allEmployees
                    .filter(e => {
                      const q = empSearch.toLowerCase();
                      return !q ||
                        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
                        (e.employeeId || '').toLowerCase().includes(q);
                    })
                    .map(emp => {
                      const name = `${emp.firstName} ${emp.lastName}`;
                      const bg = avatarBgM(name);
                      const ini = initialsM(name);
                      const isSelected = selectedEmp?._id === emp._id;
                      return (
                        <TouchableOpacity
                          key={emp._id}
                          style={[ms.empRow, isSelected && ms.empRowSelected]}
                          onPress={() => { setSelectedEmp(emp); setGenerated(false); }}
                        >
                          <View style={[ms.empAvatar, { backgroundColor: bg }]}>
                            <Text style={ms.empAvatarText}>{ini}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[ms.empName, isSelected && { color: C.white }]}>{name}</Text>
                            <Text style={[ms.empSub, isSelected && { color: C.white + 'cc' }]}>
                              {emp.employeeId} · {emp.department?.name || emp.designation}
                            </Text>
                          </View>
                          {isSelected && <User size={14} color={C.white} />}
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              )}

              {selectedEmp && (
                <>
                  <Text style={[ms.filterLabel, { marginTop: 14 }]}>Step 2 — Report Type</Text>
                  <View style={{ gap: 8 }}>
                    {EMP_REPORT_SUB_TYPES.map(sub => {
                      const active = empSubType === sub.id;
                      return (
                        <TouchableOpacity
                          key={sub.id}
                          style={[ms.subTypeBtn, active && { backgroundColor: C.primary, borderColor: C.primary }]}
                          onPress={() => { setEmpSubType(sub.id); setGenerated(false); }}
                        >
                          <Text style={[ms.subTypeBtnLabel, active && { color: C.white }]}>{sub.label}</Text>
                          <Text style={[ms.subTypeBtnDesc, active && { color: C.white + 'cc' }]}>{sub.desc}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}

          {/* Filters — hidden for employee-report (uses picker above) */}
          {!isEmpReport && (<View style={ms.filterBlock}>
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
          </View>)}

          {/* Generate button */}
          <TouchableOpacity
            style={[ms.genBtn, { backgroundColor: report.color, opacity: (isEmpReport && !selectedEmp) ? 0.4 : 1 }]}
            onPress={handleGenerate}
            disabled={loading || (isEmpReport && !selectedEmp)}
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
        contentContainerStyle={{ gap: 8, paddingHorizontal: 6 }}
      >
        {CATS.map(c => {
          const active = catFilter === c.key;
          const color =
            c.key === 'all' ? C.primary : CAT_COLORS[c.key as Category];
          return (
            <TouchableOpacity
              key={c.key}
              style={[
                s.catChip,
                active && { backgroundColor: color, borderColor: color },
              ]}
              onPress={() => setCatFilter(c.key)}
            >
              <Text
                style={[s.catChipText, active && { color: C.white }]}
                numberOfLines={1}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={item => item.id}
        style={{ flex: 1 }}
  contentContainerStyle={{
    padding: 16,
    gap: 10,
    paddingBottom: 32,
    flexGrow: 1,
  }}
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
  logoText: { fontSize: 16, fontWeight: '700', color: C.black },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black, flex: 1 },
  countBadge: {
    backgroundColor: C.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: C.black,
  },
  countText: { color: C.white, fontSize: 12, fontWeight: '700' },
  catBar: {
    maxHeight: 48,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingVertical: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.black,
    textAlign: 'center',
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
    fontSize: 12,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: C.black,
    padding: 0,
  },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.black + '22',
    marginBottom: 6,
    backgroundColor: C.white,
  },
  empRowSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  empAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.white,
  },
  empName: {
    fontSize: 13,
    fontWeight: '700',
    color: C.black,
  },
  empSub: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textMuted,
    marginTop: 1,
  },
  subTypeBtn: {
    borderWidth: 2,
    borderColor: C.black,
    padding: 10,
    backgroundColor: C.white,
  },
  subTypeBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.black,
  },
  subTypeBtnDesc: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textMuted,
    marginTop: 2,
  },
});
