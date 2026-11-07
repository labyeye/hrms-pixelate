import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { expenseAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Receipt, Plus, X, Paperclip, Trash2, Settings2 } from "lucide-react";

const CATEGORIES = [
  ["travel", "Travel"],
  ["food", "Food"],
  ["fuel", "Fuel"],
  ["lodging", "Lodging"],
  ["internet_phone", "Internet / Phone"],
  ["office", "Office supplies"],
  ["other", "Other"],
];
const ROLE_LABEL: Record<string, string> = {
  department_head: "Department Head",
  hr_manager: "HR Manager",
  super_admin: "Super Admin",
};
const STATUS_CLS: Record<string, string> = {
  pending: "bg-orange-50 border-orange-500 text-orange-800",
  approved: "bg-blue-50 border-blue-500 text-blue-800",
  paid: "bg-green-50 border-green-500 text-green-800",
  rejected: "bg-red-50 border-red-500 text-red-800",
};
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

type Step = { role: string; status?: string; note?: string; aboveAmount?: number };
type Claim = {
  _id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  notes: string;
  status: string;
  hasBill: boolean;
  canAct: boolean;
  steps: Step[];
  employee?: { firstName: string; lastName: string; employeeId: string };
};

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { title: "", category: "other", amount: "", date: today(), notes: "" };

export default function ExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isHR = user?.role === "super_admin" || user?.role === "hr_manager";
  const canApprove = isHR || user?.role === "department_head";
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [bill, setBill] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [flow, setFlow] = useState<Step[] | null>(null);

  const err = (e: any) => toast({ title: e.message, variant: "destructive" });

  const load = useCallback(async () => {
    try {
      const r = await expenseAPI.getAll();
      setClaims(r.data);
    } catch (e) {
      err(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!form) return;
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (bill) fd.append("bill", bill);
    setSaving(true);
    try {
      await expenseAPI.create(fd);
      toast({ title: "Claim submitted" });
      setForm(null);
      setBill(null);
      load();
    } catch (e) {
      err(e);
    } finally {
      setSaving(false);
    }
  };

  const act = async (c: Claim, action: "approve" | "reject") => {
    const note =
      action === "reject" ? window.prompt("Reason for rejection?") || "" : "";
    if (action === "reject" && !note) return;
    try {
      await expenseAPI.act(c._id, action, note);
      load();
    } catch (e) {
      err(e);
    }
  };

  const openFlow = async () => {
    try {
      setFlow((await expenseAPI.getWorkflow()).data);
    } catch (e) {
      err(e);
    }
  };
  const saveFlow = async () => {
    if (!flow) return;
    try {
      await expenseAPI.saveWorkflow(
        flow.map((s) => ({ role: s.role, aboveAmount: s.aboveAmount || 0 })),
      );
      toast({ title: "Approval workflow saved" });
      setFlow(null);
    } catch (e) {
      err(e);
    }
  };

  const inbox = claims.filter((c) => c.canAct);
  const input = "border-2 border-black px-3 py-2 text-sm w-full";

  const Row = ({ c }: { c: Claim }) => (
    <div className="bg-white border-2 border-black px-5 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-[180px]">
        <p className="font-bold text-sm">{c.title}</p>
        <p className="text-xs text-gray-500">
          {c.employee
            ? `${c.employee.firstName} ${c.employee.lastName} (${c.employee.employeeId}) · `
            : ""}
          {CATEGORIES.find((x) => x[0] === c.category)?.[1]} ·{" "}
          {new Date(c.date).toLocaleDateString("en-IN")}
        </p>
        {c.notes && <p className="text-xs text-gray-600 mt-1">{c.notes}</p>}
      </div>
      <div className="flex gap-1 flex-wrap">
        {c.steps.map((s, i) => (
          <span
            key={i}
            title={s.note || ""}
            className={cn(
              "text-[10px] font-bold uppercase border-2 px-2 py-0.5",
              s.status === "approved"
                ? STATUS_CLS.paid
                : s.status === "rejected"
                  ? STATUS_CLS.rejected
                  : "bg-gray-50 border-gray-300 text-gray-500",
            )}
          >
            {ROLE_LABEL[s.role] || s.role}
          </span>
        ))}
      </div>
      <p className="font-bold">{fmt(c.amount)}</p>
      <span
        className={cn(
          "text-[10px] font-bold uppercase border-2 px-2 py-0.5",
          STATUS_CLS[c.status],
        )}
      >
        {c.status}
      </span>
      <div className="flex gap-2 items-center">
        {c.hasBill && (
          <button
            title="Download bill"
            onClick={() => expenseAPI.downloadBill(c._id).catch(err)}
          >
            <Paperclip className="w-4 h-4" />
          </button>
        )}
        {c.canAct && (
          <>
            <button
              onClick={() => act(c, "approve")}
              className="bg-green-600 text-white px-3 py-1 text-xs font-bold border-2 border-black"
            >
              Approve
            </button>
            <button
              onClick={() => act(c, "reject")}
              className="bg-white text-red-700 px-3 py-1 text-xs font-bold border-2 border-black"
            >
              Reject
            </button>
          </>
        )}
        {!canApprove &&
          c.status === "pending" &&
          c.steps.every((s) => s.status === "pending") && (
            <button
              title="Withdraw"
              onClick={() =>
                expenseAPI
                  .remove(c._id)
                  .then(load)
                  .catch(err)
              }
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          )}
      </div>
    </div>
  );

  return (
    <AppLayout title="Expenses">
      <div className="w-full mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">
              Expense Claims
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Claim reimbursements; approved amounts are added to the next payroll
            </p>
          </div>
          <div className="flex gap-2">
            {isHR && (
              <button
                onClick={openFlow}
                className="bg-white border-2 border-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
              >
                <Settings2 className="w-4 h-4" /> Approval Workflow
              </button>
            )}
            <button
              onClick={() => setForm({ ...EMPTY })}
              className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
            >
              <Plus className="w-4 h-4" /> New Claim
            </button>
          </div>
        </div>

        {canApprove && inbox.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-sm uppercase text-gray-500 mb-2">
              Waiting for your approval ({inbox.length})
            </h2>
            <div className="space-y-2">
              {inbox.map((c) => (
                <Row key={c._id} c={c} />
              ))}
            </div>
          </div>
        )}

        <h2 className="font-bold text-sm uppercase text-gray-500 mb-2">
          {canApprove ? "All claims" : "My claims"}
        </h2>
        {loading ? null : claims.length === 0 ? (
          <div className="border-2 border-black bg-white p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-gray-500">No expense claims yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {claims.map((c) => (
              <Row key={c._id} c={c} />
            ))}
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">New expense claim</h3>
              <button onClick={() => setForm(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              className={input}
              placeholder="What was it for?"
              maxLength={120}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                className={input}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                className={input}
                type="number"
                min={1}
                placeholder="Amount (₹)"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <input
              className={input}
              type="date"
              max={today()}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <textarea
              className={input}
              rows={2}
              maxLength={500}
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setBill(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <button
              disabled={saving || !form.title || !form.amount}
              onClick={submit}
              className="w-full bg-[#024BAB] text-white py-2 font-bold border-2 border-black disabled:opacity-40"
            >
              {saving ? "Submitting…" : "Submit claim"}
            </button>
          </div>
        </div>
      )}

      {flow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-lg p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Expense approval workflow</h3>
              <button onClick={() => setFlow(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Steps run in order. A step with a minimum amount only applies to
              claims of that size or more.
            </p>
            {flow.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="font-bold text-sm w-6">{i + 1}.</span>
                <select
                  className={input}
                  value={s.role}
                  onChange={(e) =>
                    setFlow(
                      flow.map((x, j) =>
                        j === i ? { ...x, role: e.target.value } : x,
                      ),
                    )
                  }
                >
                  {Object.entries(ROLE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  type="number"
                  min={0}
                  placeholder="Min ₹ (0 = always)"
                  value={s.aboveAmount || ""}
                  onChange={(e) =>
                    setFlow(
                      flow.map((x, j) =>
                        j === i ? { ...x, aboveAmount: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <button
                  disabled={flow.length === 1}
                  onClick={() => setFlow(flow.filter((_, j) => j !== i))}
                  className="disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <button
                disabled={flow.length >= 4}
                onClick={() =>
                  setFlow([...flow, { role: "super_admin", aboveAmount: 0 }])
                }
                className="border-2 border-black px-3 py-2 text-sm font-bold disabled:opacity-40"
              >
                + Add step
              </button>
              <button
                onClick={saveFlow}
                className="flex-1 bg-[#024BAB] text-white py-2 font-bold border-2 border-black"
              >
                Save workflow
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
