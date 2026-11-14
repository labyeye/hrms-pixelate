import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { loanAPI, employeeAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";
import {
  Banknote,
  Plus,
  Pencil,
  Trash2,
  X,
  IndianRupee,
  TrendingDown,
  CheckCircle2,
  Check,
  Clock,
} from "lucide-react";
import { Employee } from "@/types/hrms";
import { EmployeeCombobox } from "@/components/employees/EmployeeCombobox";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { ImportButton } from "@/components/ui/ImportButton";
import { ViewTabs, useViewTab } from "@/components/ui/ViewTabs";
import { ChartCard, NbTooltip } from "@/components/ui/ChartCard";
import {
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Loan {
  _id: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    department?: any;
    avatar?: string;
  };
  type: "loan" | "advance";
  amount: number;
  remainingBalance: number;
  monthlyEmi: number;
  tenureMonths?: number;
  reason: string;
  disbursedOn: string;
  status: "pending" | "active" | "rejected" | "cleared" | "paused";
  rejectionReason?: string;
  clearedOn?: string;
  remarks: string;
}

const EMPTY_FORM = {
  employee: "",
  type: "loan" as "loan" | "advance",
  amount: "",
  monthlyEmi: "",
  reason: "",
  disbursedOn: new Date().toISOString().split("T")[0],
  status: "active" as "active" | "cleared" | "paused",
  remarks: "",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-orange-50 border-orange-500 text-orange-800",
  active: "bg-green-50 border-green-500 text-green-800",
  rejected: "bg-red-50 border-red-500 text-red-800",
  cleared: "bg-gray-100 border-gray-400 text-gray-600",
  paused: "bg-yellow-50 border-yellow-500 text-yellow-800",
};

export default function LoansPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [view, setView] = useViewTab("loans", "graphs");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "loan" | "advance">(
    "all",
  );
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "active" | "rejected" | "cleared" | "paused"
  >("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<
    "employee" | "amount" | "remaining" | "date"
  >("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<
    Omit<typeof EMPTY_FORM, "status"> & { status: Loan["status"] }
  >({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loanRes, empRes] = await Promise.all([
        loanAPI.getAll(),
        employeeAPI.getAll({ status: "active", limit: "5000" }),
      ]);
      setLoans(loanRes.data || []);
      setEmployees(empRes.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (loan: Loan) => {
    setForm({
      employee: loan.employee._id,
      type: loan.type,
      amount: String(loan.amount),
      monthlyEmi: String(loan.monthlyEmi),
      reason: loan.reason,
      disbursedOn: loan.disbursedOn ? loan.disbursedOn.split("T")[0] : "",
      status: loan.status,
      remarks: loan.remarks,
    });
    setEditId(loan._id);
    setModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await confirm({
      title: editId ? "Save changes?" : "Add this loan/advance?",
      description: editId
        ? "This will update the loan/advance record."
        : "This will create a new loan/advance entry.",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const payload = {
        employee: form.employee,
        type: form.type,
        amount: parseFloat(form.amount),
        monthlyEmi: parseFloat(form.monthlyEmi) || 0,
        reason: form.reason,
        disbursedOn: form.disbursedOn,
        status: form.status,
        remarks: form.remarks,
        remainingBalance: parseFloat(form.amount),
      };
      if (editId) {
        await loanAPI.update(editId, payload);
        toast({
          title: "Updated",
          description: "Loan/advance record updated.",
        });
      } else {
        await loanAPI.create(payload);
        toast({ title: "Created", description: "Loan/advance entry added." });
      }
      setModal(false);
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await loanAPI.updateStatus(id, { status: "approved" });
      toast({ title: "Approved", description: "Loan/advance approved." });
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (id: string) => {
    const rejectionReason =
      window.prompt("Reason for rejection (optional):") || "";
    try {
      await loanAPI.updateStatus(id, { status: "rejected", rejectionReason });
      toast({
        title: "Rejected",
        description: "Loan/advance request rejected.",
      });
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await loanAPI.delete(id);
      toast({ title: "Deleted" });
      setDeleteConfirm(null);
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const displayedLoans = [...loans]
    .filter((l) => {
      if (filterType !== "all" && l.type !== filterType) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (search) {
        const name =
          `${(l.employee as any)?.firstName ?? ""} ${(l.employee as any)?.lastName ?? ""}`.toLowerCase();
        if (!name.includes(search.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "employee") {
        const na = `${(a.employee as any)?.firstName ?? ""}${(a.employee as any)?.lastName ?? ""}`;
        const nb = `${(b.employee as any)?.firstName ?? ""}${(b.employee as any)?.lastName ?? ""}`;
        cmp = na.localeCompare(nb);
      } else if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "remaining")
        cmp = a.remainingBalance - b.remainingBalance;
      else if (sortKey === "date")
        cmp =
          new Date(a.disbursedOn ?? 0).getTime() -
          new Date(b.disbursedOn ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalDisbursed = displayedLoans.reduce((s, l) => s + l.amount, 0);
  const totalOutstanding = displayedLoans
    .filter((l) => l.status === "active")
    .reduce((s, l) => s + l.remainingBalance, 0);
  const activeCount = displayedLoans.filter(
    (l) => l.status === "active",
  ).length;
  const pendingCount = displayedLoans.filter(
    (l) => l.status === "pending",
  ).length;
  const clearedCount = displayedLoans.filter(
    (l) => l.status === "cleared",
  ).length;

  const live = displayedLoans.filter((l) => l.status !== "rejected" && l.status !== "pending");
  const totalRepaid = live.reduce((s, l) => s + (l.amount - l.remainingBalance), 0);
  const monthMap = new Map<string, { label: string; given: number; sort: number }>();
  live.forEach((l) => {
    if (!l.disbursedOn) return;
    const d = new Date(l.disbursedOn);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const m = monthMap.get(k) || { label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }), given: 0, sort: d.getFullYear() * 12 + d.getMonth() };
    m.given += l.amount;
    monthMap.set(k, m);
  });
  const byMonth = [...monthMap.values()].sort((a, b) => a.sort - b.sort).slice(-12);
  const empMap = new Map<string, { name: string; code: string; given: number; repaid: number; left: number; emi: number }>();
  live.forEach((l) => {
    const e = empMap.get(l.employee._id) || { name: `${l.employee.firstName} ${l.employee.lastName}`.trim(), code: l.employee.employeeId, given: 0, repaid: 0, left: 0, emi: 0 };
    e.given += l.amount;
    e.repaid += l.amount - l.remainingBalance;
    e.left += l.remainingBalance;
    if (l.status === "active") e.emi += l.monthlyEmi || 0;
    empMap.set(l.employee._id, e);
  });
  const byEmp = [...empMap.values()].sort((a, b) => b.left - a.left);
  const topPending = byEmp.filter((e) => e.left > 0).slice(0, 8).map((e) => ({ ...e, short: e.name.split(" ")[0], left: Math.round(e.left) }));
  const recentGiven = [...live].sort((a, b) => new Date(b.disbursedOn ?? 0).getTime() - new Date(a.disbursedOn ?? 0).getTime()).slice(0, 6);
  const recentCleared = displayedLoans
    .filter((l) => l.status === "cleared" || (l.status !== "pending" && l.status !== "rejected" && l.remainingBalance <= 0))
    .sort((a, b) => new Date(b.clearedOn ?? b.disbursedOn ?? 0).getTime() - new Date(a.clearedOn ?? a.disbursedOn ?? 0).getTime())
    .slice(0, 6);
  const dt = (d?: string) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <AppLayout title="Loans & Advances">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <ViewTabs value={view} onChange={setView} />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="border-2 border-black bg-white px-3 py-2 text-sm font-bold"
          >
            <option value="all">All types</option>
            <option value="loan">Loans</option>
            <option value="advance">Advances</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="border-2 border-black bg-white px-3 py-2 text-sm font-bold"
          >
            <option value="all">All status</option>
            {["pending", "active", "rejected", "cleared", "paused"].map((x) => (
              <option key={x} value={x}>
                {x[0].toUpperCase() + x.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportButton
            name="loans_advances"
            headers={[
              "Emp ID",
              "Type (loan/advance)",
              "Amount",
              "Monthly EMI",
              "Disbursed On (YYYY-MM-DD)",
              "Reason",
            ]}
            example={[
              "EMP0001",
              "loan",
              50000,
              5000,
              new Date().toISOString().slice(0, 10),
              "Medical",
            ]}
            onRows={async (rows) => {
              let ok = 0;
              const bad: string[] = [];
              for (const r of rows) {
                const code = String(r["Emp ID"] || "")
                  .trim()
                  .toLowerCase();
                const emp = employees.find(
                  (e) => e.employeeId?.toLowerCase() === code,
                );
                const amount = parseFloat(
                  String(r["Amount"]).replace(/,/g, ""),
                );
                if (!emp || !(amount > 0)) {
                  bad.push(String(r["Emp ID"] || "(blank)"));
                  continue;
                }
                const type =
                  String(r["Type (loan/advance)"] || "loan").toLowerCase() ===
                  "advance"
                    ? "advance"
                    : "loan";
                try {
                  await loanAPI.create({
                    employee: emp._id,
                    type,
                    amount,
                    remainingBalance: amount,
                    monthlyEmi:
                      parseFloat(String(r["Monthly EMI"]).replace(/,/g, "")) ||
                      0,
                    disbursedOn:
                      String(r["Disbursed On (YYYY-MM-DD)"] || "").slice(
                        0,
                        10,
                      ) || new Date().toISOString().slice(0, 10),
                    reason: String(r["Reason"] || ""),
                    status: "active",
                  });
                  ok++;
                } catch {
                  bad.push(String(r["Emp ID"]));
                }
              }
              load();
              return `${ok} of ${rows.length} imported${bad.length ? `. Skipped: ${bad.slice(0, 5).join(", ")}` : ""}`;
            }}
          />
          <ExportMenu
            name="loans_advances"
            rows={displayedLoans}
            cols={[
              { header: "Emp Code", value: (l) => l.employee?.employeeId },
              {
                header: "Employee",
                value: (l) =>
                  `${l.employee?.firstName || ""} ${l.employee?.lastName || ""}`.trim(),
              },
              { header: "Type", value: (l) => l.type },
              { header: "Amount", value: (l) => l.amount },
              { header: "Monthly EMI", value: (l) => l.monthlyEmi },
              { header: "Remaining", value: (l) => l.remainingBalance },
              {
                header: "Disbursed On",
                value: (l) =>
                  l.disbursedOn ? String(l.disbursedOn).slice(0, 10) : "",
              },
              { header: "Status", value: (l) => l.status },
              { header: "Reason", value: (l) => l.reason },
            ]}
          />
          <button
            onClick={openAdd}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
          >
            <Plus className="w-4 h-4" /> Add Loan / Advance
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {[
          {
            label: "Total Disbursed",
            value: fmt(totalDisbursed),
            icon: Banknote,
            color: "#024BAB",
          },
          {
            label: "Outstanding",
            value: fmt(totalOutstanding),
            icon: TrendingDown,
            color: "#EF4444",
          },
          {
            label: "Active",
            value: String(activeCount),
            icon: IndianRupee,
            color: "#00C48C",
          },
          {
            label: "Pending",
            value: String(pendingCount),
            icon: Clock,
            color: "#FA731C",
          },
          {
            label: "Cleared",
            value: String(clearedCount),
            icon: CheckCircle2,
            color: "#6B7280",
          },
        ].map(({ label, value, icon, color }) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            icon={icon}
            color={color}
          />
        ))}
      </div>

      {view === "graphs" && !loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ChartCard title="Given month by month" subtitle="Total disbursed (₹) — last 12 months" empty={byMonth.length ? undefined : "No loans yet"}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byMonth} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<NbTooltip />} />
                  <Bar dataKey="given" name="Given ₹" fill="#024BAB" stroke="#0A0A0A" strokeWidth={1.5}>
                    <LabelList dataKey="given" position="top" style={{ fontSize: 10, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Balance still to recover" subtitle="Top employees by pending amount (₹)" empty={topPending.length ? undefined : "Nothing pending"}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topPending} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="short" tick={{ fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<NbTooltip />} />
                  <Bar dataKey="left" name="Pending ₹" fill="#EF4444" stroke="#0A0A0A" strokeWidth={1.5}>
                    <LabelList dataKey="left" position="right" style={{ fontSize: 10, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ChartCard title="Recently given" subtitle="Latest loans & advances — how much, when, EMI" empty={recentGiven.length ? undefined : "No entries"}>
              <div className="divide-y divide-black/10">
                {recentGiven.map((l) => (
                  <div key={l._id} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <p className="font-bold text-black">{l.employee.firstName} {l.employee.lastName} <span className="font-normal text-gray-500">· {l.type}</span></p>
                      <p className="text-gray-500">{dt(l.disbursedOn)}{l.monthlyEmi > 0 ? ` · EMI ${fmt(l.monthlyEmi)}` : ""}</p>
                    </div>
                    <p className="font-bold">{fmt(l.amount)}</p>
                  </div>
                ))}
              </div>
            </ChartCard>
            <ChartCard title="Recently fully repaid" subtitle="Who cleared their loan/advance" empty={recentCleared.length ? undefined : "No one has cleared yet"}>
              <div className="divide-y divide-black/10">
                {recentCleared.map((l) => (
                  <div key={l._id} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <p className="font-bold text-black">{l.employee.firstName} {l.employee.lastName} <span className="font-normal text-gray-500">· {l.type}</span></p>
                      <p className="text-gray-500">Cleared {dt(l.clearedOn)} · given {dt(l.disbursedOn)}</p>
                    </div>
                    <p className="font-bold text-green-700">{fmt(l.amount)}</p>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          <ChartCard title="Who owes what" subtitle={`Employee-wise — repaid so far ${fmt(totalRepaid)}`} empty={byEmp.length ? undefined : "No data"}>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-black text-left uppercase tracking-wider">
                    {["Employee", "Given", "Repaid", "Balance left", "EMI/month", "Months left"].map((h) => (
                      <th key={h} className="py-2 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byEmp.map((e) => (
                    <tr key={e.code} className="border-b border-black/10">
                      <td className="py-2 pr-4 font-bold">{e.name} <span className="font-normal text-gray-500">{e.code}</span></td>
                      <td className="py-2 pr-4">{fmt(e.given)}</td>
                      <td className="py-2 pr-4 text-green-700 font-bold">{fmt(e.repaid)}</td>
                      <td className={cn("py-2 pr-4 font-bold", e.left > 0 ? "text-red-600" : "text-green-700")}>{e.left > 0 ? fmt(e.left) : "Cleared"}</td>
                      <td className="py-2 pr-4">{e.emi > 0 ? fmt(e.emi) : "—"}</td>
                      <td className="py-2 pr-4">{e.emi > 0 && e.left > 0 ? Math.ceil(e.left / e.emi) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      ) : null}

      {view === "details" && (<>
      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
        </div>
      ) : displayedLoans.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <Banknote className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No records found</p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Type",
                  "Amount",
                  "Remaining",
                  "EMI/Month",
                  "Disbursed On",
                  "Reason",
                  "Status",
                  "",
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
              {displayedLoans.map((loan, i) => (
                <tr
                  key={loan._id}
                  className={cn(
                    "border-b border-black/10 hover:bg-[#024BAB]/5",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {loan.employee.avatar ? (
                        <img
                          src={loan.employee.avatar}
                          alt={loan.employee.firstName}
                          className="w-7 h-7 border-2 border-black object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {loan.employee.firstName[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-xs text-black">
                          {loan.employee.firstName} {loan.employee.lastName}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {loan.employee.employeeId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-bold border-2",
                        loan.type === "loan"
                          ? "bg-blue-50 border-blue-500 text-blue-800"
                          : "bg-orange-50 border-orange-500 text-orange-800",
                      )}
                    >
                      {loan.type === "loan" ? "Loan" : "Advance"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-xs">
                    {fmt(loan.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={cn(
                        "font-bold",
                        loan.remainingBalance > 0
                          ? "text-red-600"
                          : "text-green-600",
                      )}
                    >
                      {fmt(loan.remainingBalance)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {loan.monthlyEmi > 0 ? fmt(loan.monthlyEmi) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {loan.disbursedOn
                      ? new Date(loan.disbursedOn).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 max-w-[140px] truncate">
                    {loan.reason || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-bold border-2 capitalize",
                        STATUS_COLORS[loan.status],
                      )}
                    >
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {loan.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(loan._id)}
                            className="p-1.5 border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition-colors"
                            title="Approve"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleReject(loan._id)}
                            className="p-1.5 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                            title="Reject"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openEdit(loan)}
                        className="p-1.5 border-2 border-black hover:bg-[#024BAB] hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(loan._id)}
                        className="p-1.5 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      </>)}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b-2 border-black sticky top-0 bg-white z-10">
              <h3 className="font-display font-bold text-lg">
                {editId ? "Edit Loan / Advance" : "Add Loan / Advance"}
              </h3>
              <button onClick={() => setModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Employee</label>
                <EmployeeCombobox
                  employees={employees}
                  value={form.employee}
                  onChange={(id) => setForm({ ...form, employee: id })}
                  className="border-2 w-full px-3 py-2 text-sm disabled:opacity-60 disabled:bg-gray-50"
                  disabled={!!editId}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as any })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="loan">Loan</option>
                    <option value="advance">Salary Advance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as any })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="cleared">Cleared</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Monthly EMI (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0 = no EMI"
                    value={form.monthlyEmi}
                    onChange={(e) =>
                      setForm({ ...form, monthlyEmi: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Disbursed On
                </label>
                <input
                  type="date"
                  value={form.disbursedOn}
                  onChange={(e) =>
                    setForm({ ...form, disbursedOn: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Reason</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Medical emergency"
                  className="border-2 w-full px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({ ...form, remarks: e.target.value })
                  }
                  rows={2}
                  className="border-2 w-full px-3 py-2 text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-60"
                >
                  {saving ? "Saving..." : editId ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-sm p-6 space-y-4">
            <p className="font-bold text-base">Delete this record?</p>
            <p className="text-sm text-gray-600">
              This will remove the loan/advance and recalculate the employee
              balance.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 border-2 bg-red-600 text-white py-2.5 text-sm font-bold"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border-2 bg-white text-black py-2.5 text-sm font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
