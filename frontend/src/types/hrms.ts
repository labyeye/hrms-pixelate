export type UserRole =
  | "super_admin"
  | "hr_manager"
  | "hr_executive"
  | "department_head"
  | "employee";

export interface Subscription {
  status: "active" | "inactive" | "pending_renewal" | "trial";
  plan?: string;
  paymentStatus?: "completed" | "pending" | "failed";
}

export interface Company {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive" | "trial";
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
  code: string;
  head?: { _id: string; name: string; email: string };
  description?: string;
  headcount: number;
  budget?: number;
  status: "active" | "inactive";
}

export interface Employee {
  _id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: Department;
  designation: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  joinDate: string;
  exitDate?: string;
  status: "active" | "inactive" | "on_leave" | "terminated";
  salary?: number;
  workDaysPerWeek?: 5 | 6 | 7;
  avatar?: string;
  gender?: "male" | "female" | "other";
  dateOfBirth?: string;
  reportingTo?: { firstName: string; lastName: string };
}

export interface AttendanceRecord {
  _id: string;
  employee: Employee;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status:
    | "present"
    | "absent"
    | "half_day"
    | "late"
    | "on_leave"
    | "holiday"
    | "weekend";
  workHours?: number;
  notes?: string;
}

export interface LeaveRequest {
  _id: string;
  employee: Employee;
  leaveType:
    | "casual"
    | "sick"
    | "earned"
    | "maternity"
    | "paternity"
    | "unpaid"
    | "compensatory";
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy?: { name: string };
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface Payroll {
  _id: string;
  employee: Employee;
  month: number;
  year: number;
  basicSalary: number;
  grossSalary: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  status: "draft" | "processed" | "paid";
  paidAt?: string;
  remarks?: string;
}

export interface Job {
  _id: string;
  title: string;
  department?: Department;
  positions: number;
  type: string;
  status: "open" | "on_hold" | "closed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  description?: string;
  requirements?: string;
  minSalary?: number;
  maxSalary?: number;
  location?: string;
  candidates: Candidate[];
  postedBy?: { name: string };
  closingDate?: string;
  createdAt: string;
}

export interface Candidate {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  stage:
    | "applied"
    | "screening"
    | "interview"
    | "technical"
    | "hr_round"
    | "offered"
    | "hired"
    | "rejected";
  notes?: string;
  appliedAt: string;
}

export interface PerformanceReview {
  _id: string;
  employee: Employee;
  reviewPeriod: string;
  year: number;
  reviewType: "quarterly" | "half_yearly" | "annual" | "probation";
  overallRating?: number;
  status: "draft" | "in_review" | "completed";
  reviewedBy?: { name: string };
  reviewedAt?: string;
}
