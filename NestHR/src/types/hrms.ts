export type UserRole =
  | 'super_admin'
  | 'hr_manager'
  | 'hr_executive'
  | 'department_head'
  | 'employee';

export interface Subscription {
  status: string;
  plan: string;
  paymentStatus: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  status: string;
  subscription?: Subscription;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  status?: string;
  department?: string;
  company?: Company;
  subscription?: Subscription;
}

export interface Department {
  _id: string;
  name: string;
  description?: string;
  headCount?: number;
  budget?: number;
  isActive: boolean;
}

export interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string;
  phone?: string;
  department?: { _id: string; name: string } | string;
  designation?: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  status: 'active' | 'inactive' | 'terminated' | 'on_leave';
  joiningDate: string;
  salary?: number;
  avatar?: string;
  biometricUserId?: string;
  rfidCard?: string;
  faceDescriptor?: number[];
}

export interface AttendanceRecord {
  _id: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  date: string;
  status:
    | 'present'
    | 'absent'
    | 'half_day'
    | 'late'
    | 'on_leave'
    | 'holiday'
    | 'weekend';
  checkIn?: string;
  checkOut?: string;
  workingHours?: number;
  notes?: string;
}

export interface LeaveRequest {
  _id: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  leaveType:
    | 'casual'
    | 'sick'
    | 'earned'
    | 'maternity'
    | 'paternity'
    | 'unpaid'
    | 'compensatory';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  isHalfDay?: boolean;
}

export interface Payroll {
  _id: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  month: number;
  year: number;
  basicSalary: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  status: 'draft' | 'processed' | 'paid';
}

export interface Job {
  _id: string;
  title: string;
  department?: string;
  status: 'open' | 'on_hold' | 'closed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  openings: number;
  candidates: Candidate[];
}

export interface Candidate {
  _id: string;
  name: string;
  email: string;
  stage:
    | 'applied'
    | 'screening'
    | 'interview'
    | 'technical'
    | 'hr_round'
    | 'offered'
    | 'hired'
    | 'rejected';
}

export interface PerformanceReview {
  _id: string;
  employee: { _id: string; firstName: string; lastName: string };
  reviewType: 'quarterly' | 'half_yearly' | 'annual' | 'probation';
  rating: number;
  status: 'draft' | 'in_review' | 'completed';
  reviewDate: string;
  comments?: string;
}
