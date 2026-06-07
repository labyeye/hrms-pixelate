import { useState, useEffect, useCallback } from "react";
import { payrollConfigAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { ShieldAlert, Clock, Loader2, Save } from "lucide-react";

interface DeductionRule {
  shiftStartHour: number;
  shiftStartMinute: number;
  lateThresholdMinutes: number;
  lateDeductionType: "fixed" | "percent";
  lateDeductionAmount: number;
  halfDayThresholdMinutes: number;
  halfDayDeductionPercent: number;
  absentDeductionType: "fixed" | "percent";
  absentDeductionAmount: number;
}

const DEFAULT_DEDUCTIONS: DeductionRule = {
  shiftStartHour: 9,
  shiftStartMinute: 0,
  lateThresholdMinutes: 15,
  lateDeductionType: "fixed",
  lateDeductionAmount: 0,
  halfDayThresholdMinutes: 120,
  halfDayDeductionPercent: 50,
  absentDeductionType: "percent",
  absentDeductionAmount: 100,
};

export default function PayrollSettingsPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<DeductionRule>(DEFAULT_DEDUCTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payrollConfigAPI.getDeductionRules();
      if (res.data) setRules(res.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await payrollConfigAPI.upsertDeductionRules(rules);
      toast({
        title: "Deduction rules saved",
        description: "Global rules updated for all employees",
        variant: "success",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Payroll Settings">
      <div className="w-full mx-auto">
        <div className="mb-8">
          <h1 className="font-display font-black text-3xl text-black">
            Deduction Rules
          </h1>
          <p className="text-gray-600 font-medium mt-1">
            Company-wide attendance deduction rules applied during payroll processing.
            Employee salary components are configured in the Employees page.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
          </div>
        ) : (
          <div className="bg-white border-2 border-black">
            <div className="p-5 border-b-2 border-black bg-[#F0F6FF]">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-[#024BAB]" />
                <div>
                  <h2 className="font-black text-lg">Global Deduction Rules</h2>
                  <p className="text-sm text-gray-500 font-medium">
                    Applied to all employees during payroll processing
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-7">
              {/* Shift time */}
              <div>
                <h3 className="font-black text-sm uppercase mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Shift Start Time
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase mb-1 text-gray-600">
                      Hour (0–23)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={rules.shiftStartHour}
                      onChange={(e) =>
                        setRules((p) => ({ ...p, shiftStartHour: Number(e.target.value) }))
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-1 text-gray-600">
                      Minute
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={rules.shiftStartMinute}
                      onChange={(e) =>
                        setRules((p) => ({ ...p, shiftStartMinute: Number(e.target.value) }))
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Shift starts at {String(rules.shiftStartHour).padStart(2, "0")}:
                  {String(rules.shiftStartMinute).padStart(2, "0")}
                </p>
              </div>

              {/* Late deduction */}
              <div className="border-t pt-6">
                <h3 className="font-black text-sm uppercase mb-3 text-orange-600">
                  Late Arrival Deduction
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase mb-1 text-gray-600">
                      Grace Period (minutes)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={rules.lateThresholdMinutes}
                      onChange={(e) =>
                        setRules((p) => ({ ...p, lateThresholdMinutes: Number(e.target.value) }))
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      No deduction if late within this window
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-1 text-gray-600">
                      Deduction Type
                    </label>
                    <select
                      value={rules.lateDeductionType}
                      onChange={(e) =>
                        setRules((p) => ({ ...p, lateDeductionType: e.target.value as "fixed" | "percent" }))
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm bg-white focus:outline-none"
                    >
                      <option value="fixed">Fixed Amount (₹)</option>
                      <option value="percent">% of Daily Salary</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-1 text-gray-600">
                      {rules.lateDeductionType === "fixed"
                        ? "Amount per Late Day (₹)"
                        : "% of Daily Salary per Late Day"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={rules.lateDeductionAmount}
                      onChange={(e) =>
                        setRules((p) => ({ ...p, lateDeductionAmount: Number(e.target.value) }))
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Half-day deduction */}
              <div className="border-t pt-6">
                <h3 className="font-black text-sm uppercase mb-3 text-yellow-600">
                  Half-Day Rule
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase mb-1 text-gray-600">
                      Late by more than (minutes) = Half Day
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={rules.halfDayThresholdMinutes}
                      onChange={(e) =>
                        setRules((p) => ({ ...p, halfDayThresholdMinutes: Number(e.target.value) }))
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-1 text-gray-600">
                      Half-Day Deduction (% of Daily Salary)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rules.halfDayDeductionPercent}
                      onChange={(e) =>
                        setRules((p) => ({ ...p, halfDayDeductionPercent: Number(e.target.value) }))
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Absent deduction */}
              <div className="border-t pt-6">
                <h3 className="font-black text-sm uppercase mb-3 text-red-600">
                  Absent Day Deduction
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase mb-1 text-gray-600">
                      Deduction Type
                    </label>
                    <select
                      value={rules.absentDeductionType}
                      onChange={(e) =>
                        setRules((p) => ({ ...p, absentDeductionType: e.target.value as "fixed" | "percent" }))
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm bg-white focus:outline-none"
                    >
                      <option value="fixed">Fixed Amount (₹)</option>
                      <option value="percent">% of Daily Salary</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-1 text-gray-600">
                      {rules.absentDeductionType === "fixed"
                        ? "Amount per Absent Day (₹)"
                        : "% of Daily Salary per Absent Day"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={rules.absentDeductionAmount}
                      onChange={(e) =>
                        setRules((p) => ({ ...p, absentDeductionAmount: Number(e.target.value) }))
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Set to 100% to deduct full daily salary per absent day
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-5 py-2.5 font-black text-sm uppercase disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Save Deduction Rules"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
