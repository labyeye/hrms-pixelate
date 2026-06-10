import { UserRole } from "@/types/hrms";
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  IndianRupee,
  Briefcase,
  TrendingUp,
  Building2,
  Settings,
  LucideIcon,
  User,
  Lock,
  BarChart2,
  Fingerprint,
  Gift,
  CreditCard,
  SlidersHorizontal,
  FileText,
  Banknote,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const allGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        roles: ["super_admin", "hr_manager", "hr_executive", "department_head"],
      },
      {
        title: "My Profile",
        href: "/my-profile",
        icon: User,
        roles: [
          "super_admin",
          "hr_manager",
          "hr_executive",
          "department_head",
          "employee",
        ],
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        title: "Employees",
        href: "/employees",
        icon: Users,
        roles: ["super_admin", "hr_manager", "hr_executive", "department_head"],
      },
      {
        title: "Departments",
        href: "/departments",
        icon: Building2,
        roles: ["super_admin", "hr_manager"],
      },
      {
        title: "Credentials",
        href: "/employee-credentials",
        icon: Lock,
        roles: ["super_admin", "hr_manager"],
      },
    ],
  },
  {
    label: "Time & Leave",
    items: [
      {
        title: "Attendance",
        href: "/attendance",
        icon: Clock,
        roles: ["super_admin", "hr_manager", "hr_executive", "department_head"],
      },
      {
        title: "Leave",
        href: "/leave",
        icon: CalendarDays,
        roles: ["super_admin", "hr_manager", "hr_executive", "department_head"],
      },
      {
        title: "Holidays",
        href: "/holidays",
        icon: Gift,
        roles: ["super_admin", "hr_manager", "hr_executive", "department_head"],
      },
      {
        title: "Biometric",
        href: "/biometric",
        icon: Fingerprint,
        roles: ["super_admin", "hr_manager"],
      },
    ],
  },
  {
    label: "My Workspace",
    items: [
      {
        title: "My Payroll",
        href: "/my-payroll",
        icon: Banknote,
        roles: ["employee"],
      },
      {
        title: "My Report",
        href: "/my-report",
        icon: FileText,
        roles: ["employee"],
      },
    ],
  },
  {
    label: "Finance & HR",
    items: [
      {
        title: "Payroll",
        href: "/payroll",
        icon: IndianRupee,
        roles: ["super_admin", "hr_manager"],
      },
      {
        title: "Payroll Settings",
        href: "/payroll-settings",
        icon: SlidersHorizontal,
        roles: ["super_admin", "hr_manager"],
      },
      {
        title: "Loans & Advances",
        href: "/loans",
        icon: Banknote,
        roles: ["super_admin", "hr_manager"],
      },
      {
        title: "Recruitment",
        href: "/recruitment",
        icon: Briefcase,
        roles: ["super_admin", "hr_manager", "hr_executive"],
      },
      {
        title: "Performance",
        href: "/performance",
        icon: TrendingUp,
        roles: ["super_admin", "hr_manager", "hr_executive", "department_head"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart2,
        roles: ["super_admin", "hr_manager", "hr_executive"],
      },
      {
        title: "Manage",
        href: "/manage",
        icon: SlidersHorizontal,
        roles: ["super_admin", "hr_manager"],
      },
      {
        title: "Billing",
        href: "/billing",
        icon: CreditCard,
        roles: ["super_admin"],
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["super_admin", "hr_manager"],
      },
    ],
  },
];

export const navItems: NavItem[] = allGroups.flatMap((g) => g.items);

export function getNavForRole(role: UserRole) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function getNavGroupsForRole(role: UserRole): NavGroup[] {
  return allGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((g) => g.items.length > 0);
}
