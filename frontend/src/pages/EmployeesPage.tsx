import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  employeeAPI,
  departmentAPI,
  loanAPI,
  transactionAPI,
} from "@/services/api";
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
  ArrowLeft,
  ArrowRight,
  Calendar,
  FileText,
  IndianRupee,
  TrendingUp,
  UserCheck,
  Printer,
  Building2,
  Phone,
  Mail,
  CreditCard,
  Shield,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ActionModal } from "@/components/ui/ActionModal";

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

const FORM_TABS = ["Basic Info", "Attendance", "Salary", "Other Info"];

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
  pfNumber: string;
  workDaysPerWeek: string;
  otRate: string;
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
  gender: "male",
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
  pfNumber: "",
  workDaysPerWeek: "6",
  otRate: "",
};

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formTab, setFormTab] = useState(0);
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
  const [savingLoan, setSavingLoan] = useState(false);
  const [txModal, setTxModal] = useState<
    "allowance" | "penalty" | "overtime" | null
  >(null);
  const [txForm, setTxForm] = useState({
    employee: "",
    amount: "",
    hours: "",
    date: new Date().toISOString().split("T")[0],
    remark: "",
  });
  const [savingTx, setSavingTx] = useState(false);
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

  const openAdd = () => {
    setEditEmp(null);
    setForm(EMPTY_FORM);
    setAvatarPreview(null);
    setFormTab(0);
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
      gender: emp.gender || "male",
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
      pfNumber: (emp as any).pfNumber || "",
      workDaysPerWeek: String((emp as any).workDaysPerWeek || 6),
      otRate: String((emp as any).otRate || ""),
    });
    setFormTab(0);
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
        otRate: Number(form.otRate) || 0,
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

  const totalSalary = employees.reduce(
    (s, e) => s + ((e as any).salary ?? 0),
    0,
  );
  const totalLoan = employees.reduce(
    (s, e) => s + ((e as any).loanBalance ?? 0),
    0,
  );
  const totalEstBalance = totalSalary - totalLoan;

  return (
    <AppLayout title="Employees">
      {}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-black text-2xl text-black">
          Employees
        </h1>
        <button
          onClick={openAdd}
          className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Employees
            </p>
            <p className="text-2xl font-black text-black">{employees.length}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Est. Balance
            </p>
            <p
              className={`text-2xl font-black ${totalEstBalance < 0 ? "text-red-500" : "text-[#00C48C]"}`}
            >
              {formatCurrency(totalEstBalance)}
            </p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#EF4444]/10 border-2 border-[#EF4444] flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5 text-[#EF4444]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Loan Balance
            </p>
            <p className="text-2xl font-black text-[#EF4444]">
              {formatCurrency(totalLoan)}
            </p>
          </div>
        </div>
      </div>

      {}
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

      {}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 bg-[#024BAB] border-2 border-black animate-bounce" />
        </div>
      ) : employees.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No employees found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your first employee to get started
          </p>
          <button
            onClick={openAdd}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm mt-4"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Add Employee
          </button>
        </div>
      ) : (
        <div className="border-2 border-black bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Department",
                  "Designation",
                  "Est. Balance",
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
                    "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors cursor-pointer",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                  onClick={() => setViewEmp(emp)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 border-[1px] border-black shrink-0 overflow-hidden bg-[#024BAB] flex items-center justify-center text-xs font-bold text-white rounded-full">
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
                  <td className="px-4 py-3 text-xs font-bold">
                    {(() => {
                      const sal = (emp as any).salary ?? 0;
                      const loan = (emp as any).loanBalance ?? 0;
                      const bal = sal - loan;
                      if (!sal)
                        return <span className="text-muted-foreground">—</span>;
                      return (
                        <span
                          className={
                            bal < 0
                              ? "text-[#EF4444]"
                              : bal < sal * 0.3
                                ? "text-amber-600"
                                : "text-[#00C48C]"
                          }
                        >
                          ₹
                          {bal.toLocaleString("en-IN", {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      );
                    })()}
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
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewEmp(emp)}
                        className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                        title="View Profile"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(emp)}
                        className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(emp._id)}
                        className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50 transition-colors"
                        title="Terminate"
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

      {}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-3xl max-h-[95vh] flex flex-col">
            {}
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-[#024BAB]">
              <div className="flex items-center gap-3">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="avatar"
                    className="w-10 h-10 rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-white font-bold">
                    {form.firstName?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-lg text-white">
                    {editEmp ? "Edit Employee" : "Add Employee"}
                  </h3>
                  {(form.firstName || form.lastName) && (
                    <p className="text-white/70 text-xs">
                      {form.firstName} {form.lastName}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-white/70 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {}
            <div className="flex border-b-2 border-black">
              {FORM_TABS.map((tab, idx) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFormTab(idx)}
                  className={cn(
                    "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-r-2 border-black last:border-r-0",
                    formTab === idx
                      ? "bg-[#024BAB] text-white"
                      : "bg-white text-black hover:bg-[#024BAB]/5",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black mr-1.5",
                      formTab === idx
                        ? "bg-white text-[#024BAB]"
                        : "bg-black/10 text-black",
                    )}
                  >
                    {idx + 1}
                  </span>
                  {tab}
                </button>
              ))}
            </div>

            {}
            <form
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto flex flex-col"
            >
              <div className="p-6 flex-1">
                {}
                {formTab === 0 && (
                  <div className="space-y-5">
                    {}
                    <div className="flex items-start gap-4 p-4 bg-[#F8FAFF] border-2 border-black">
                      <div className="relative shrink-0">
                        <div className="w-20 h-20 border-2 border-black overflow-hidden bg-[#024BAB] flex items-center justify-center">
                          {avatarPreview ? (
                            <img
                              src={avatarPreview}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl font-bold text-white">
                              {form.firstName?.[0]?.toUpperCase() || "?"}
                            </span>
                          )}
                        </div>
                        <label
                          htmlFor="avatar-upload"
                          className="absolute -bottom-2 -right-2 w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center cursor-pointer hover:bg-[#01368A]"
                        >
                          <Upload className="w-3.5 h-3.5 text-white" />
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          id="avatar-upload"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black uppercase tracking-wider text-black mb-1">
                          Profile Photo
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Click the camera icon to upload. PNG, JPG up to 10MB.
                        </p>
                        {avatarPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setAvatarPreview(null);
                              setForm({ ...form, avatar: "" });
                            }}
                            className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1 hover:underline"
                          >
                            <X className="w-3 h-3" /> Remove photo
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.firstName}
                          onChange={(e) =>
                            setForm({ ...form, firstName: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="e.g. Ravi"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.lastName}
                          onChange={(e) =>
                            setForm({ ...form, lastName: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="e.g. Kumar"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="employee@company.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Mobile Number
                        </label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) =>
                            setForm({ ...form, phone: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="+91 XXXXX XXXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Designation <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.designation}
                          onChange={(e) =>
                            setForm({ ...form, designation: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="e.g. Senior Engineer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Joining Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={form.joinDate}
                          onChange={(e) =>
                            setForm({ ...form, joinDate: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                        />
                      </div>
                    </div>

                    {}
                    <div>
                      <label className="block text-xs font-bold text-black mb-2">
                        Gender
                      </label>
                      <div className="flex gap-3">
                        {["male", "female", "other"].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setForm({ ...form, gender: g })}
                            className={cn(
                              "flex-1 py-2.5 border-2 border-black text-sm font-bold capitalize transition-colors",
                              form.gender === g
                                ? "bg-[#024BAB] text-white"
                                : "bg-white text-black hover:bg-[#024BAB]/5",
                            )}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Department
                        </label>
                        <select
                          value={form.department}
                          onChange={(e) =>
                            setForm({ ...form, department: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
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
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                        >
                          <option value="full_time">Full Time</option>
                          <option value="part_time">Part Time</option>
                          <option value="contract">Contract</option>
                          <option value="intern">Intern</option>
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
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                          >
                            <option value="active">Active</option>
                            <option value="on_leave">On Leave</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      )}
                      {!editEmp && (
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Default Password
                          </label>
                          <input
                            type="text"
                            value={form.password}
                            onChange={(e) =>
                              setForm({ ...form, password: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="hrms@123"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {}
                {formTab === 1 && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-1">
                        Work Schedule
                      </p>
                      <p className="text-xs text-gray-500 mb-4">
                        How many days per week does this employee work? Used to
                        calculate monthly working days for payroll.
                      </p>
                      <div className="flex gap-3">
                        {[
                          { val: "5", label: "5 Days", sub: "Mon – Fri" },
                          { val: "6", label: "6 Days", sub: "Mon – Sat" },
                          { val: "7", label: "7 Days", sub: "Mon – Sun" },
                        ].map(({ val, label, sub }) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() =>
                              setForm({ ...form, workDaysPerWeek: val })
                            }
                            className={cn(
                              "flex-1 py-5 border-2 border-black text-sm font-bold transition-colors",
                              form.workDaysPerWeek === val
                                ? "bg-[#024BAB] text-white"
                                : "bg-white text-black hover:bg-[#024BAB]/5",
                            )}
                          >
                            <div className="text-xl font-black mb-1">
                              {label}
                            </div>
                            <div className="text-xs font-normal opacity-70">
                              {sub}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-4">
                        Overtime & Biometric
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            OT Rate (₹ / Hour)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={form.otRate}
                            onChange={(e) =>
                              setForm({ ...form, otRate: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="e.g. 50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Biometric User ID
                          </label>
                          <input
                            type="text"
                            value={(form as any).biometricUserId || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                ["biometricUserId" as any]: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="Device user ID (e.g. 1, 2, 3)"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#F8FAFF] border-2 border-black p-4">
                      <p className="text-xs font-bold text-black mb-1">
                        Shift Assignment
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Shifts are managed under{" "}
                        <strong>Manage → Shifts</strong>. Assign a shift after
                        creation, or use the Attendance page to override
                        individual days.
                      </p>
                    </div>
                  </div>
                )}

                {}
                {formTab === 2 && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-4">
                        Salary Information
                      </p>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Monthly Salary (₹ / Month)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.salary}
                          onChange={(e) =>
                            setForm({ ...form, salary: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="e.g. 15000"
                        />
                        {form.salary && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {[
                              {
                                label: "Monthly",
                                value: `₹${Number(form.salary).toLocaleString("en-IN")}`,
                              },
                              {
                                label: "Annual",
                                value: `₹${(Number(form.salary) * 12).toLocaleString("en-IN")}`,
                              },
                            ].map(({ label, value }) => (
                              <div
                                key={label}
                                className="bg-[#F8FAFF] border-2 border-black p-3 text-center"
                              >
                                <p className="text-[10px] font-black uppercase text-muted-foreground">
                                  {label}
                                </p>
                                <p className="text-sm font-black text-black mt-0.5">
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-4">
                        Compliance Numbers
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            PF Number
                          </label>
                          <input
                            type="text"
                            value={form.pfNumber}
                            onChange={(e) =>
                              setForm({ ...form, pfNumber: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="PF account number"
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
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
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
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="ESIC number"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {}
                {formTab === 3 && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-4">
                        Personal Details
                      </p>
                      <div className="grid grid-cols-2 gap-4">
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
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
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
                              setForm({
                                ...form,
                                emergencyContact: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
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
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 resize-none"
                            rows={2}
                            placeholder="Full residential address"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-4">
                        Identity Documents
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
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 uppercase"
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
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="12-digit number"
                            maxLength={12}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-black uppercase tracking-wider text-[#024BAB] mb-4">
                        Bank Details
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
                              setForm({
                                ...form,
                                accountHolderName: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
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
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
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
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 uppercase"
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
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="e.g. SBI, HDFC, ICICI"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {}
              <div className="flex items-center justify-between px-6 py-4 border-t-2 border-black bg-[#F8FAFF]">
                <button
                  type="button"
                  onClick={() => setFormTab((t) => Math.max(0, t - 1))}
                  disabled={formTab === 0}
                  className="flex items-center gap-2 border-2 border-black px-4 py-2 text-sm font-bold bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Previous
                </button>

                <div className="flex gap-1.5">
                  {FORM_TABS.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormTab(idx)}
                      className={cn(
                        "h-2 rounded-full border border-black transition-all",
                        formTab === idx ? "bg-[#024BAB] w-6" : "bg-white w-2",
                      )}
                    />
                  ))}
                </div>

                {formTab < FORM_TABS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setFormTab((t) => Math.min(FORM_TABS.length - 1, t + 1))
                    }
                    className="flex items-center gap-2 border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold hover:bg-[#01368A]"
                  >
                    Next <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 border-2 border-black bg-[#024BAB] text-white px-6 py-2 text-sm font-bold hover:bg-[#01368A] disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {saving
                      ? "Saving..."
                      : editEmp
                        ? "Save Changes"
                        : "Add Employee"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {viewEmp && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          {}
          <div className="sticky top-0 bg-white border-b-2 border-black flex items-center justify-between px-6 py-3 z-10">
            <button
              onClick={() => setViewEmp(null)}
              className="flex items-center gap-2 text-sm font-bold text-black hover:text-[#024BAB] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="font-bold text-base">Employee Profile</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setViewEmp(null);
                  openEdit(viewEmp);
                }}
                className="flex items-center gap-1.5 border-2 border-black px-3 py-1.5 text-xs font-bold bg-[#024BAB] text-white hover:bg-[#01368A]"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => {
                  handleDelete(viewEmp._id);
                  setViewEmp(null);
                }}
                className="flex items-center gap-1.5 border-2 border-black px-3 py-1.5 text-xs font-bold bg-white text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Terminate
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto p-6 space-y-4">
            {}
            <div className="border-2 border-black bg-white p-5">
              <div className="flex items-start gap-5">
                <div className="shrink-0">
                  {viewEmp.avatar ? (
                    <img
                      src={viewEmp.avatar}
                      alt="Profile"
                      className="w-20 h-20 object-cover border-2 border-black"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-[#024BAB] border-2 border-black flex items-center justify-center text-3xl font-bold text-white">
                      {viewEmp.firstName?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-bold">
                        {viewEmp.employeeId}
                      </p>
                      <h1 className="text-2xl font-black text-black mt-0.5">
                        {viewEmp.firstName} {viewEmp.lastName}
                      </h1>
                      <p className="text-sm font-medium text-muted-foreground mt-0.5">
                        {viewEmp.designation}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "border-2 text-[11px] capitalize shrink-0 mt-1",
                        STATUS_COLORS[viewEmp.status],
                      )}
                    >
                      {viewEmp.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-3">
                    {viewEmp.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-black">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{viewEmp.phone}</span>
                      </div>
                    )}
                    {viewEmp.email && (
                      <div className="flex items-center gap-1.5 text-xs text-black col-span-2">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          {viewEmp.email}
                        </span>
                      </div>
                    )}
                    {(viewEmp.department as any)?.name && (
                      <div className="flex items-center gap-1.5 text-xs text-black">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">
                          {(viewEmp.department as any)?.name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-black">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">
                        Joined {formatDate(viewEmp.joinDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-black">
                      <IndianRupee className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">
                        {formatCurrency(viewEmp.salary || 0)} / month
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span
                        className={cn(
                          "border-2 text-[10px] capitalize",
                          TYPE_COLORS[viewEmp.employmentType],
                        )}
                      >
                        {viewEmp.employmentType.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {}
            <div className="grid grid-cols-3 gap-4">
              <div className="border-2 border-black bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                  Monthly Salary
                </p>
                <p className="text-2xl font-black text-[#024BAB]">
                  ₹{(viewEmp.salary || 0).toLocaleString("en-IN")}
                </p>
                <span className="inline-block mt-1.5 text-[10px] font-bold bg-[#FA731C]/15 text-[#FA731C] px-2 py-0.5 border border-[#FA731C]">
                  Pending
                </span>
              </div>
              <div className="border-2 border-black bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                  Loan Balance
                </p>
                <p
                  className={cn(
                    "text-2xl font-black",
                    (viewEmp as any).loanBalance > 0
                      ? "text-[#EF4444]"
                      : "text-black",
                  )}
                >
                  ₹{((viewEmp as any).loanBalance || 0).toLocaleString("en-IN")}
                </p>
                <span className="inline-block mt-1.5 text-[10px] font-bold bg-[#FA731C]/15 text-[#FA731C] px-2 py-0.5 border border-[#FA731C]">
                  Pending
                </span>
              </div>
              <div className="border-2 border-black bg-white p-4 flex flex-col gap-2 items-stretch justify-center">
                <button
                  onClick={() => navigate("/reports")}
                  className="flex items-center justify-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2.5 text-sm font-bold hover:bg-[#01368A] transition-colors"
                >
                  <FileText className="w-4 h-4" /> Report
                </button>
                <button
                  onClick={() => navigate("/payroll")}
                  className="flex items-center justify-center gap-2 bg-white text-black border-2 border-black px-4 py-2 text-xs font-bold hover:bg-gray-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Pay Slip
                </button>
              </div>
            </div>

            {}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {[
                {
                  icon: Calendar,
                  label: "Edit Attendance",
                  color: "text-[#024BAB]",
                  action: () => navigate("/attendance"),
                },
                {
                  icon: FileText,
                  label: "Payment History",
                  color: "text-[#A855F7]",
                  action: () => navigate("/reports"),
                },
                {
                  icon: Banknote,
                  label: "Loan Entry",
                  color: "text-[#FA731C]",
                  action: () => {
                    setLoanForm({
                      employee: viewEmp._id,
                      type: "loan",
                      amount: "",
                      monthlyEmi: "",
                      reason: "",
                    });
                    setLoanModal(true);
                    setViewEmp(null);
                  },
                },
                {
                  icon: Plus,
                  label: "Add Advance",
                  color: "text-[#00C48C]",
                  action: () => {
                    setLoanForm({
                      employee: viewEmp._id,
                      type: "advance",
                      amount: "",
                      monthlyEmi: "",
                      reason: "",
                    });
                    setLoanModal(true);
                    setViewEmp(null);
                  },
                },
                {
                  icon: TrendingUp,
                  label: "Allowance / Bonus",
                  color: "text-[#024BAB]",
                  action: () => {
                    setTxForm({
                      employee: viewEmp._id,
                      amount: "",
                      hours: "",
                      date: new Date().toISOString().split("T")[0],
                      remark: "",
                    });
                    setTxModal("allowance");
                  },
                },
                {
                  icon: AlertCircle,
                  label: "Penalty",
                  color: "text-[#EF4444]",
                  action: () => {
                    setTxForm({
                      employee: viewEmp._id,
                      amount: "",
                      hours: "",
                      date: new Date().toISOString().split("T")[0],
                      remark: "",
                    });
                    setTxModal("penalty");
                  },
                },
                {
                  icon: Clock,
                  label: "Overtime",
                  color: "text-[#F59E0B]",
                  action: () => {
                    setTxForm({
                      employee: viewEmp._id,
                      amount: "",
                      hours: "",
                      date: new Date().toISOString().split("T")[0],
                      remark: "",
                    });
                    setTxModal("overtime");
                  },
                },
                {
                  icon: IndianRupee,
                  label: "Pay Salary",
                  color: "text-[#00C48C]",
                  action: () => navigate("/payroll"),
                },
                {
                  icon: UserCheck,
                  label: "Leave Balance",
                  color: "text-[#FA731C]",
                  action: () => navigate("/leave"),
                },
                {
                  icon: Shield,
                  label: "Credentials",
                  color: "text-[#A855F7]",
                  action: () => navigate("/employee-credentials"),
                },
                {
                  icon: CreditCard,
                  label: "Payroll Config",
                  color: "text-[#024BAB]",
                  action: () => navigate("/payroll-settings"),
                },
                {
                  icon: Clock,
                  label: "Attendance Log",
                  color: "text-[#024BAB]",
                  action: () => navigate("/attendance"),
                },
                {
                  icon: Edit,
                  label: "Edit Profile",
                  color: "text-black",
                  action: () => {
                    setViewEmp(null);
                    openEdit(viewEmp);
                  },
                },
              ].map(({ icon: Icon, label, color, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="border-2 border-black bg-white p-4 flex flex-col items-center gap-2.5 hover:bg-[#024BAB]/5 transition-colors group"
                >
                  <Icon
                    className={cn(
                      "w-6 h-6 transition-transform group-hover:scale-110",
                      color,
                    )}
                  />
                  <span className="text-[11px] font-bold text-black text-center leading-tight">
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-2 border-black bg-white">
                <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-black bg-[#024BAB]/5">
                  <Phone className="w-4 h-4 text-[#024BAB]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-black">
                    Contact Information
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    ["Email", viewEmp.email],
                    ["Phone", viewEmp.phone || "—"],
                    ["Gender", viewEmp.gender || "—"],
                    [
                      "Date of Birth",
                      (viewEmp as any).dateOfBirth
                        ? formatDate((viewEmp as any).dateOfBirth)
                        : "—",
                    ],
                    [
                      "Emergency Contact",
                      (viewEmp as any).emergencyContact || "—",
                    ],
                    ["Address", (viewEmp as any).address || "—"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-2 border-b border-black/10 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-[10px] font-black text-muted-foreground uppercase shrink-0">
                        {label}
                      </span>
                      <span className="text-xs font-bold text-black text-right capitalize">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-2 border-black bg-white">
                <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-black bg-[#024BAB]/5">
                  <CreditCard className="w-4 h-4 text-[#024BAB]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-black">
                    Banking & Compliance
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    ["Bank", (viewEmp as any).bankName || "—"],
                    ["Account No.", (viewEmp as any).bankAccount || "—"],
                    [
                      "Account Holder",
                      (viewEmp as any).accountHolderName || "—",
                    ],
                    ["IFSC", (viewEmp as any).ifscCode || "—"],
                    ["PAN", (viewEmp as any).panNumber || "—"],
                    ["Aadhar", (viewEmp as any).aadharNumber || "—"],
                    ["PF No.", (viewEmp as any).pfNumber || "—"],
                    ["UAN", (viewEmp as any).uanNumber || "—"],
                    ["ESIC", (viewEmp as any).esicNumber || "—"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-2 border-b border-black/10 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-[10px] font-black text-muted-foreground uppercase shrink-0">
                        {label}
                      </span>
                      <span className="text-xs font-bold text-black text-right">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {loanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg flex items-center gap-2">
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
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
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
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
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
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
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
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
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

      <ActionModal
        show={actionModal.show}
        type={actionModal.type}
        title={actionModal.title}
        message={actionModal.message}
        onClose={() => setActionModal({ ...actionModal, show: false })}
      />
      {}
      {txModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {txModal === "allowance" ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-[#024BAB]" /> Allowance
                    / Bonus
                  </>
                ) : txModal === "overtime" ? (
                  <>
                    <Clock className="w-5 h-5 text-[#F59E0B]" /> Overtime
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-[#EF4444]" /> Penalty
                  </>
                )}
              </h3>
              <button onClick={() => setTxModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingTx(true);
                try {
                  const payload: Record<string, unknown> = {
                    employee: txForm.employee,
                    type: txModal,
                    date: txForm.date,
                    remark: txForm.remark,
                  };
                  if (txModal === "overtime") {
                    payload.hours = parseFloat(txForm.hours);
                  } else {
                    payload.amount = parseFloat(txForm.amount);
                  }
                  await transactionAPI.create(payload);
                  setTxModal(null);
                  const label =
                    txModal === "allowance"
                      ? "Allowance/Bonus"
                      : txModal === "overtime"
                        ? "Overtime"
                        : "Penalty";
                  const detail =
                    txModal === "overtime"
                      ? `${txForm.hours} hrs`
                      : `₹${txForm.amount}`;
                  setActionModal({
                    show: true,
                    type: "success",
                    title: `${label} Added`,
                    message: `${label} of ${detail} saved successfully.`,
                  });
                } catch (err: any) {
                  setActionModal({
                    show: true,
                    type: "error",
                    title: "Error",
                    message: err.message || "Failed to save",
                  });
                }
                setSavingTx(false);
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={txForm.date}
                  onChange={(e) =>
                    setTxForm({ ...txForm, date: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                />
              </div>
              {txModal === "overtime" ? (
                <>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                      Overtime Hours
                    </label>
                    <input
                      type="number"
                      required
                      min="0.5"
                      step="0.5"
                      value={txForm.hours}
                      onChange={(e) =>
                        setTxForm({ ...txForm, hours: e.target.value })
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                      placeholder="e.g. 2.5"
                    />
                  </div>
                  {txForm.hours && parseFloat(txForm.hours) > 0 ? (
                    <div className="bg-amber-50 border-2 border-amber-400 px-3 py-2 text-sm font-bold text-amber-800">
                      OT amount auto-calculated on payroll run: dailyRate ÷
                      shiftHours × {parseFloat(txForm.hours)}h
                    </div>
                  ) : null}
                </>
              ) : (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={txForm.amount}
                    onChange={(e) =>
                      setTxForm({ ...txForm, amount: e.target.value })
                    }
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                    placeholder="e.g. 500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                  {txModal === "allowance"
                    ? "Remark (TA, DA, Incentive, etc.)"
                    : txModal === "overtime"
                      ? "Remark"
                      : "Reason"}
                </label>
                <input
                  type="text"
                  value={txForm.remark}
                  onChange={(e) =>
                    setTxForm({ ...txForm, remark: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                  placeholder={
                    txModal === "allowance"
                      ? "e.g. Travel allowance, Diwali bonus"
                      : txModal === "overtime"
                        ? "e.g. Project deadline"
                        : "e.g. Late coming, misconduct"
                  }
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingTx}
                  className={`flex-1 text-white border-2 border-black py-2.5 text-sm font-bold disabled:opacity-50 ${
                    txModal === "allowance"
                      ? "bg-[#024BAB]"
                      : txModal === "overtime"
                        ? "bg-[#F59E0B]"
                        : "bg-[#EF4444]"
                  }`}
                >
                  {savingTx
                    ? "Saving..."
                    : txModal === "allowance"
                      ? "Add Allowance"
                      : txModal === "overtime"
                        ? "Add Overtime"
                        : "Add Penalty"}
                </button>
                <button
                  type="button"
                  onClick={() => setTxModal(null)}
                  className="flex-1 border-2 border-black py-2.5 text-sm font-bold bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
