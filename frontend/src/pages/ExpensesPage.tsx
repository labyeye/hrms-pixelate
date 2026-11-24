import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { companyExpenseAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Plus, X, Paperclip, Trash2, Pencil } from "lucide-react";

// Company spending ledger (rent, vendors, supplies...). Staff claims are on the Reimbursements page.
const CATEGORIES: [string, string][] = [
  ["rent", "Rent"],
  ["utilities", "Utilities"],
  ["salaries_misc", "Staff welfare"],
  ["marketing", "Marketing"],
  ["software", "Software / Subscriptions"],
  ["office", "Office supplies"],
  ["travel", "Travel"],
  ["maintenance", "Maintenance"],
  ["taxes_fees", "Taxes & fees"],
  ["other", "Other"],
];
const MODES: [string, string][] = [
  ["bank_transfer", "Bank transfer"],
  ["upi", "UPI"],
  ["cash", "Cash"],
  ["cheque", "Cheque"],
  ["card", "Card"],
];
const label = (list: [string, string][], k: string) => list.find((x) => x[0] === k)?.[1] || k;
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const today = () => new Date().toISOString().slice(0, 10);

type Row = {
  _id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  vendor: string;
  paymentMode: string;
  reference: string;
  notes: string;
  bills: string[];
  addedBy?: { name: string };
};
const EMPTY = { title: "", category: "other", amount: "", date: today(), vendor: "", paymentMode: "bank_transfer", reference: "", notes: "" };

export default function ExpensesPage() {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [category, setCategory] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<{ total: number; count: number; byCategory: Record<string, number> }>({ total: 0, count: 0, byCategory: {} });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [newBills, setNewBills] = useState<File[]>([]);
  const [removeBills, setRemoveBills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const err = (e: any) => toast({ title: e.message, variant: "destructive" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await companyExpenseAPI.getAll({ month, year, category });
      setRows(r.data);
      setSummary(r.summary);
    } catch (e) {
      err(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, category]);
  useEffect(() => {
    load();
  }, [load]);

  const topCats = useMemo(
    () => Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3),
    [summary],
  );

  const open = (row?: Row) => {
    setEditing(row || null);
    setNewBills([]);
    setRemoveBills([]);
    setForm(
      row
        ? { title: row.title, category: row.category, amount: String(row.amount), date: row.date.slice(0, 10), vendor: row.vendor, paymentMode: row.paymentMode, reference: row.reference, notes: row.notes }
        : { ...EMPTY },
    );
  };

  const save = async () => {
    if (!form) return;
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (removeBills.length) fd.append("removeBills", JSON.stringify(removeBills));
    newBills.forEach((f) => fd.append("bills", f));
    setSaving(true);
    try {
      await companyExpenseAPI.save(fd, editing?._id);
      toast({ title: editing ? "Expense updated" : "Expense added" });
      setForm(null);
      load();
    } catch (e) {
      err(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`Delete "${row.title}"?`)) return;
    try {
      await companyExpenseAPI.remove(row._id);
      load();
    } catch (e) {
      err(e);
    }
  };

  const keptBills = editing ? editing.bills.filter((b) => !removeBills.includes(b)) : [];
  const input = "border-2 border-black w-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30";

  return (
    <AppLayout title="Expenses">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#024BAB]" /> Company Expenses
            </h2>
            <p className="text-xs text-muted-foreground">
              The company's own spending. Money owed to staff is under Reimbursements.
            </p>
          </div>
          <button
            onClick={() => open()}
            className="flex items-center gap-1.5 bg-[#024BAB] text-white border-2 border-black px-4 py-2 text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Add expense
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={input + " !w-auto"}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>
                {new Date(2000, i, 1).toLocaleString("en-IN", { month: "long" })}
              </option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={input + " !w-auto"}>
            {[0, 1, 2, 3].map((d) => (
              <option key={d} value={now.getFullYear() - d}>
                {now.getFullYear() - d}
              </option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input + " !w-auto"}>
            <option value="">All categories</option>
            {CATEGORIES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border-2 border-black bg-[#F8FAFF] p-3">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Total this period</p>
            <p className="text-lg font-bold">{fmt(summary.total)}</p>
            <p className="text-[11px] text-muted-foreground">{summary.count} entries</p>
          </div>
          {topCats.map(([k, v]) => (
            <div key={k} className="border-2 border-black p-3">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">{label(CATEGORIES, k)}</p>
              <p className="text-lg font-bold">{fmt(v)}</p>
            </div>
          ))}
        </div>

        <div className="border-2 border-black overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5 text-left text-xs uppercase">
                {["Date", "Title", "Category", "Vendor", "Paid via", "Amount", "Bills", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground font-bold">
                    No expenses for this period
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="border-b border-black/10">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                    <td className="px-3 py-2 font-bold">{r.title}</td>
                    <td className="px-3 py-2">{label(CATEGORIES, r.category)}</td>
                    <td className="px-3 py-2">{r.vendor || "—"}</td>
                    <td className="px-3 py-2">{label(MODES, r.paymentMode)}</td>
                    <td className="px-3 py-2 font-bold">{fmt(r.amount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {r.bills.length === 0 && "—"}
                        {r.bills.map((_, i) => (
                          <button
                            key={i}
                            title={`Open bill ${i + 1}`}
                            onClick={() => companyExpenseAPI.downloadBill(r._id, i).catch(err)}
                            className="border-2 border-black p-1"
                          >
                            <Paperclip className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => open(r)} className="border-2 border-black p-1" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(r)} className="border-2 border-black p-1 text-red-600" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black bg-[#024BAB] text-white">
              <h3 className="font-bold">{editing ? "Edit expense" : "Add expense"}</h3>
              <button onClick={() => setForm(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1">Title *</label>
                <input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Office rent – Nov" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Amount (₹) *</label>
                  <input type="number" min="1" className={input} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Date *</label>
                  <input type="date" className={input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Category</label>
                  <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Paid via</label>
                  <select className={input} value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                    {MODES.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Vendor</label>
                  <input className={input} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Reference / Txn ID</label>
                  <input className={input} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Notes</label>
                <textarea rows={2} maxLength={500} className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Bills (up to 5, image or PDF)</label>
                {keptBills.map((b) => (
                  <div key={b} className="flex items-center justify-between text-xs border border-black/30 px-2 py-1 mb-1">
                    <span>Bill {editing!.bills.indexOf(b) + 1}</span>
                    <button onClick={() => setRemoveBills([...removeBills, b])} className="text-red-600 font-bold">
                      Remove
                    </button>
                  </div>
                ))}
                {newBills.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border border-black/30 px-2 py-1 mb-1">
                    <span className="truncate">{f.name}</span>
                    <button onClick={() => setNewBills(newBills.filter((_, j) => j !== i))} className="text-red-600 font-bold">
                      Remove
                    </button>
                  </div>
                ))}
                {keptBills.length + newBills.length < 5 && (
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []);
                      setNewBills([...newBills, ...picked].slice(0, 5 - keptBills.length));
                      e.target.value = "";
                    }}
                    className="text-xs"
                  />
                )}
              </div>
              <button
                disabled={saving}
                onClick={save}
                className="w-full bg-[#024BAB] text-white border-2 border-black py-2.5 text-sm font-bold disabled:opacity-60"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Add expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
