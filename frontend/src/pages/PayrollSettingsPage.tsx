import { useState, useEffect, useCallback } from "react";
import { payrollConfigAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { ShieldAlert, Clock, Loader2, Save, Percent, IndianRupee, CalendarDays, LogOut } from "lucide-react";

interface DeductionRule {
  shiftStartHour: number;
  shiftStartMinute: number;
  shiftEndHour: number;
  shiftEndMinute: number;
  lateThresholdMinutes: number;
  lateDeductionType: "fixed" | "percent";
  lateDeductionAmount: number;
  halfDayThresholdMinutes: number;
  halfDayDeductionPercent: number;
  absentDeductionType: "fixed" | "percent";
  absentDeductionAmount: number;
  earlyCheckoutThresholdMinutes: number;
  earlyCheckoutDeductionEnabled: boolean;
  workWeek: "mon_fri" | "mon_sat";
  enablePf: boolean;
  pfRate: number;
  enableEsi: boolean;
  esiRate: number;
  esiGrossLimit: number;
  enableTds: boolean;
  tdsRate: number;
  tdsTaxableThreshold: number;
  defaultHraPct: number;
  defaultDaPct: number;
  defaultTa: number;
}

const DEFAULT_DEDUCTIONS: DeductionRule = {
  shiftStartHour: 9,
  shiftStartMinute: 0,
  shiftEndHour: 18,
  shiftEndMinute: 0,
  lateThresholdMinutes: 15,
  lateDeductionType: "fixed",
  lateDeductionAmount: 0,
  halfDayThresholdMinutes: 120,
  halfDayDeductionPercent: 50,
  absentDeductionType: "percent",
  absentDeductionAmount: 100,
  earlyCheckoutThresholdMinutes: 15,
  earlyCheckoutDeductionEnabled: false,
  workWeek: "mon_sat",
  enablePf: true,
  pfRate: 12,
  enableEsi: true,
  esiRate: 1.75,
  esiGrossLimit: 21000,
  enableTds: false,
  tdsRate: 10,
  tdsTaxableThreshold: 50000,
  defaultHraPct: 40,
  defaultDaPct: 10,
  defaultTa: 1500,
};

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-black uppercase mb-1 text-gray-600">{label}</label>
      <div className="relative">
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">
            {suffix}
          </span>
        )}
        <input
          type="number"
          min={min ?? 0}
          max={max}
          step={step ?? 1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none pr-10 disabled:opacity-40 disabled:bg-gray-50"
        />
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-black">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full border-2 border-black transition-colors ${
          checked ? "bg-[#024BAB]" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white border border-black transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {icon && <div className="text-[#024BAB]">{icon}</div>}
      <div>
        <h3 className="font-black text-sm uppercase text-black">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function fmt(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function PayrollSettingsPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<DeductionRule>(DEFAULT_DEDUCTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<DeductionRule>) => setRules((p) => ({ ...p, ...patch }));

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payrollConfigAPI.getDeductionRules();
      if (res.data) setRules({ ...DEFAULT_DEDUCTIONS, ...res.data });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await payrollConfigAPI.upsertDeductionRules(rules);
      toast({ title: "Settings saved", description: "All payroll rules updated", variant: "success" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Payroll Settings">
      <div className="w-full mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-black text-3xl text-black">Payroll Settings</h1>
          <p className="text-gray-600 font-medium mt-1">
            Configure statutory rates, attendance deductions, and default salary components.
            Per-employee breakdown is set in the Employees page.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── Work Week ──────────────────────────────────────────────────── */}
            <div className="bg-white border-2 border-black">
              <div className="p-4 border-b-2 border-black bg-[#F0F6FF]">
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-5 h-5 text-[#024BAB]" />
                  <div>
                    <h2 className="font-black text-base">Work Week</h2>
                    <p className="text-xs text-gray-500">
                      Determines how many working days are in the month — used for daily salary calculation
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="flex gap-3">
                  {(["mon_sat", "mon_fri"] as const).map((ww) => (
                    <button
                      key={ww}
                      onClick={() => set({ workWeek: ww })}
                      className={`px-5 py-3 border-2 border-black font-black text-sm uppercase transition-colors ${
                        rules.workWeek === ww
                          ? "bg-[#024BAB] text-white"
                          : "bg-white text-black hover:bg-gray-50"
                      }`}
                    >
                      {ww === "mon_sat" ? "Mon – Sat (6 days)" : "Mon – Fri (5 days)"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {rules.workWeek === "mon_sat"
                    ? "~26 working days/month on average. Saturdays count as working days."
                    : "~22 working days/month on average. Saturdays are off."}
                </p>
              </div>
            </div>

            {/* ── Statutory Deductions ─────────────────────────────────────────── */}
            <div className="bg-white border-2 border-black">
              <div className="p-4 border-b-2 border-black bg-[#F0F6FF]">
                <div className="flex items-center gap-3">
                  <Percent className="w-5 h-5 text-[#024BAB]" />
                  <div>
                    <h2 className="font-black text-base">Statutory Deductions</h2>
                    <p className="text-xs text-gray-500">Toggle PF, ESI, TDS on/off per your company's requirements</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-6">

                {/* PF */}
                <div>
                  <Toggle
                    label="Provident Fund (PF)"
                    description="Deducted from basic salary. Standard: 12%."
                    checked={rules.enablePf}
                    onChange={(v) => set({ enablePf: v })}
                  />
                  {rules.enablePf && (
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <NumField
                        label="PF Rate (% of Basic)"
                        value={rules.pfRate}
                        onChange={(v) => set({ pfRate: v })}
                        min={0} max={100} step={0.01} suffix="%"
                        hint="Standard is 12% of basic salary"
                      />
                    </div>
                  )}
                </div>

                {/* ESI */}
                <div className="border-t pt-5">
                  <Toggle
                    label="Employee State Insurance (ESI)"
                    description="Applies when monthly gross ≤ ESI gross limit."
                    checked={rules.enableEsi}
                    onChange={(v) => set({ enableEsi: v })}
                  />
                  {rules.enableEsi && (
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <NumField
                        label="ESI Rate (%)"
                        value={rules.esiRate}
                        onChange={(v) => set({ esiRate: v })}
                        min={0} max={100} step={0.01} suffix="%"
                        hint="Standard: 0.75% (revised 2020). Old: 1.75%."
                      />
                      <NumField
                        label="Gross Salary Limit (₹/month)"
                        value={rules.esiGrossLimit}
                        onChange={(v) => set({ esiGrossLimit: v })}
                        hint="Employees above this are exempt. 0 = always apply."
                      />
                    </div>
                  )}
                </div>

                {/* TDS */}
                <div className="border-t pt-5">
                  <Toggle
                    label="TDS (Tax Deducted at Source)"
                    description="Simple flat-rate TDS when monthly gross exceeds a threshold."
                    checked={rules.enableTds}
                    onChange={(v) => set({ enableTds: v })}
                  />
                  {rules.enableTds && (
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <NumField
                        label="TDS Rate (%)"
                        value={rules.tdsRate}
                        onChange={(v) => set({ tdsRate: v })}
                        min={0} max={100} step={0.01} suffix="%"
                        hint="Standard: 10% above threshold."
                      />
                      <NumField
                        label="Taxable Threshold (₹/month)"
                        value={rules.tdsTaxableThreshold}
                        onChange={(v) => set({ tdsTaxableThreshold: v })}
                        hint="TDS only deducted when gross exceeds this. 0 = always apply."
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Default Salary Components ──────────────────────────────────── */}
            <div className="bg-white border-2 border-black">
              <div className="p-4 border-b-2 border-black bg-[#F0F6FF]">
                <div className="flex items-center gap-3">
                  <IndianRupee className="w-5 h-5 text-[#024BAB]" />
                  <div>
                    <h2 className="font-black text-base">Default Salary Components</h2>
                    <p className="text-xs text-gray-500">
                      Fallback when an employee has no custom payroll breakdown set.
                      Override per-employee in the Employees page.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-4">
                  <NumField
                    label="Default HRA (% of Basic)"
                    value={rules.defaultHraPct}
                    onChange={(v) => set({ defaultHraPct: v })}
                    min={0} max={100} suffix="%" hint="Typical: 40% metro, 20% non-metro"
                  />
                  <NumField
                    label="Default DA (% of Basic)"
                    value={rules.defaultDaPct}
                    onChange={(v) => set({ defaultDaPct: v })}
                    min={0} max={100} suffix="%" hint="Dearness Allowance. Typical: 10%"
                  />
                  <NumField
                    label="Default TA (₹/month)"
                    value={rules.defaultTa}
                    onChange={(v) => set({ defaultTa: v })}
                    hint="Transport Allowance. Typical: ₹1,500–₹3,200"
                  />
                </div>
              </div>
            </div>

            {/* ── Attendance Deductions ─────────────────────────────────────── */}
            <div className="bg-white border-2 border-black">
              <div className="p-4 border-b-2 border-black bg-[#F0F6FF]">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-[#024BAB]" />
                  <div>
                    <h2 className="font-black text-base">Attendance Deduction Rules</h2>
                    <p className="text-xs text-gray-500">
                      Shift timing, grace period, late/early/absent deductions. Per-employee shift overrides these.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-6">

                {/* Shift start */}
                <div>
                  <SectionHeader
                    icon={<Clock className="w-4 h-4" />}
                    title="Shift Start Time (Fallback)"
                    subtitle="Used only when employee has no shift assigned in their profile"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <NumField label="Hour (0–23)" value={rules.shiftStartHour} onChange={(v) => set({ shiftStartHour: v })} min={0} max={23} />
                    <NumField label="Minute (0–59)" value={rules.shiftStartMinute} onChange={(v) => set({ shiftStartMinute: v })} min={0} max={59} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Shift starts at <strong>{fmt(rules.shiftStartHour, rules.shiftStartMinute)}</strong>
                  </p>
                </div>

                {/* Shift end */}
                <div className="border-t pt-5">
                  <SectionHeader
                    icon={<Clock className="w-4 h-4" />}
                    title="Shift End Time (Fallback)"
                    subtitle="Reference for early checkout detection"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <NumField label="Hour (0–23)" value={rules.shiftEndHour} onChange={(v) => set({ shiftEndHour: v })} min={0} max={23} />
                    <NumField label="Minute (0–59)" value={rules.shiftEndMinute} onChange={(v) => set({ shiftEndMinute: v })} min={0} max={59} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Shift ends at <strong>{fmt(rules.shiftEndHour, rules.shiftEndMinute)}</strong>
                  </p>
                </div>

                {/* Early checkout */}
                <div className="border-t pt-5">
                  <SectionHeader
                    icon={<LogOut className="w-4 h-4" />}
                    title="Early Checkout Deduction"
                    subtitle="Proportional deduction when employee leaves before shift end"
                  />
                  <Toggle
                    label="Enable Early Checkout Deduction"
                    description="Deducts proportionally based on how many minutes short the employee worked"
                    checked={rules.earlyCheckoutDeductionEnabled}
                    onChange={(v) => set({ earlyCheckoutDeductionEnabled: v })}
                  />
                  {rules.earlyCheckoutDeductionEnabled && (
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <NumField
                        label="Grace Period (min)"
                        value={rules.earlyCheckoutThresholdMinutes}
                        onChange={(v) => set({ earlyCheckoutThresholdMinutes: v })}
                        hint="No deduction if employee leaves within this many minutes of shift end"
                      />
                    </div>
                  )}
                </div>

                {/* Late deduction */}
                <div className="border-t pt-5">
                  <SectionHeader title="Late Arrival" subtitle="Applies after grace period" />
                  <div className="grid grid-cols-3 gap-4">
                    <NumField
                      label="Grace Period (min)"
                      value={rules.lateThresholdMinutes}
                      onChange={(v) => set({ lateThresholdMinutes: v })}
                      hint={`On time if arriving by ${fmt(rules.shiftStartHour, rules.shiftStartMinute + rules.lateThresholdMinutes)}`}
                    />
                    <div>
                      <label className="block text-xs font-black uppercase mb-1 text-gray-600">Deduction Type</label>
                      <select
                        value={rules.lateDeductionType}
                        onChange={(e) => set({ lateDeductionType: e.target.value as "fixed" | "percent" })}
                        className="w-full border-2 border-black px-3 py-2 text-sm bg-white focus:outline-none"
                      >
                        <option value="fixed">Fixed Amount (₹)</option>
                        <option value="percent">% of Daily Salary</option>
                      </select>
                    </div>
                    <NumField
                      label={rules.lateDeductionType === "fixed" ? "Amount per Late Day (₹)" : "% of Daily Salary"}
                      value={rules.lateDeductionAmount}
                      onChange={(v) => set({ lateDeductionAmount: v })}
                      suffix={rules.lateDeductionType === "percent" ? "%" : undefined}
                    />
                  </div>
                </div>

                {/* Half-day */}
                <div className="border-t pt-5">
                  <SectionHeader title="Half-Day Rule" subtitle="Very late arrivals counted as half day" />
                  <div className="grid grid-cols-2 gap-4">
                    <NumField
                      label="Late by more than (min) = Half Day"
                      value={rules.halfDayThresholdMinutes}
                      onChange={(v) => set({ halfDayThresholdMinutes: v })}
                      hint={`Half day if arriving after ${fmt(rules.shiftStartHour, rules.shiftStartMinute + rules.halfDayThresholdMinutes)}`}
                    />
                    <NumField
                      label="Half-Day Deduction (% of Daily Salary)"
                      value={rules.halfDayDeductionPercent}
                      onChange={(v) => set({ halfDayDeductionPercent: v })}
                      min={0} max={100} suffix="%" hint="Typical: 50% of daily salary"
                    />
                  </div>
                </div>

                {/* Absent */}
                <div className="border-t pt-5">
                  <SectionHeader title="Absent Day Deduction" subtitle="Per day without any attendance record" />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase mb-1 text-gray-600">Deduction Type</label>
                      <select
                        value={rules.absentDeductionType}
                        onChange={(e) => set({ absentDeductionType: e.target.value as "fixed" | "percent" })}
                        className="w-full border-2 border-black px-3 py-2 text-sm bg-white focus:outline-none"
                      >
                        <option value="fixed">Fixed Amount (₹)</option>
                        <option value="percent">% of Daily Salary</option>
                      </select>
                    </div>
                    <NumField
                      label={rules.absentDeductionType === "fixed" ? "Amount per Absent Day (₹)" : "% of Daily Salary per Absent Day"}
                      value={rules.absentDeductionAmount}
                      onChange={(v) => set({ absentDeductionAmount: v })}
                      suffix={rules.absentDeductionType === "percent" ? "%" : undefined}
                      hint="100% = deduct a full day's salary per absent day"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-6 py-3 font-black text-sm uppercase disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save All Settings"}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
