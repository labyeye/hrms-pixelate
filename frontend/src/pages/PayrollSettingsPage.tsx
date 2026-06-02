import { useState, useEffect, useCallback } from "react";
import { payrollConfigAPI, employeeAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  DollarSign,
  User,
  Search,
  Loader2,
  Save,
  AlertCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

type Tab = "employee" | "deductions";

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  designation?: string;
  salary?: number;
}

interface PayrollConfig {
  _id?: string;
  basicSalary: number;
  hra: number;
  da: number;
  ta: number;
  medicalAllowance: number;
  otherAllowances: number;
}

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

const EMPTY_CONFIG: PayrollConfig = {
  basicSalary: 0,
  hra: 0,
  da: 0,
  ta: 0,
  medicalAllowance: 0,
  otherAllowances: 0,
};

export default function PayrollSettingsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("employee");

  // Employee payroll config state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [config, setConfig] = useState<PayrollConfig>(EMPTY_CONFIG);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Deduction rules state
  const [rules, setRules] = useState<DeductionRule>(DEFAULT_DEDUCTIONS);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const res = await employeeAPI.getAll();
      setEmployees(res.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setEmpLoading(false);
    }
  }, [toast]);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await payrollConfigAPI.getDeductionRules();
      if (res.data) setRules(res.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRulesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    if (tab === "deductions") fetchRules();
  }, [tab, fetchRules]);

  const loadConfig = useCallback(
    async (emp: Employee) => {
      setConfigLoading(true);
      try {
        const res = await payrollConfigAPI.getConfig(emp._id);
        if (res.data) {
          const {
            basicSalary,
            hra,
            da,
            ta,
            medicalAllowance,
            otherAllowances,
          } = res.data;
          setConfig({
            basicSalary,
            hra,
            da,
            ta,
            medicalAllowance,
            otherAllowances,
          });
        } else {
          // Prefill basic from employee.salary
          setConfig({ ...EMPTY_CONFIG, basicSalary: emp.salary || 0 });
        }
      } catch (e: any) {
        setConfig({ ...EMPTY_CONFIG, basicSalary: emp.salary || 0 });
        toast({
          title: "Error loading payroll config",
          description: e.message,
          variant: "destructive",
        });
      } finally {
        setConfigLoading(false);
      }
    },
    [toast],
  );

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    loadConfig(emp);
  };

  const handleSaveConfig = async () => {
    if (!selectedEmployee || configSaving) return;
    setConfigSaving(true);
    try {
      await payrollConfigAPI.upsertConfig(selectedEmployee._id, config);
      toast({
        title: "Payroll settings saved",
        description: `Saved for ${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
        variant: "success",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleSaveRules = async () => {
    if (rulesSaving) return;
    setRulesSaving(true);
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
      setRulesSaving(false);
    }
  };

  const gross =
    config.basicSalary +
    config.hra +
    config.da +
    config.ta +
    config.medicalAllowance +
    config.otherAllowances;

  const filteredEmployees = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q)
    );
  });

  const numInput = (
    label: string,
    key: keyof PayrollConfig,
    placeholder = "0",
  ) => (
    <div>
      <label className="block text-xs font-black uppercase mb-1 text-gray-600">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
          ₹
        </span>
        <input
          type="number"
          min={0}
          value={config[key] || ""}
          onChange={(e) =>
            setConfig((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))
          }
          placeholder={placeholder}
          className="w-full border-2 border-black pl-7 pr-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
        />
      </div>
    </div>
  );

  return (
    <AppLayout title="Payroll Settings">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display font-black text-3xl text-black">
            Payroll Settings
          </h1>
          <p className="text-gray-600 font-medium mt-1">
            Configure per-employee salary and company-wide deduction rules
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-8 border-2 border-black w-fit overflow-hidden nb-shadow-sm">
          {(
            [
              { id: "employee", label: "Employee Payroll", icon: User },
              { id: "deductions", label: "Deduction Rules", icon: ShieldAlert },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-black uppercase transition-all",
                tab === t.id
                  ? "bg-[#024BAB] text-white"
                  : "bg-white text-black hover:bg-gray-50",
                t.id === "employee" && "border-r-2 border-black",
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── EMPLOYEE PAYROLL TAB ──────────────────────────────────────────── */}
        {tab === "employee" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Employee list */}
            <div className="lg:col-span-2">
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full border-2 border-black pl-9 pr-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>

              {empLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                  {filteredEmployees.map((emp) => (
                    <button
                      key={emp._id}
                      onClick={() => selectEmployee(emp)}
                      className={cn(
                        "w-full text-left p-4 border-2 transition-all",
                        selectedEmployee?._id === emp._id
                          ? "border-[#024BAB] bg-blue-50 nb-shadow"
                          : "border-black bg-white hover:nb-shadow-sm",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-black text-sm">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            {emp.employeeId}
                          </p>
                          {emp.designation && (
                            <p className="text-xs text-gray-400">
                              {emp.designation}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <p className="text-center py-8 text-gray-400 font-medium text-sm">
                      No employees found
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Config form */}
            <div className="lg:col-span-3">
              {!selectedEmployee ? (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-300 bg-white py-24">
                  <div className="text-center">
                    <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">
                      Select an employee to set their payroll
                    </p>
                  </div>
                </div>
              ) : configLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
                </div>
              ) : (
                <div className="bg-white border-2 border-black nb-shadow">
                  <div className="p-5 border-b-2 border-black bg-[#F0F6FF]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#024BAB] border-2 border-black flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="font-black text-lg">
                          {selectedEmployee.firstName}{" "}
                          {selectedEmployee.lastName}
                        </h2>
                        <p className="text-sm font-mono text-gray-500">
                          {selectedEmployee.employeeId}
                          {selectedEmployee.designation &&
                            ` · ${selectedEmployee.designation}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4 p-3 bg-yellow-50 border border-yellow-200">
                      <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
                      <p className="text-xs font-medium text-yellow-700">
                        These settings override the default salary when
                        processing payroll. Leave at 0 to use employee's base
                        salary.
                      </p>
                    </div>

                    <h3 className="font-black text-sm uppercase mb-4 text-gray-700">
                      Earnings
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {numInput("Basic Salary", "basicSalary")}
                      {numInput("HRA", "hra")}
                      {numInput("DA (Dearness Allowance)", "da")}
                      {numInput("TA (Transport Allowance)", "ta")}
                      {numInput("Medical Allowance", "medicalAllowance")}
                      {numInput("Other Allowances", "otherAllowances")}
                    </div>

                    {/* Gross summary */}
                    <div className="bg-[#024BAB] text-white border-2 border-black p-4 mb-5">
                      <div className="flex items-center justify-between">
                        <span className="font-black uppercase text-sm">
                          Gross Salary
                        </span>
                        <span className="font-black text-xl">
                          {formatCurrency(gross)}
                        </span>
                      </div>
                      <p className="text-xs text-blue-200 mt-1">
                        PF, ESI, TDS & attendance deductions calculated at
                        payroll processing time
                      </p>
                    </div>

                    <button
                      onClick={handleSaveConfig}
                      disabled={configSaving}
                      className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-5 py-2.5 font-black text-sm uppercase nb-shadow-sm disabled:opacity-60"
                    >
                      {configSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {configSaving ? "Saving..." : "Save Payroll Settings"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DEDUCTION RULES TAB ───────────────────────────────────────────── */}
        {tab === "deductions" && (
          <div>
            {rulesLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
              </div>
            ) : (
              <div className="bg-white border-2 border-black nb-shadow">
                <div className="p-5 border-b-2 border-black bg-[#F0F6FF]">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-6 h-6 text-[#024BAB]" />
                    <div>
                      <h2 className="font-black text-lg">
                        Global Deduction Rules
                      </h2>
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
                            setRules((p) => ({
                              ...p,
                              shiftStartHour: Number(e.target.value),
                            }))
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
                            setRules((p) => ({
                              ...p,
                              shiftStartMinute: Number(e.target.value),
                            }))
                          }
                          className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Shift starts at{" "}
                      {String(rules.shiftStartHour).padStart(2, "0")}:
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
                            setRules((p) => ({
                              ...p,
                              lateThresholdMinutes: Number(e.target.value),
                            }))
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
                            setRules((p) => ({
                              ...p,
                              lateDeductionType: e.target.value as
                                | "fixed"
                                | "percent",
                            }))
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
                            setRules((p) => ({
                              ...p,
                              lateDeductionAmount: Number(e.target.value),
                            }))
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
                            setRules((p) => ({
                              ...p,
                              halfDayThresholdMinutes: Number(e.target.value),
                            }))
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
                            setRules((p) => ({
                              ...p,
                              halfDayDeductionPercent: Number(e.target.value),
                            }))
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
                            setRules((p) => ({
                              ...p,
                              absentDeductionType: e.target.value as
                                | "fixed"
                                | "percent",
                            }))
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
                            setRules((p) => ({
                              ...p,
                              absentDeductionAmount: Number(e.target.value),
                            }))
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
                    onClick={handleSaveRules}
                    disabled={rulesSaving}
                    className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-5 py-2.5 font-black text-sm uppercase nb-shadow-sm disabled:opacity-60"
                  >
                    {rulesSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {rulesSaving ? "Saving..." : "Save Deduction Rules"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
