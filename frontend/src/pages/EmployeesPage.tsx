import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { employeeAPI, departmentAPI, loanAPI } from "@/services/api";
import { Employee, Department } from "@/types/hrms";
import { cn, formatDate } from "@/lib/utils";
import {
  Plus,
  Search,
  X,
  Users,
  Edit,
  Trash2,
  Eye,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  Banknote,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  active:
    "border-2 bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
  on_leave:
    "border-2 bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  inactive: "border-2 bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
  terminated:
    "border-2 bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444] px-2 py-0.5",
};

const TYPE_COLORS: Record<string, string> = {
  full_time:
    "border-2 bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB] px-2 py-0.5",
  part_time:
    "border-2 bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7] px-2 py-0.5",
  contract:
    "border-2 bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  intern:
    "border-2 bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
};

interface EmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  employmentType: string;
  joinDate: string;
  salary: string;
  gender: string;
  status: string;
  password: string;
  avatar?: string;
  panNumber: string;
  aadharNumber: string;
  address: string;
  dateOfBirth: string;
  emergencyContact: string;
  bankAccount: string;
  accountHolderName: string;
  ifscCode: string;
  bankName: string;
  uanNumber: string;
  esicNumber: string;
  workDaysPerWeek: string;
}

const EMPTY_FORM: EmployeeFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  designation: "",
  department: "",
  employmentType: "full_time",
  joinDate: "",
  salary: "",
  gender: "",
  status: "active",
  password: "hrms@123",
  avatar: "",
  panNumber: "",
  aadharNumber: "",
  address: "",
  dateOfBirth: "",
  emergencyContact: "",
  bankAccount: "",
  accountHolderName: "",
  ifscCode: "",
  bankName: "",
  uanNumber: "",
  esicNumber: "",
  workDaysPerWeek: "6",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [viewEmp, setViewEmp] = useState<Employee | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loanModal, setLoanModal] = useState(false);
  const [loanForm, setLoanForm] = useState({
    employee: "",
    type: "loan",
    amount: "",
    monthlyEmi: "",
    reason: "",
  });
  const [salaryPeriod, setSalaryPeriod] = useState<
    "yearly" | "monthly" | "daily"
  >("monthly");
  const [savingLoan, setSavingLoan] = useState(false);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterDept) params.department = filterDept;
      if (filterStatus) params.status = filterStatus;
      const [empRes, deptRes] = await Promise.all([
        employeeAPI.getAll(params),
        departmentAPI.getAll(),
      ]);
      if (empRes.success) setEmployees(empRes.data);
      if (deptRes.success) setDepartments(deptRes.data);
    } catch {}
    setLoading(false);
  }, [search, filterDept, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-close success modal after 2 seconds
  useEffect(() => {
    if (actionModal.show && actionModal.type === "success") {
      const timer = setTimeout(() => {
        setActionModal({ ...actionModal, show: false });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [actionModal.show, actionModal.type]);

  const openAdd = () => {
    setEditEmp(null);
    setForm(EMPTY_FORM);
    setAvatarPreview(null);
    setShowModal(true);
  };
  const openEdit = (emp: Employee) => {
    setEditEmp(emp);
    setAvatarPreview(emp.avatar || null);
    setForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || "",
      designation: emp.designation,
      department: (emp.department as any)?._id || "",
      employmentType: emp.employmentType,
      joinDate: emp.joinDate?.split("T")[0] || "",
      salary: String(emp.salary || ""),
      gender: emp.gender || "",
      status: emp.status,
      password: "",
      avatar: emp.avatar || "",
      panNumber: (emp as any).panNumber || "",
      aadharNumber: (emp as any).aadharNumber || "",
      address: (emp as any).address || "",
      dateOfBirth: (emp as any).dateOfBirth?.split("T")[0] || "",
      emergencyContact: (emp as any).emergencyContact || "",
      bankAccount: (emp as any).bankAccount || "",
      accountHolderName: (emp as any).accountHolderName || "",
      ifscCode: (emp as any).ifscCode || "",
      bankName: (emp as any).bankName || "",
      uanNumber: (emp as any).uanNumber || "",
      esicNumber: (emp as any).esicNumber || "",
      workDaysPerWeek: String((emp as any).workDaysPerWeek || 6),
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        salary: Number(form.salary) || 0,
        workDaysPerWeek: Number(form.workDaysPerWeek) || 6,
      };

      if (editEmp) {
        await employeeAPI.update(editEmp._id, payload);
      } else {
        await employeeAPI.create(payload);
      }

      setActionModal({
        show: true,
        type: "success",
        title: editEmp ? "Employee Updated" : "Employee Created",
        message: editEmp
          ? "Employee information updated successfully."
          : "New employee added successfully.",
      });
      setTimeout(() => {
        setShowModal(false);
        load();
      }, 500);
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to save employee",
      });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Terminate this employee?")) return;
    try {
      await employeeAPI.delete(id);
      setActionModal({
        show: true,
        type: "success",
        title: "Employee Terminated",
        message: "Employee has been terminated successfully.",
      });
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to delete employee",
      });
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 300;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        setAvatarPreview(compressed);
        setForm((f) => ({ ...f, avatar: compressed }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <AppLayout title="Employees">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {employees.length} total employees
          </p>
        </div>
        <button
          onClick={openAdd}
          className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search by name, ID, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
        {(filterDept || filterStatus) && (
          <button
            onClick={() => {
              setFilterDept("");
              setFilterStatus("");
            }}
            className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-2 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 bg-[#024BAB] border-2 border-black animate-bounce" />
        </div>
      ) : employees.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No employees found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your first employee to get started
          </p>
          <button
            onClick={openAdd}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm mt-4"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Add Employee
          </button>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Department",
                  "Designation",
                  "Type",
                  "Join Date",
                  "Loan Balance",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider"
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
                    "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 border-2 border-black shrink-0 overflow-hidden bg-[#024BAB] flex items-center justify-center text-xs font-bold text-white">
                        {emp.avatar ? (
                          <img
                            src={emp.avatar}
                            alt={emp.firstName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          emp.firstName?.[0]?.toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-black">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {emp.employeeId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-black font-medium">
                    {(emp.department as any)?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-black">{emp.designation}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "border-2 text-[10px] capitalize",
                        TYPE_COLORS[emp.employmentType],
                      )}
                    >
                      {emp.employmentType.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-black text-xs">
                    {formatDate(emp.joinDate)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {(emp as any).loanBalance > 0 ? (
                      <span className="font-bold text-[#EF4444]">
                        ₹{(emp as any).loanBalance.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "border-2 text-[10px] capitalize",
                        STATUS_COLORS[emp.status],
                      )}
                    >
                      {emp.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewEmp(emp)}
                        className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(emp)}
                        className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(emp._id)}
                        className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg text-black">
                {editEmp ? "Edit Employee" : "Add Employee"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-red-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Avatar Upload */}
              <div className="border-b-2 border-black pb-4">
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-3">
                  Profile Picture
                </label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="block px-4 py-3 border-2 border-dashed border-black hover:bg-[#024BAB]/5 transition-colors cursor-pointer text-center"
                    >
                      <Upload className="w-4 h-4 inline mb-1" />
                      <div className="text-xs font-bold text-black">
                        Click to upload photo
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        PNG, JPG up to 5MB
                      </div>
                    </label>
                  </div>
                  {avatarPreview && (
                    <div className="flex items-center gap-2">
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-20 h-20 object-cover border-2 border-black"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarPreview(null);
                          setForm({ ...form, avatar: "" });
                        }}
                        className="px-2 py-1 bg-[#EF4444] text-white text-xs font-bold border-2 border-black hover:bg-[#DC2626]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    label: "First Name",
                    key: "firstName",
                    type: "text",
                    required: true,
                  },
                  {
                    label: "Last Name",
                    key: "lastName",
                    type: "text",
                    required: true,
                  },
                  {
                    label: "Email",
                    key: "email",
                    type: "email",
                    required: true,
                  },
                  {
                    label: "Phone",
                    key: "phone",
                    type: "tel",
                    required: false,
                  },
                  {
                    label: "Designation",
                    key: "designation",
                    type: "text",
                    required: true,
                  },
                  {
                    label: "Join Date",
                    key: "joinDate",
                    type: "date",
                    required: true,
                  },
                  ...(!editEmp
                    ? [
                        {
                          label: "Default Password",
                          key: "password",
                          type: "text",
                          required: false,
                        },
                      ]
                    : []),
                ].map(({ label, key, type, required }) => (
                  <div key={key}>
                    <label className="block text-xs font-bold text-black mb-1">
                      {label}
                    </label>
                    <input
                      type={type}
                      value={(form as any)[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      className="border-2 w-full px-3 py-2 text-sm"
                      required={required}
                    />
                  </div>
                ))}
                {/* Salary with period toggle */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-black mb-1">
                    Salary (₹)
                  </label>
                  <div className="flex gap-0">
                    {(["monthly", "yearly", "daily"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSalaryPeriod(p)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-bold border-2 border-black -ml-[2px] first:ml-0 capitalize transition-colors",
                          salaryPeriod === p
                            ? "bg-[#024BAB] text-white z-10"
                            : "bg-white text-black hover:bg-[#024BAB]/10",
                        )}
                      >
                        Per{" "}
                        {p === "daily"
                          ? "Day"
                          : p === "monthly"
                            ? "Month"
                            : "Year"}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="0"
                      value={
                        salaryPeriod === "monthly"
                          ? form.salary
                            ? Math.round(Number(form.salary) / 12)
                            : ""
                          : salaryPeriod === "daily"
                            ? form.salary
                              ? Math.round(Number(form.salary) / 365)
                              : ""
                            : form.salary
                      }
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        const annual =
                          salaryPeriod === "monthly"
                            ? v * 12
                            : salaryPeriod === "daily"
                              ? v * 365
                              : v;
                        setForm({ ...form, salary: String(annual) });
                      }}
                      className="border-2 border-black border-l-0 flex-1 px-3 py-1.5 text-sm outline-none"
                      placeholder={`Annual = ₹${form.salary ? Number(form.salary).toLocaleString("en-IN") : "0"}`}
                    />
                  </div>
                  {form.salary && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Annual: ₹{Number(form.salary).toLocaleString("en-IN")}{" "}
                      &nbsp;·&nbsp; Monthly: ₹
                      {Math.round(Number(form.salary) / 12).toLocaleString(
                        "en-IN",
                      )}{" "}
                      &nbsp;·&nbsp; Daily: ₹
                      {Math.round(Number(form.salary) / 365).toLocaleString(
                        "en-IN",
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Department
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) =>
                      setForm({ ...form, department: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Employment Type
                  </label>
                  <select
                    value={form.employmentType}
                    onChange={(e) =>
                      setForm({ ...form, employmentType: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      setForm({ ...form, gender: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {editEmp && (
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                      className="border-2 w-full px-3 py-2 text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="on_leave">On Leave</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) =>
                      setForm({ ...form, dateOfBirth: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Emergency Contact
                  </label>
                  <input
                    type="text"
                    value={form.emergencyContact}
                    onChange={(e) =>
                      setForm({ ...form, emergencyContact: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                    placeholder="Name — Phone"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-black mb-1">
                    Address
                  </label>
                  <textarea
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm resize-none"
                    rows={2}
                    placeholder="Full address"
                  />
                </div>
              </div>

              {/* Banking Details */}
              <div className="border-t-2 border-black pt-4">
                <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-3">
                  Banking Details
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      value={form.accountHolderName}
                      onChange={(e) =>
                        setForm({ ...form, accountHolderName: e.target.value })
                      }
                      className="border-2 w-full px-3 py-2 text-sm"
                      placeholder="As per bank records"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Bank Account Number
                    </label>
                    <input
                      type="text"
                      value={form.bankAccount}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          bankAccount: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      className="border-2 w-full px-3 py-2 text-sm"
                      placeholder="Account number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={form.ifscCode}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          ifscCode: e.target.value.toUpperCase(),
                        })
                      }
                      className="border-2 w-full px-3 py-2 text-sm uppercase"
                      placeholder="SBIN0001234"
                      maxLength={11}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={form.bankName}
                      onChange={(e) =>
                        setForm({ ...form, bankName: e.target.value })
                      }
                      className="border-2 w-full px-3 py-2 text-sm"
                      placeholder="e.g. SBI, HDFC"
                    />
                  </div>
                </div>
              </div>

              {/* Identity & Compliance */}
              <div className="border-t-2 border-black pt-4">
                <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-3">
                  Identity & Compliance
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      value={form.panNumber}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          panNumber: e.target.value.toUpperCase(),
                        })
                      }
                      className="border-2 w-full px-3 py-2 text-sm uppercase"
                      placeholder="ABCDE1234F"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Aadhar Number
                    </label>
                    <input
                      type="text"
                      value={form.aadharNumber}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          aadharNumber: e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 12),
                        })
                      }
                      className="border-2 w-full px-3 py-2 text-sm"
                      placeholder="12-digit number"
                      maxLength={12}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      UAN Number
                    </label>
                    <input
                      type="text"
                      value={form.uanNumber}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          uanNumber: e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 12),
                        })
                      }
                      className="border-2 w-full px-3 py-2 text-sm"
                      placeholder="12-digit UAN"
                      maxLength={12}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      ESIC Number
                    </label>
                    <input
                      type="text"
                      value={form.esicNumber}
                      onChange={(e) =>
                        setForm({ ...form, esicNumber: e.target.value })
                      }
                      className="border-2 w-full px-3 py-2 text-sm"
                      placeholder="ESIC number"
                    />
                  </div>
                </div>
              </div>
              {/* Work Days Per Week */}
              <div className="border-t-2 border-black pt-4">
                <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-1">
                  Work Schedule
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  How many days per week does this employee work? Used to
                  calculate monthly working days for payroll.
                </p>
                <div className="flex gap-2">
                  {[
                    { val: "5", label: "5 days", sub: "Mon–Fri" },
                    { val: "6", label: "6 days", sub: "Mon–Sat" },
                    { val: "7", label: "7 days", sub: "Mon–Sun" },
                  ].map(({ val, label, sub }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm({ ...form, workDaysPerWeek: val })}
                      className={`flex-1 py-2.5 border-2 border-black text-sm font-bold transition-colors ${
                        form.workDaysPerWeek === val
                          ? "bg-[#024BAB] text-white"
                          : "bg-white text-black hover:bg-gray-50"
                      }`}
                    >
                      <div>{label}</div>
                      <div className="text-xs font-normal opacity-70">
                        {sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  {saving
                    ? "Saving..."
                    : editEmp
                      ? "Save Changes"
                      : "Add Employee"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border-2 bg-white text-black px-6 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Panel (side sheet) */}
      {viewEmp && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setViewEmp(null)}
          />
          <div className="w-full max-w-sm bg-white border-l-2 border-black flex flex-col overflow-y-auto border-2">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b-2 border-black bg-[#024BAB]">
              <h3 className="font-display font-bold text-lg text-white">
                Employee Profile
              </h3>
              <button
                onClick={() => setViewEmp(null)}
                className="text-white hover:text-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Avatar + name */}
            <div className="p-5 border-b-2 border-black">
              <div className="flex items-center gap-3 mb-3">
                {viewEmp.avatar ? (
                  <img
                    src={viewEmp.avatar}
                    alt="Profile"
                    className="w-14 h-14 object-cover border-2 border-black"
                  />
                ) : (
                  <div className="w-14 h-14 bg-[#024BAB] border-2 border-black flex items-center justify-center text-xl font-bold text-white">
                    {viewEmp.firstName?.[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-black text-black text-base">
                    {viewEmp.firstName} {viewEmp.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {viewEmp.designation}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {viewEmp.employeeId} · {(viewEmp.department as any)?.name}
                  </p>
                  <span
                    className={cn(
                      "border-2 text-[10px] capitalize mt-1 inline-block",
                      STATUS_COLORS[viewEmp.status],
                    )}
                  >
                    {viewEmp.status}
                  </span>
                </div>
              </div>
            </div>
            {/* Salary + loan balance */}
            <div className="grid grid-cols-2 gap-0 border-b-2 border-black">
              <div className="p-4 border-r-2 border-black">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                  Salary (p.a.)
                </p>
                <p className="text-lg font-black text-black">
                  {formatCurrency(viewEmp.salary || 0)}
                </p>
              </div>
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                  Loan Balance
                </p>
                <p
                  className={cn(
                    "text-lg font-black",
                    (viewEmp as any).loanBalance > 0
                      ? "text-[#EF4444]"
                      : "text-black",
                  )}
                >
                  {(viewEmp as any).loanBalance > 0
                    ? formatCurrency((viewEmp as any).loanBalance)
                    : "₹0"}
                </p>
              </div>
            </div>
            {/* Details */}
            <div className="p-5 space-y-2.5 border-b-2 border-black flex-1">
              {[
                ["Email", viewEmp.email],
                ["Phone", viewEmp.phone || "—"],
                ["Join Date", formatDate(viewEmp.joinDate)],
                ["Gender", viewEmp.gender || "—"],
                ["Type", viewEmp.employmentType?.replace("_", " ")],
                [
                  "Date of Birth",
                  (viewEmp as any).dateOfBirth
                    ? formatDate((viewEmp as any).dateOfBirth)
                    : "—",
                ],
                ["Emergency Contact", (viewEmp as any).emergencyContact || "—"],
                ["Bank Account", (viewEmp as any).bankAccount || "—"],
                ["Account Holder", (viewEmp as any).accountHolderName || "—"],
                ["IFSC", (viewEmp as any).ifscCode || "—"],
                ["Bank Name", (viewEmp as any).bankName || "—"],
                ["PAN", (viewEmp as any).panNumber || "—"],
                ["Aadhar", (viewEmp as any).aadharNumber || "—"],
                ["UAN", (viewEmp as any).uanNumber || "—"],
                ["ESIC", (viewEmp as any).esicNumber || "—"],
                ["Address", (viewEmp as any).address || "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between border-b border-black/10 pb-1.5"
                >
                  <span className="text-[10px] font-black text-muted-foreground uppercase">
                    {label}
                  </span>
                  <span className="text-xs font-bold text-black capitalize">
                    {value}
                  </span>
                </div>
              ))}
            </div>
            {/* Quick actions */}
            <div className="p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                Quick Actions
              </p>
              <button
                onClick={() => {
                  setViewEmp(null);
                  openEdit(viewEmp);
                }}
                className="w-full flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white hover:bg-[#01368A]"
              >
                <Edit className="w-4 h-4" /> Edit Employee
              </button>
              <button
                onClick={() => {
                  setLoanForm({
                    employee: viewEmp._id,
                    type: "loan",
                    amount: "",
                    monthlyEmi: "",
                    reason: "",
                  });
                  setLoanModal(true);
                  setViewEmp(null);
                }}
                className="w-full flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#FA731C] text-white hover:bg-[#e0650f]"
              >
                <Banknote className="w-4 h-4" /> Loan / Advance Entry
              </button>
              <button
                onClick={() => {
                  setViewEmp(null);
                }}
                className="w-full flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white text-black hover:bg-gray-50"
              >
                <Clock className="w-4 h-4" /> View Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Entry Modal */}
      {loanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg flex items-center gap-2">
                <Banknote className="w-5 h-5" /> Loan / Advance Entry
              </h3>
              <button onClick={() => setLoanModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingLoan(true);
                try {
                  await loanAPI.create({
                    ...loanForm,
                    amount: parseFloat(loanForm.amount),
                    monthlyEmi: parseFloat(loanForm.monthlyEmi || "0"),
                  });
                  setLoanModal(false);
                  load();
                } catch (err: any) {
                  alert(err.message);
                }
                setSavingLoan(false);
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                  Type
                </label>
                <select
                  value={loanForm.type}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, type: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none"
                >
                  <option value="loan">Loan</option>
                  <option value="advance">Salary Advance</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={loanForm.amount}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, amount: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                  placeholder="e.g. 10000"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                  Monthly EMI (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={loanForm.monthlyEmi}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, monthlyEmi: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                  placeholder="e.g. 1000"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={loanForm.reason}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, reason: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                  placeholder="Medical, home, personal..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingLoan}
                  className="flex-1 bg-[#FA731C] text-white border-2 border-black py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  {savingLoan ? "Saving..." : "Create Loan Entry"}
                </button>
                <button
                  type="button"
                  onClick={() => setLoanModal(false)}
                  className="flex-1 border-2 border-black py-2.5 text-sm font-bold bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success/Error Animation Modal */}
      {actionModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-sm p-8 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
            {actionModal.type === "success" ? (
              <>
                <div className="mb-4 animate-bounce">
                  <CheckCircle className="w-16 h-16 text-[#00C48C]" />
                </div>
                <h2 className="text-2xl font-display font-bold text-black mb-2">
                  {actionModal.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {actionModal.message}
                </p>
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse delay-100" />
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse delay-200" />
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 animate-bounce">
                  <AlertCircle className="w-16 h-16 text-[#EF4444]" />
                </div>
                <h2 className="text-2xl font-display font-bold text-black mb-2">
                  {actionModal.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {actionModal.message}
                </p>
                <button
                  onClick={() =>
                    setActionModal({ ...actionModal, show: false })
                  }
                  className="mt-4 px-6 py-2 bg-[#EF4444] text-white text-sm font-bold border-2 border-[#EF4444] hover:bg-[#EF4444]/90 transition-colors"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
