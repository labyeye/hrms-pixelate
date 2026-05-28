import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { settingsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Landmark,
  FileText,
  Loader2,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── HRMS Permission matrix ───────────────────────────────────────────────────
type CrudOp = "create" | "read" | "update" | "delete";
type HrmsRole =
  | "super_admin"
  | "hr_manager"
  | "hr_executive"
  | "department_head"
  | "employee";

interface ResourcePermissions {
  resource: string;
  permissions: Record<HrmsRole, Record<CrudOp, boolean>>;
}

const HRMS_ROLES: { id: HrmsRole; label: string }[] = [
  { id: "super_admin", label: "Super Admin" },
  { id: "hr_manager", label: "HR Manager" },
  { id: "hr_executive", label: "HR Exec" },
  { id: "department_head", label: "Dept Head" },
  { id: "employee", label: "Employee" },
];

const INITIAL_PERMISSIONS: ResourcePermissions[] = [
  {
    resource: "Employees",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      hr_manager: { create: true, read: true, update: true, delete: false },
      hr_executive: { create: true, read: true, update: true, delete: false },
      department_head: {
        create: false,
        read: true,
        update: false,
        delete: false,
      },
      employee: { create: false, read: false, update: false, delete: false },
    },
  },
  {
    resource: "Departments",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      hr_manager: { create: true, read: true, update: true, delete: false },
      hr_executive: { create: false, read: true, update: false, delete: false },
      department_head: {
        create: false,
        read: true,
        update: false,
        delete: false,
      },
      employee: { create: false, read: false, update: false, delete: false },
    },
  },
  {
    resource: "Attendance",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      hr_manager: { create: true, read: true, update: true, delete: true },
      hr_executive: { create: true, read: true, update: true, delete: false },
      department_head: {
        create: false,
        read: true,
        update: false,
        delete: false,
      },
      employee: { create: false, read: true, update: false, delete: false },
    },
  },
  {
    resource: "Leave",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      hr_manager: { create: true, read: true, update: true, delete: true },
      hr_executive: { create: true, read: true, update: true, delete: false },
      department_head: {
        create: false,
        read: true,
        update: true,
        delete: false,
      },
      employee: { create: true, read: true, update: false, delete: false },
    },
  },
  {
    resource: "Payroll",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      hr_manager: { create: true, read: true, update: true, delete: false },
      hr_executive: { create: false, read: true, update: false, delete: false },
      department_head: {
        create: false,
        read: false,
        update: false,
        delete: false,
      },
      employee: { create: false, read: true, update: false, delete: false },
    },
  },
  {
    resource: "Performance",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      hr_manager: { create: true, read: true, update: true, delete: true },
      hr_executive: { create: true, read: true, update: true, delete: false },
      department_head: {
        create: false,
        read: true,
        update: true,
        delete: false,
      },
      employee: { create: false, read: true, update: false, delete: false },
    },
  },
  {
    resource: "Recruitment",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      hr_manager: { create: true, read: true, update: true, delete: true },
      hr_executive: { create: true, read: true, update: true, delete: false },
      department_head: {
        create: false,
        read: true,
        update: false,
        delete: false,
      },
      employee: { create: false, read: false, update: false, delete: false },
    },
  },
  {
    resource: "Biometric",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      hr_manager: { create: true, read: true, update: true, delete: false },
      hr_executive: { create: false, read: true, update: false, delete: false },
      department_head: {
        create: false,
        read: false,
        update: false,
        delete: false,
      },
      employee: { create: false, read: false, update: false, delete: false },
    },
  },
  {
    resource: "Reports",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      hr_manager: { create: false, read: true, update: false, delete: false },
      hr_executive: { create: false, read: true, update: false, delete: false },
      department_head: {
        create: false,
        read: false,
        update: false,
        delete: false,
      },
      employee: { create: false, read: false, update: false, delete: false },
    },
  },
  {
    resource: "Settings",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      hr_manager: { create: false, read: true, update: true, delete: false },
      hr_executive: {
        create: false,
        read: false,
        update: false,
        delete: false,
      },
      department_head: {
        create: false,
        read: false,
        update: false,
        delete: false,
      },
      employee: { create: false, read: false, update: false, delete: false },
    },
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [permissions, setPermissions] =
    useState<ResourcePermissions[]>(INITIAL_PERMISSIONS);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsAPI.get();
      setSettings(res.data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setSettings({
        companyName: user?.company?.name || "",
        companyGST: "",
        companyAddress: "",
        companyPhone: "",
        companyEmail: user?.company?.email || "",
        companyWebsite: "",
        logoUrl: "",
        bankAccountName: "",
        bankAccountNumber: "",
        bankIFSC: "",
        bankName: "",
        bankBranch: "",
        quotationTitle: "PROFORMA INVOICE",
        quotationFooter: "",
        quotationTerms: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setSettings((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please upload a valid image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogoPreview(base64);
      setSettings((prev: any) => ({ ...prev, logoUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleTermsChange = (index: number, value: string) => {
    const newTerms = [...(settings.quotationTerms || [])];
    newTerms[index] = value;
    setSettings((prev: any) => ({ ...prev, quotationTerms: newTerms }));
  };

  const addTerm = () => {
    setSettings((prev: any) => ({
      ...prev,
      quotationTerms: [...(prev.quotationTerms || []), ""],
    }));
  };

  const removeTerm = (index: number) => {
    const newTerms = (settings.quotationTerms || []).filter(
      (_: any, i: number) => i !== index,
    );
    setSettings((prev: any) => ({ ...prev, quotationTerms: newTerms }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsAPI.update(settings);
      setActionModal({
        show: true,
        type: "success",
        title: "Settings Saved",
        message: "Settings saved successfully.",
      });
    } catch (error: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: error.message || "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  // Auto-close success modal after 2 seconds
  useEffect(() => {
    if (actionModal.show && actionModal.type === "success") {
      const timer = setTimeout(() => {
        setActionModal({ ...actionModal, show: false });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [actionModal.show, actionModal.type]);

  if (loading) {
    return (
      <AppLayout title="Settings">
        <div className="flex h-[80vh] items-center justify-center">
          <div className="w-10 h-10 bg-[#024BAB] border-2 border-black nb-shadow animate-bounce flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const InputField = ({
    label,
    name,
    value,
    placeholder = "",
    type = "text",
  }: any) => (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-black uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border-2 border-black nb-shadow text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 bg-white"
      />
    </div>
  );

  const TextAreaField = ({
    label,
    name,
    value,
    placeholder = "",
    rows = 3,
  }: any) => (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-black uppercase tracking-wider">
        {label}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border-2 border-black nb-shadow text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 bg-white resize-none"
      />
    </div>
  );

  return (
    <AppLayout title="Settings">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-black">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage company information and quotation settings
            </p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="nb-card bg-white border-2 border-black">
          <div className="flex border-b-2 border-black flex-wrap">
            {[
              { id: "general", label: "General Info", icon: Building2 },
              { id: "bank", label: "Bank Details", icon: Landmark },
              { id: "quotation", label: "Quotation", icon: FileText },
              { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
              { id: "permissions", label: "Permissions", icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border-r-2 border-black last:border-r-0",
                    activeTab === tab.id
                      ? "bg-[#024BAB] text-white"
                      : "bg-white text-black hover:bg-gray-50",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* General Info Tab */}
            {activeTab === "general" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Company Name"
                    name="companyName"
                    value={settings?.companyName || ""}
                  />
                  <InputField
                    label="Company Email"
                    name="companyEmail"
                    value={settings?.companyEmail || ""}
                    type="email"
                  />
                  <InputField
                    label="Company Phone"
                    name="companyPhone"
                    value={settings?.companyPhone || ""}
                  />
                  <InputField
                    label="GST Number"
                    name="companyGST"
                    value={settings?.companyGST || ""}
                  />
                  <InputField
                    label="Website"
                    name="companyWebsite"
                    value={settings?.companyWebsite || ""}
                    type="url"
                  />
                </div>

                {/* Logo Upload */}
                <div className="border-t-2 border-black pt-4 mt-4">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-3">
                    Company Logo
                  </label>
                  <div className="flex gap-4">
                    {/* Upload Input */}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="block w-full px-4 py-3 border-2 border-dashed border-black hover:bg-[#024BAB]/5 transition-colors cursor-pointer text-center"
                      >
                        <div className="text-xs font-bold text-black">
                          Click to upload logo
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          PNG, JPG, GIF up to 5MB
                        </div>
                      </label>
                    </div>

                    {/* Logo Preview */}
                    {(logoPreview || settings?.logoUrl) &&
                      !logoPreview?.startsWith("data:") && (
                        <div className="flex items-center gap-2">
                          <img
                            src={logoPreview || settings?.logoUrl}
                            alt="Logo preview"
                            className="w-24 h-24 object-contain border-2 border-black nb-shadow-sm bg-white p-2"
                          />
                          <button
                            onClick={() => {
                              setLogoPreview(null);
                              setSettings((prev: any) => ({
                                ...prev,
                                logoUrl: "",
                              }));
                            }}
                            className="px-2 py-1 bg-[#EF4444] text-white text-xs font-bold border-2 border-black hover:bg-[#DC2626] nb-shadow-sm"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    {logoPreview?.startsWith("data:") && (
                      <div className="flex items-center gap-2">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-24 h-24 object-contain border-2 border-black nb-shadow-sm bg-white p-2"
                        />
                        <button
                          onClick={() => {
                            setLogoPreview(null);
                            setSettings((prev: any) => ({
                              ...prev,
                              logoUrl: "",
                            }));
                          }}
                          className="px-2 py-1 bg-[#EF4444] text-white text-xs font-bold border-2 border-black hover:bg-[#DC2626] nb-shadow-sm"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <TextAreaField
                  label="Company Address"
                  name="companyAddress"
                  value={settings?.companyAddress || ""}
                  placeholder="Enter full company address"
                  rows={3}
                />
              </div>
            )}

            {/* Bank Details Tab */}
            {activeTab === "bank" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Bank Name"
                    name="bankName"
                    value={settings?.bankName || ""}
                  />
                  <InputField
                    label="Bank Branch"
                    name="bankBranch"
                    value={settings?.bankBranch || ""}
                  />
                  <InputField
                    label="Account Holder Name"
                    name="bankAccountName"
                    value={settings?.bankAccountName || ""}
                  />
                  <InputField
                    label="Account Number"
                    name="bankAccountNumber"
                    value={settings?.bankAccountNumber || ""}
                  />
                  <InputField
                    label="IFSC Code"
                    name="bankIFSC"
                    value={settings?.bankIFSC || ""}
                  />
                </div>
              </div>
            )}

            {/* WhatsApp Tab */}
            {activeTab === "whatsapp" && (
              <div className="space-y-6">
                {/* Enable toggle */}
                <div className="flex items-center justify-between p-4 border-2 border-black bg-green-50">
                  <div>
                    <p className="font-black text-sm text-black">
                      Enable WhatsApp Notifications
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Send automated WhatsApp messages via Twilio for leave,
                      payroll and attendance events
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSettings((p: any) => ({
                        ...p,
                        whatsappEnabled: !p?.whatsappEnabled,
                      }))
                    }
                    className={cn(
                      "w-12 h-6 border-2 border-black relative transition-colors",
                      settings?.whatsappEnabled
                        ? "bg-green-500"
                        : "bg-gray-300",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-4 h-4 bg-white border border-black transition-all",
                        settings?.whatsappEnabled ? "left-6" : "left-0.5",
                      )}
                    />
                  </button>
                </div>

                {/* Twilio Credentials */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
                    Twilio Credentials
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField
                      label="Account SID"
                      name="twilioAccountSid"
                      value={settings?.twilioAccountSid || ""}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                    <InputField
                      label="Auth Token"
                      name="twilioAuthToken"
                      value={settings?.twilioAuthToken || ""}
                      placeholder="Your Twilio Auth Token"
                      type="password"
                    />
                    <InputField
                      label="WhatsApp From Number"
                      name="twilioWhatsappFrom"
                      value={
                        settings?.twilioWhatsappFrom || "whatsapp:+14155238886"
                      }
                      placeholder="whatsapp:+14155238886"
                    />
                  </div>
                  <div className="p-3 bg-blue-50 border-2 border-[#024BAB]/30 text-xs text-gray-600 space-y-1">
                    <p className="font-black text-[#024BAB]">
                      How to set up Twilio WhatsApp
                    </p>
                    <p>
                      1. Create a free account at <strong>twilio.com</strong>
                    </p>
                    <p>
                      2. Go to Console → Messaging → Try it out → Send a
                      WhatsApp message
                    </p>
                    <p>
                      3. For sandbox: From number is{" "}
                      <code className="bg-white px-1 border">
                        whatsapp:+14155238886
                      </code>
                    </p>
                    <p>
                      4. Each employee must send{" "}
                      <strong>"join &lt;sandbox-keyword&gt;"</strong> to the
                      sandbox number once to opt in
                    </p>
                    <p>
                      5. Employee phone numbers in their profile must include
                      country code (e.g. +919876543210)
                    </p>
                  </div>
                </div>

                {/* Notification toggles */}
                <div className="border-t-2 border-black pt-4 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
                    Notification Events
                  </h3>
                  {[
                    {
                      key: "whatsappNotifyLeave",
                      label: "Leave Approved / Rejected",
                      desc: "Notify employee when HR approves or rejects their leave request",
                    },
                    {
                      key: "whatsappNotifyPayroll",
                      label: "Salary Credited",
                      desc: "Notify employee when their payroll is marked as paid",
                    },
                    {
                      key: "whatsappNotifyCheckIn",
                      label: "Biometric Check-In / Check-Out",
                      desc: "Notify employee when attendance is recorded via biometric device",
                    },
                  ].map(({ key, label, desc }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 border-2 border-gray-200 bg-white"
                    >
                      <div>
                        <p className="font-bold text-sm text-black">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                      <button
                        onClick={() =>
                          setSettings((p: any) => ({ ...p, [key]: !p?.[key] }))
                        }
                        className={cn(
                          "w-10 h-5 border-2 border-black relative transition-colors shrink-0",
                          settings?.[key] !== false
                            ? "bg-[#024BAB]"
                            : "bg-gray-300",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 w-3 h-3 bg-white border border-black transition-all",
                            settings?.[key] !== false ? "left-5" : "left-0.5",
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Permissions Tab */}
            {activeTab === "permissions" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0 nb-shadow-sm">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-black">
                      Role Permissions
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Configure what each role can do per resource
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table
                    className="w-full border-2 border-black"
                    style={{ minWidth: 700 }}
                  >
                    <thead>
                      <tr className="bg-[#024BAB]">
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r-2 border-black w-32">
                          Resource
                        </th>
                        {HRMS_ROLES.map((role) => (
                          <th
                            key={role.id}
                            className="px-2 py-3 text-center text-xs font-bold text-white uppercase tracking-wider border-r-2 border-black last:border-r-0"
                            colSpan={4}
                          >
                            {role.label}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-[#024BAB]/10 border-b-2 border-black">
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-black uppercase tracking-wider border-r-2 border-black" />
                        {HRMS_ROLES.map((role) =>
                          ["C", "R", "U", "D"].map((op) => (
                            <th
                              key={`${role.id}-${op}`}
                              className="px-1 py-2 text-center text-[10px] font-bold text-black uppercase tracking-wider border-r border-black/20 last:border-r-2 last:border-black"
                            >
                              {op}
                            </th>
                          )),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {permissions.map((res, resIdx) => (
                        <tr
                          key={res.resource}
                          className={cn(
                            "border-b-2 border-black last:border-b-0 transition-colors",
                            resIdx % 2 === 0 ? "bg-white" : "bg-[#024BAB]/5",
                          )}
                        >
                          <td className="px-4 py-3 text-xs font-bold text-black border-r-2 border-black whitespace-nowrap">
                            {res.resource}
                          </td>
                          {HRMS_ROLES.map((role) =>
                            (
                              ["create", "read", "update", "delete"] as (
                                | "create"
                                | "read"
                                | "update"
                                | "delete"
                              )[]
                            ).map((op) => {
                              const checked = res.permissions[role.id][op];
                              const isSuperAdmin = role.id === "super_admin";
                              return (
                                <td
                                  key={`${role.id}-${op}`}
                                  className="px-1 py-3 text-center border-r border-black/20 last:border-r-2 last:border-black"
                                >
                                  <button
                                    onClick={() => {
                                      if (isSuperAdmin) return;
                                      setPermissions((prev) =>
                                        prev.map((r, i) =>
                                          i !== resIdx
                                            ? r
                                            : {
                                                ...r,
                                                permissions: {
                                                  ...r.permissions,
                                                  [role.id]: {
                                                    ...r.permissions[role.id],
                                                    [op]: !r.permissions[
                                                      role.id
                                                    ][op],
                                                  },
                                                },
                                              },
                                        ),
                                      );
                                    }}
                                    disabled={isSuperAdmin}
                                    className={cn(
                                      "w-5 h-5 border-2 border-black flex items-center justify-center mx-auto transition-colors",
                                      checked
                                        ? "bg-[#024BAB]"
                                        : "bg-white hover:bg-[#024BAB]/10",
                                      isSuperAdmin &&
                                        "opacity-60 cursor-not-allowed",
                                    )}
                                    title={
                                      isSuperAdmin
                                        ? "Super Admin always has full access"
                                        : `Toggle ${op} for ${role.label}`
                                    }
                                  >
                                    {checked && (
                                      <svg
                                        className="w-3 h-3 text-white"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                      >
                                        <path
                                          d="M2 6l3 3 5-5"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    )}
                                  </button>
                                </td>
                              );
                            }),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-start gap-2 p-3 border-2 border-black bg-[#FA731C]/10">
                  <span className="text-[10px] font-bold text-[#FA731C] uppercase tracking-wider shrink-0 mt-0.5">
                    Note
                  </span>
                  <p className="text-xs text-black">
                    C = Create, R = Read, U = Update, D = Delete. Super Admin
                    always has full access. Changes here configure the role
                    model for your HR team.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() =>
                      setActionModal({
                        show: true,
                        type: "success",
                        title: "Permissions Saved",
                        message: "Role permissions have been updated.",
                      })
                    }
                    className={cn(
                      "nb-card px-6 py-3 text-sm font-bold text-white border-2 border-black nb-shadow flex items-center gap-2 bg-[#024BAB] hover:bg-[#01368A] active:scale-95",
                    )}
                  >
                    <Save className="w-4 h-4" />
                    Save Permissions
                  </button>
                </div>
              </div>
            )}

            {/* Quotation Tab */}
            {activeTab === "quotation" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <InputField
                    label="Quotation Title"
                    name="quotationTitle"
                    value={settings?.quotationTitle || ""}
                  />
                  <TextAreaField
                    label="Quotation Footer"
                    name="quotationFooter"
                    value={settings?.quotationFooter || ""}
                    placeholder="Footer text for quotations"
                    rows={2}
                  />
                </div>

                {/* Terms & Conditions */}
                <div className="border-t-2 border-black pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                      Terms & Conditions
                    </h3>
                    <button
                      onClick={addTerm}
                      className="nb-card px-3 py-1.5 text-xs font-bold text-white bg-[#00C48C] border-2 border-black hover:bg-[#00B87C] transition-colors flex items-center gap-1 nb-shadow-sm"
                    >
                      <Plus className="w-3 h-3" />
                      Add Term
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(settings?.quotationTerms || []).map(
                      (term: string, index: number) => (
                        <div key={index} className="flex gap-2">
                          <textarea
                            value={term}
                            onChange={(e) =>
                              handleTermsChange(index, e.target.value)
                            }
                            placeholder={`Term ${index + 1}`}
                            rows={2}
                            className="flex-1 px-3 py-2 border-2 border-black nb-shadow text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 bg-white resize-none"
                          />
                          <button
                            onClick={() => removeTerm(index)}
                            className="nb-card px-3 py-2 text-white bg-[#EF4444] border-2 border-black hover:bg-[#DC2626] transition-colors flex items-center gap-1 nb-shadow-sm self-start"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ),
                    )}
                  </div>

                  {(!settings?.quotationTerms ||
                    settings.quotationTerms.length === 0) && (
                    <div className="text-center py-6 border-2 border-dashed border-gray-300">
                      <p className="text-xs text-muted-foreground">
                        No terms added. Click "Add Term" to get started.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "nb-card px-6 py-3 text-sm font-bold text-white border-2 border-black nb-shadow",
              "flex items-center gap-2 transition-all",
              saving
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#024BAB] hover:bg-[#01368A] active:scale-95",
            )}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success/Error Animation Modal */}
      {actionModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="nb-card bg-white w-full max-w-sm p-8 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
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
