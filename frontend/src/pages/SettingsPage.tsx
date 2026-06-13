import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { settingsAPI, authAPI } from "@/services/api";
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
  Users,
  Settings2,
  LayoutDashboard,
  Eye,
  EyeOff,
  Copy,
  UserCircle,
  Lock,
  Camera,
  X,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionModal } from "@/components/ui/ActionModal";

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

function InputField({
  label,
  name,
  value,
  placeholder = "",
  type = "text",
  required = false,
  maxLength,
  minLength,
  pattern,
  title: fieldTitle,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  title?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-black uppercase tracking-wider">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        minLength={minLength}
        pattern={pattern}
        title={fieldTitle}
        className="w-full px-3 py-2 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 bg-white"
      />
    </div>
  );
}

function TextAreaField({
  label,
  name,
  value,
  placeholder = "",
  rows = 3,
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-black uppercase tracking-wider">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="w-full px-3 py-2 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 bg-white resize-none"
      />
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
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

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    setProfileName(user?.name || "");
    setProfilePhone((user as any)?.phone || "");
  }, [user]);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const res = (await authAPI.updateProfile({ name: profileName.trim(), phone: profilePhone.trim() })) as any;
      updateUser({ name: res.data?.name || profileName.trim(), phone: res.data?.phone || profilePhone.trim() });
      toast({ title: "Profile saved", description: "Name and phone updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please choose an image under 3 MB", variant: "destructive" });
      return;
    }
    setPhotoUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      let finalBase64 = base64;
      if (base64.length > 500_000) {
        const img = new Image();
        img.src = base64;
        await new Promise<void>((r) => { img.onload = () => r(); });
        const canvas = document.createElement("canvas");
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        finalBase64 = canvas.toDataURL("image/jpeg", 0.8);
      }
      await authAPI.updateProfile({ avatar: finalBase64 });
      updateUser({ avatar: finalBase64 });
      toast({ title: "Photo updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Could not save photo", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    try {
      await authAPI.updateProfile({ avatar: "" });
      updateUser({ avatar: "" });
      toast({ title: "Photo removed" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwForm.next !== pwForm.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      await authAPI.updateProfile({ currentPassword: pwForm.current, password: pwForm.next });
      setPwForm({ current: "", next: "", confirm: "" });
      toast({ title: "Password changed", description: "Your new password is active." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to change password", variant: "destructive" });
    } finally {
      setPwSaving(false);
    }
  };

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

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please upload a valid image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

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
    if (activeTab === "general") {
      if (!settings?.companyName?.trim()) {
        setActionModal({
          show: true,
          type: "error",
          title: "Required Field Missing",
          message: "Please fill in: Company Name",
        });
        return;
      }
      if (!settings?.companyAddress?.trim()) {
        setActionModal({
          show: true,
          type: "error",
          title: "Required Field Missing",
          message: "Please fill in: Company Address",
        });
        return;
      }
    }
    if (activeTab === "bank") {
      if (!settings?.bankName?.trim()) {
        setActionModal({
          show: true,
          type: "error",
          title: "Required Field Missing",
          message: "Please fill in: Bank Name",
        });
        return;
      }
      if (!settings?.bankAccountName?.trim()) {
        setActionModal({
          show: true,
          type: "error",
          title: "Required Field Missing",
          message: "Please fill in: Account Holder Name",
        });
        return;
      }
      if (!settings?.bankAccountNumber?.trim()) {
        setActionModal({
          show: true,
          type: "error",
          title: "Required Field Missing",
          message: "Please fill in: Account Number",
        });
        return;
      }
      if (!settings?.bankIFSC?.trim()) {
        setActionModal({
          show: true,
          type: "error",
          title: "Required Field Missing",
          message: "Please fill in: IFSC Code",
        });
        return;
      }
    }
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

  if (loading) {
    return (
      <AppLayout title="Settings">
        <div className="flex h-[80vh] items-center justify-center">
          <div className="w-10 h-10 bg-[#024BAB] border-2 border-black animate-bounce flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const SETTING_TABS = [
    {
      group: "Company",
      items: [
        { id: "general", label: "General Info", icon: Building2 },
        { id: "bank", label: "Bank Details", icon: Landmark },
        { id: "quotation", label: "Quotation", icon: FileText },
      ],
    },
    {
      group: "Integrations",
      items: [{ id: "whatsapp", label: "WhatsApp", icon: MessageCircle }],
    },
    {
      group: "HR Config",
      items: [
        { id: "salary_mode", label: "Salary Mode", icon: CheckCircle },
        { id: "punch", label: "Punch Settings", icon: AlertCircle },
        { id: "ess", label: "Employee App", icon: Users },
      ],
    },
    {
      group: "System",
      items: [
        { id: "system", label: "System", icon: Settings2 },
        { id: "preferences", label: "Preferences", icon: LayoutDashboard },
        { id: "permissions", label: "Permissions", icon: ShieldCheck },
      ],
    },
    {
      group: "Account",
      items: [
        { id: "my_profile", label: "My Profile", icon: UserCircle },
      ],
    },
  ];

  return (
    <AppLayout title="Settings">
      <div className="max-w-6xl mx-auto">
        {}
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold text-black">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage company, HR and system configuration
          </p>
        </div>

        {}
        <div className="flex gap-0 border-2 border-black bg-white">
          {}
          <aside className="w-56 shrink-0 border-r-2 border-black bg-white flex flex-col">
            {SETTING_TABS.map((group) => (
              <div
                key={group.group}
                className="border-b-2 border-black last:border-b-0"
              >
                <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-gray-50 border-b border-black/10">
                  {group.group}
                </p>
                {group.items.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-left transition-all border-b border-black/10 last:border-b-0",
                        active
                          ? "bg-[#024BAB] text-white"
                          : "text-black hover:bg-[#F0F6FF]",
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          {}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="p-6 flex-1">
              {}
              {activeTab === "general" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField
                      label="Company Name"
                      name="companyName"
                      value={settings?.companyName || ""}
                      required
                      onChange={handleChange}
                    />
                    <InputField
                      label="Company Email"
                      name="companyEmail"
                      value={settings?.companyEmail || ""}
                      type="email"
                      onChange={handleChange}
                    />
                    <InputField
                      label="Company Phone"
                      name="companyPhone"
                      value={settings?.companyPhone || ""}
                      maxLength={10}
                      minLength={10}
                      pattern="\d{10}"
                      title="Enter a valid 10-digit phone number"
                      placeholder="10-digit phone number"
                      onChange={(e) => {
                        const v = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);
                        handleChange({
                          ...e,
                          target: {
                            ...e.target,
                            name: "companyPhone",
                            value: v,
                          },
                        });
                      }}
                    />
                    <InputField
                      label="GST Number"
                      name="companyGST"
                      value={settings?.companyGST || ""}
                      maxLength={15}
                      minLength={15}
                      pattern="\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}"
                      title="GST format: e.g. 22AAAAA0000A1Z5"
                      placeholder="e.g. 22AAAAA0000A1Z5"
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase().slice(0, 15);
                        handleChange({
                          ...e,
                          target: { ...e.target, name: "companyGST", value: v },
                        });
                      }}
                    />
                    <InputField
                      label="Website"
                      name="companyWebsite"
                      value={settings?.companyWebsite || ""}
                      type="url"
                      onChange={handleChange}
                    />
                  </div>

                  {}
                  <div className="border-t-2 border-black pt-4 mt-4">
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-3">
                      Company Logo
                    </label>
                    <div className="flex gap-4">
                      {}
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

                      {}
                      {(logoPreview || settings?.logoUrl) &&
                        !logoPreview?.startsWith("data:") && (
                          <div className="flex items-center gap-2">
                            <img
                              src={logoPreview || settings?.logoUrl}
                              alt="Logo preview"
                              className="w-24 h-24 object-contain border-2 border-black bg-white p-2"
                            />
                            <button
                              onClick={() => {
                                setLogoPreview(null);
                                setSettings((prev: any) => ({
                                  ...prev,
                                  logoUrl: "",
                                }));
                              }}
                              className="px-2 py-1 bg-[#EF4444] text-white text-xs font-bold border-2 border-black hover:bg-[#DC2626]"
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
                            className="w-24 h-24 object-contain border-2 border-black bg-white p-2"
                          />
                          <button
                            onClick={() => {
                              setLogoPreview(null);
                              setSettings((prev: any) => ({
                                ...prev,
                                logoUrl: "",
                              }));
                            }}
                            className="px-2 py-1 bg-[#EF4444] text-white text-xs font-bold border-2 border-black hover:bg-[#DC2626]"
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
                    required
                    onChange={handleChange}
                  />
                </div>
              )}

              {}
              {activeTab === "bank" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField
                      label="Bank Name"
                      name="bankName"
                      value={settings?.bankName || ""}
                      required
                      onChange={handleChange}
                    />
                    <InputField
                      label="Bank Branch"
                      name="bankBranch"
                      value={settings?.bankBranch || ""}
                      onChange={handleChange}
                    />
                    <InputField
                      label="Account Holder Name"
                      name="bankAccountName"
                      value={settings?.bankAccountName || ""}
                      required
                      onChange={handleChange}
                    />
                    <InputField
                      label="Account Number"
                      name="bankAccountNumber"
                      value={settings?.bankAccountNumber || ""}
                      required
                      minLength={9}
                      maxLength={18}
                      pattern="\d{9,18}"
                      title="Account number must be 9–18 digits"
                      placeholder="9–18 digit account number"
                      onChange={(e) => {
                        const v = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 18);
                        handleChange({
                          ...e,
                          target: {
                            ...e.target,
                            name: "bankAccountNumber",
                            value: v,
                          },
                        });
                      }}
                    />
                    <InputField
                      label="IFSC Code"
                      name="bankIFSC"
                      value={settings?.bankIFSC || ""}
                      required
                      maxLength={11}
                      minLength={11}
                      pattern="[A-Z]{4}0[A-Z0-9]{6}"
                      title="IFSC format: 4 letters + 0 + 6 alphanumeric (e.g. SBIN0001234)"
                      placeholder="e.g. SBIN0001234"
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase().slice(0, 11);
                        handleChange({
                          ...e,
                          target: { ...e.target, name: "bankIFSC", value: v },
                        });
                      }}
                    />
                  </div>
                </div>
              )}

              {}
              {activeTab === "whatsapp" && (
                <div className="space-y-6">
                  {}
                  <div className="flex items-center justify-between p-4 border-2 border-black bg-green-50">
                    <div>
                      <p className="font-black text-sm text-black">
                        Enable WhatsApp Notifications
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Send automated WhatsApp messages to employees for
                        attendance, leave, and salary events — powered by NestHR
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

                  <div className="p-4 bg-[#F0F7FF] border-2 border-[#024BAB]/30 text-xs text-gray-700 space-y-1">
                    <p className="font-black text-[#024BAB] text-sm">
                      Powered by NestHR WhatsApp Service
                    </p>
                    <p>
                      Messages are sent via NestHR's verified WhatsApp Business
                      number — no setup required on your end. Just enable the
                      notifications you need below.
                    </p>
                    <p className="text-gray-500">
                      Employee phone numbers must include country code without +
                      (e.g. 919876543210).
                    </p>
                  </div>

                  {}
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
                          <p className="font-bold text-sm text-black">
                            {label}
                          </p>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </div>
                        <button
                          onClick={() =>
                            setSettings((p: any) => ({
                              ...p,
                              [key]: !p?.[key],
                            }))
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

              {}
              {activeTab === "permissions" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
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
                        " px-6 py-3 text-sm font-bold text-white border-2 border-black flex items-center gap-2 bg-[#024BAB] hover:bg-[#01368A] active:scale-95",
                      )}
                    >
                      <Save className="w-4 h-4" />
                      Save Permissions
                    </button>
                  </div>
                </div>
              )}

              {}
              {activeTab === "quotation" && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <InputField
                      label="Quotation Title"
                      name="quotationTitle"
                      value={settings?.quotationTitle || ""}
                      onChange={handleChange}
                    />
                    <TextAreaField
                      label="Quotation Footer"
                      name="quotationFooter"
                      value={settings?.quotationFooter || ""}
                      placeholder="Footer text for quotations"
                      rows={2}
                      onChange={handleChange}
                    />
                  </div>

                  {}
                  <div className="border-t-2 border-black pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                        Terms & Conditions
                      </h3>
                      <button
                        onClick={addTerm}
                        className=" px-3 py-1.5 text-xs font-bold text-white bg-[#00C48C] border-2 border-black hover:bg-[#00B87C] transition-colors flex items-center gap-1"
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
                              className="flex-1 px-3 py-2 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 bg-white resize-none"
                            />
                            <button
                              onClick={() => removeTerm(index)}
                              className=" px-3 py-2 text-white bg-[#EF4444] border-2 border-black hover:bg-[#DC2626] transition-colors flex items-center gap-1 self-start"
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

              {}
              {activeTab === "salary_mode" && (
                <div className="space-y-5">
                  <p className="text-xs text-muted-foreground">
                    Configure how and when salaries are calculated and paid.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-black uppercase tracking-wider">
                        Salary Mode
                      </label>
                      <select
                        value={settings?.salaryMode || "monthly"}
                        onChange={(e) =>
                          setSettings((p: any) => ({
                            ...p,
                            salaryMode: e.target.value,
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="15day">15-Day Cycle</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-black uppercase tracking-wider">
                        Salary Pay Day
                      </label>
                      <select
                        value={settings?.salaryPayDay || "31"}
                        onChange={(e) =>
                          setSettings((p: any) => ({
                            ...p,
                            salaryPayDay: e.target.value,
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                      >
                        {[
                          "1",
                          "5",
                          "7",
                          "10",
                          "15",
                          "20",
                          "25",
                          "28",
                          "31",
                        ].map((d) => (
                          <option key={d} value={d}>
                            {d === "31"
                              ? "Last day of month"
                              : `${d}th of month`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="border-t-2 border-black/10 pt-4 space-y-3">
                    <p className="text-xs font-black uppercase tracking-wider text-black">
                      Overtime
                    </p>
                    {[
                      {
                        key: "otEnabled",
                        label: "Enable Overtime",
                        sub: "When off, checkout is capped at shift end — extra hours are not counted",
                      },
                    ].map(({ key, label, sub }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 border-2 border-black/10 hover:border-black transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-black">
                            {label}
                          </p>
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                        <button
                          onClick={() =>
                            setSettings((p: any) => ({
                              ...p,
                              [key]: !p?.[key],
                            }))
                          }
                          className={cn(
                            "w-12 h-6 border-2 border-black transition-colors relative",
                            settings?.[key] ? "bg-[#024BAB]" : "bg-gray-200",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 w-4 h-4 bg-white border border-black transition-all",
                              settings?.[key] ? "left-6" : "left-0.5",
                            )}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {}
              {activeTab === "punch" && (
                <div className="space-y-5">
                  <p className="text-xs text-muted-foreground">
                    Control how single and duplicate punches are handled.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-black uppercase tracking-wider">
                        Single Punch Action
                      </label>
                      <select
                        value={settings?.singlePunchAction || "half_day"}
                        onChange={(e) =>
                          setSettings((p: any) => ({
                            ...p,
                            singlePunchAction: e.target.value,
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                      >
                        <option value="half_day">Mark as Half Day</option>
                        <option value="present">Mark as Present</option>
                        <option value="absent">Mark as Absent</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-black uppercase tracking-wider">
                        Double Punch Interval (minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={settings?.doublePunchInterval || 5}
                        onChange={(e) =>
                          setSettings((p: any) => ({
                            ...p,
                            doublePunchInterval: +e.target.value,
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum gap between two punches to avoid duplicates.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {}
              {activeTab === "ess" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Control what employees can access in the self-service
                    portal.
                  </p>
                  {[
                    {
                      key: "essEnabled",
                      label: "Enable Employee Login",
                      sub: "Allow employees to log into the portal",
                    },
                    {
                      key: "essAllowPunch",
                      label: "Allow Self-Service Punch",
                      sub: "Employees can mark attendance from mobile",
                    },
                    {
                      key: "essAllowSalarySlip",
                      label: "View Salary Slip",
                      sub: "Employees can download their salary slips",
                    },
                    {
                      key: "essAllowAttendance",
                      label: "View Attendance",
                      sub: "Employees can check their attendance records",
                    },
                    {
                      key: "essAllowPayHistory",
                      label: "View Pay History",
                      sub: "Employees can see past salary payments",
                    },
                    {
                      key: "essAllowLeave",
                      label: "Apply for Leave",
                      sub: "Employees can submit leave requests",
                    },
                    {
                      key: "essAllowHoliday",
                      label: "View Holiday List",
                      sub: "Employees can see the holiday calendar",
                    },
                    {
                      key: "essAllowMissPunch",
                      label: "Report Miss Punch",
                      sub: "Employees can flag missing punch entries",
                    },
                    {
                      key: "essAllowWorkReport",
                      label: "Submit Work Report",
                      sub: "Employees can post daily work reports",
                    },
                    {
                      key: "essAllowAdvance",
                      label: "Request Advance / Payment",
                      sub: "Employees can raise advance salary requests",
                    },
                  ].map(({ key, label, sub }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 border-2 border-black/10 hover:border-black transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-black">{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                      <button
                        onClick={() =>
                          setSettings((p: any) => ({ ...p, [key]: !p?.[key] }))
                        }
                        className={cn(
                          "w-12 h-6 border-2 border-black transition-colors relative shrink-0",
                          settings?.[key] ? "bg-[#024BAB]" : "bg-gray-200",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white border border-black transition-all",
                            settings?.[key] ? "left-6" : "left-0.5",
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {}
              {activeTab === "system" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    System automation and notification configuration.
                  </p>
                  {[
                    {
                      key: "autoSalary",
                      label: "Auto Salary Processing",
                      sub: "Automatically process salaries on pay day",
                    },
                    {
                      key: "bioSync",
                      label: "Biometric Auto-Sync",
                      sub: "Automatically sync biometric device logs",
                    },
                    {
                      key: "smsEnabled",
                      label: "SMS Notifications",
                      sub: "Send SMS alerts for attendance and payroll events",
                    },
                    {
                      key: "emailNotif",
                      label: "Email Notifications",
                      sub: "Send email alerts to employees and admins",
                    },
                  ].map(({ key, label, sub }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 border-2 border-black/10 hover:border-black transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-black">{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                      <button
                        onClick={() =>
                          setSettings((p: any) => ({ ...p, [key]: !p?.[key] }))
                        }
                        className={cn(
                          "w-12 h-6 border-2 border-black transition-colors relative shrink-0",
                          settings?.[key] ? "bg-[#024BAB]" : "bg-gray-200",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white border border-black transition-all",
                            settings?.[key] ? "left-6" : "left-0.5",
                          )}
                        />
                      </button>
                    </div>
                  ))}
                  {}
                  <div className="border-t-2 border-black/10 pt-4">
                    <p className="text-xs font-black uppercase tracking-wider text-black mb-3">
                      API Key
                    </p>
                    <div className="flex items-center gap-2 border-2 border-black p-3 bg-gray-50">
                      <code className="flex-1 text-xs font-mono text-black truncate">
                        HRMS-
                        {(settings?.company || "XXXX")
                          .toString()
                          .slice(-6)
                          .toUpperCase()}
                        -KEY
                      </code>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `HRMS-${(settings?.company || "XXXX").toString().slice(-6).toUpperCase()}-KEY`,
                          )
                        }
                        className="flex items-center gap-1.5 border-2 border-black px-2 py-1 text-xs font-bold bg-white hover:bg-gray-100"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Use this key for third-party integrations.
                    </p>
                  </div>
                </div>
              )}

              {}
              {activeTab === "preferences" && (
                <div className="space-y-5">
                  <p className="text-xs text-muted-foreground">
                    UI display, regional, and code format preferences.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      {
                        key: "dashboardType",
                        label: "Dashboard Type",
                        options: ["Normal", "Advanced", "Compact"],
                      },
                      {
                        key: "timeFormat",
                        label: "Time Format",
                        options: ["12", "24"],
                      },
                      {
                        key: "currency",
                        label: "Currency",
                        options: ["INR", "USD", "EUR", "GBP", "AED"],
                      },
                      {
                        key: "state",
                        label: "State (for PT slab)",
                        options: [
                          "Maharashtra",
                          "Karnataka",
                          "Delhi",
                          "Tamil Nadu",
                          "West Bengal",
                          "Gujarat",
                          "Telangana",
                          "Andhra Pradesh",
                          "Kerala",
                          "Rajasthan",
                        ],
                      },
                    ].map(({ key, label, options }) => (
                      <div key={key} className="space-y-2">
                        <label className="block text-xs font-black text-black uppercase tracking-wider">
                          {label}
                        </label>
                        <select
                          value={settings?.[key] || options[0]}
                          onChange={(e) =>
                            setSettings((p: any) => ({
                              ...p,
                              [key]: e.target.value,
                            }))
                          }
                          className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                        >
                          {options.map((o) => (
                            <option key={o} value={o}>
                              {key === "timeFormat"
                                ? o === "12"
                                  ? "12 Hour (AM/PM)"
                                  : "24 Hour"
                                : o}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-black uppercase tracking-wider">
                        Employee Code Prefix
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. EMP, HR, 1"
                        value={settings?.empCodePrefix || ""}
                        onChange={(e) =>
                          setSettings((p: any) => ({
                            ...p,
                            empCodePrefix: e.target.value,
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-black uppercase tracking-wider">
                        Employee Code Suffix
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2026, IND"
                        value={settings?.empCodeSuffix || ""}
                        onChange={(e) =>
                          setSettings((p: any) => ({
                            ...p,
                            empCodeSuffix: e.target.value,
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                      />
                    </div>
                  </div>
                  <div className="border-t-2 border-black/10 pt-4 space-y-3">
                    {[
                      {
                        key: "showCTC",
                        label: "Show CTC to Employees",
                        sub: "Display cost-to-company figure in employee portal",
                      },
                      {
                        key: "branchwise",
                        label: "Branch-wise Reporting",
                        sub: "Filter all reports by branch/location",
                      },
                    ].map(({ key, label, sub }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 border-2 border-black/10 hover:border-black transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-black">
                            {label}
                          </p>
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                        <button
                          onClick={() =>
                            setSettings((p: any) => ({
                              ...p,
                              [key]: !p?.[key],
                            }))
                          }
                          className={cn(
                            "w-12 h-6 border-2 border-black transition-colors relative shrink-0",
                            settings?.[key] ? "bg-[#024BAB]" : "bg-gray-200",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 w-4 h-4 bg-white border border-black transition-all",
                              settings?.[key] ? "left-6" : "left-0.5",
                            )}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "my_profile" && (
                <div className="p-6 space-y-6">
                  {/* Avatar */}
                  <div className="border-2 border-black p-5 flex flex-col items-center gap-4">
                    <div className="relative group">
                      <div className="w-24 h-24 border-2 border-black bg-[#024BAB] flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
                        {user?.avatar ? (
                          <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span>{user?.name?.[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoUploading}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        {photoUploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoUploading}
                        className="flex items-center gap-1.5 bg-[#024BAB] text-white border-2 border-black px-4 py-2 text-xs font-black uppercase disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {photoUploading ? "Uploading..." : "Upload Photo"}
                      </button>
                      {user?.avatar && (
                        <button
                          onClick={handleRemovePhoto}
                          disabled={photoUploading}
                          className="flex items-center gap-1.5 bg-white text-[#EF4444] border-2 border-[#EF4444] px-4 py-2 text-xs font-black uppercase disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </div>
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </div>

                  {/* Edit Info */}
                  <div className="border-2 border-black overflow-hidden">
                    <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center gap-2">
                      <UserCircle className="w-4 h-4 text-white" />
                      <p className="text-xs font-black uppercase tracking-wider text-white">Edit Profile</p>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="block text-xs font-black uppercase mb-1.5">Display Name</label>
                        <input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                          placeholder="Your full name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase mb-1.5">Phone Number</label>
                        <input
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                          placeholder="+91 XXXXX XXXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase mb-1.5">Email</label>
                        <input
                          value={user?.email || ""}
                          disabled
                          className="w-full border-2 border-black/30 px-3 py-2.5 text-sm font-medium bg-gray-50 text-gray-400 cursor-not-allowed"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Email cannot be changed.</p>
                      </div>
                      <button
                        onClick={handleSaveProfile}
                        disabled={profileSaving}
                        className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-6 py-2.5 text-xs font-black uppercase disabled:opacity-50"
                      >
                        {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {profileSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>

                  {/* Change Password */}
                  <div className="border-2 border-black overflow-hidden">
                    <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center gap-2">
                      <Lock className="w-4 h-4 text-white" />
                      <p className="text-xs font-black uppercase tracking-wider text-white">Change Password</p>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { key: "current", label: "Current Password" },
                        { key: "next", label: "New Password" },
                        { key: "confirm", label: "Confirm New Password" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="block text-xs font-black uppercase mb-1.5">{label}</label>
                          <div className="relative">
                            <input
                              type={showPw[key as keyof typeof showPw] ? "text" : "password"}
                              value={pwForm[key as keyof typeof pwForm]}
                              onChange={(e) => setPwForm((p) => ({ ...p, [key]: e.target.value }))}
                              className="w-full border-2 border-black px-3 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPw((p) => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                            >
                              {showPw[key as keyof typeof showPw] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="sm:col-span-3">
                        <button
                          onClick={handleChangePassword}
                          disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
                          className="flex items-center gap-2 bg-[#FA731C] text-white border-2 border-black px-6 py-2.5 text-xs font-black uppercase disabled:opacity-50"
                        >
                          {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                          {pwSaving ? "Changing..." : "Change Password"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {activeTab !== "my_profile" && (
            <div className="border-t-2 border-black p-4 flex justify-end bg-gray-50/50">
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "px-6 py-2.5 text-sm font-bold text-white border-2 border-black flex items-center gap-2 transition-all",
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
            )}
          </div>
          {}
        </div>
        {}
      </div>
      <ActionModal
        show={actionModal.show}
        type={actionModal.type}
        title={actionModal.title}
        message={actionModal.message}
        onClose={() => setActionModal({ ...actionModal, show: false })}
      />
    </AppLayout>
  );
}
