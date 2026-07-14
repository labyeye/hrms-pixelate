import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { employeeAPI } from "@/services/api";
import { documentAPI } from "@/services/api";
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  X,
  Search,
  FileText,
  File,
  IdCard,
  Award,
  FileSignature,
  Briefcase,
  Mail,
  ChevronDown,
  Pencil,
  FileCheck2,
  FileX2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { ImageCropModal } from "@/components/documents/ImageCropModal";
import { compressImageToLimit } from "@/lib/compressImage";
import {
  AadharIcon,
  PanIcon,
  DrivingLicenseIcon,
} from "@/components/documents/docIcons";
import { EmployeeCombobox } from "@/components/employees/EmployeeCombobox";

const MAX_DOC_BYTES = 5 * 1024 * 1024;

const DOC_TYPES = [
  { value: "aadhar", label: "Aadhar", icon: AadharIcon, bg: "bg-white" },
  { value: "pan", label: "PAN", icon: PanIcon, bg: "bg-white" },
  {
    value: "driving_license",
    label: "Driving License",
    icon: DrivingLicenseIcon,
    bg: "bg-white",
  },
  { value: "id_proof", label: "ID Proof", icon: IdCard, bg: "bg-[#A855F7]" },
  {
    value: "certificate",
    label: "Certificate",
    icon: Award,
    bg: "bg-[#FFD60A]",
    iconColor: "text-black",
  },
  {
    value: "contract",
    label: "Contract",
    icon: FileSignature,
    bg: "bg-[#EF4444]",
  },
  { value: "resume", label: "Resume", icon: Briefcase, bg: "bg-[#024BAB]" },
  {
    value: "offer_letter",
    label: "Offer Letter",
    icon: Mail,
    bg: "bg-[#FA731C]",
  },
  { value: "other", label: "Other", icon: File, bg: "bg-black" },
];

const DOC_TYPE_MAP: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.value, d.label]),
);

function StatCard({
  title,
  value,
  icon: Icon,
  bg,
  iconColor = "text-white",
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  bg: string;
  iconColor?: string;
}) {
  return (
    <div className="border-2 p-4 flex flex-col gap-3 bg-white">
      <div
        className={cn(
          "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
          bg,
        )}
      >
        <Icon className={cn("w-5 h-5", iconColor)} />
      </div>
      <div>
        <p className="font-display font-bold text-3xl text-black">{value}</p>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-0.5 truncate">
          {title}
        </p>
      </div>
    </div>
  );
}

function DocTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {DOC_TYPES.map((t) => {
        const Icon = t.icon;
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              "flex flex-col items-center gap-1.5 border-2 border-black px-2 py-2.5 text-center transition-colors",
              active
                ? "bg-[#024BAB] text-white"
                : "bg-white hover:bg-[#024BAB]/5",
            )}
          >
            <div
              className={cn(
                "w-8 h-8 border-2 border-black flex items-center justify-center shrink-0",
                active ? "bg-white" : t.bg,
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4",
                  active ? "text-[#024BAB]" : t.iconColor || "text-white",
                )}
              />
            </div>
            <span className="text-[10px] font-bold leading-tight">
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentVaultPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const isEmployee = user?.role === "employee";
  const canManage = user?.role === "super_admin" || user?.role === "hr_manager";
  const [docs, setDocs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editDoc, setEditDoc] = useState<any | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    name: DOC_TYPE_MAP.id_proof,
    docType: "id_proof",
  });
  const [fileObj, setFileObj] = useState<File | Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [allDocs, setAllDocs] = useState<any[]>([]);

  const load = async (empId?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (empId) params.employeeId = empId;
      else if (selectedEmployee) params.employeeId = selectedEmployee;
      const res = await documentAPI.getAll(params);
      if (res.success) setDocs(res.data);
    } catch {}
    setLoading(false);
  };

  const loadAllDocs = async () => {
    try {
      const res = await documentAPI.getAll({});
      if (res.success) setAllDocs(res.data);
    } catch {}
  };

  useEffect(() => {
    load();
    if (!isEmployee) {
      employeeAPI
        .getAll({ status: "active" })
        .then((r) => {
          if (r.success) setEmployees(r.data);
        })
        .catch(() => {});
      loadAllDocs();
    }
  }, []);

  const handleEmployeeChange = (id: string) => {
    setSelectedEmployee(id);
    load(id);
  };

  const readAsDataURL = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const acceptFinalFile = async (
    blob: Blob,
    mimeType: string,
    baseName: string,
  ) => {
    let out = blob;
    if (mimeType.startsWith("image/") && out.size > MAX_DOC_BYTES) {
      out = await compressImageToLimit(out, mimeType);
    }
    if (out.size > MAX_DOC_BYTES) {
      toast({
        title: "File too large",
        description: "Documents must be 5MB or smaller.",
        variant: "destructive",
      });
      return;
    }
    setFileObj(out);
    if (!form.name) setForm((prev) => ({ ...prev, name: baseName }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const baseName = f.name.replace(/\.[^.]+$/, "");
    if (f.type.startsWith("image/")) {
      setCropFile(f);
    } else {
      acceptFinalFile(f, f.type, baseName);
    }
  };

  const handleUpload = async () => {
    if (!fileObj || !form.name || !form.docType) return;
    if (!isEmployee && !form.employeeId) return;

    const ok = await confirm({
      title: "Upload document?",
      description: "This will add the document to the vault.",
    });
    if (!ok) return;

    setUploading(true);
    try {
      const fileData = await readAsDataURL(fileObj);
      await documentAPI.upload({
        employeeId: form.employeeId || undefined,
        name: form.name,
        docType: form.docType,
        mimeType: fileObj.type,
        fileData,
      });
      setUploadModal(false);
      setForm({
        employeeId: "",
        name: DOC_TYPE_MAP.id_proof,
        docType: "id_proof",
      });
      setFileObj(null);
      load(form.employeeId || undefined);
      loadAllDocs();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Upload failed",
        variant: "destructive",
      });
    }
    setUploading(false);
  };

  const handleEditSave = async () => {
    if (!editDoc) return;
    try {
      const body: { name?: string; docType?: string; fileData?: string } = {
        name: editDoc.name,
        docType: editDoc.docType,
      };
      if (fileObj) body.fileData = await readAsDataURL(fileObj);
      await documentAPI.update(editDoc._id, body);
      setEditDoc(null);
      setFileObj(null);
      load(selectedEmployee || undefined);
      loadAllDocs();
      toast({ title: "Document updated" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Update failed",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const res = await documentAPI.download(doc._id);
      if (!res.success) throw new Error("Download failed");
      const { fileData, mimeType, name } = res.data;
      const byteChars = atob(fileData);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++)
        byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Download failed",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this document?",
      description: "This will move it to Trash, you can restore it later.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await documentAPI.delete(id);
      setDocs((prev) => prev.filter((d) => d._id !== id));
      loadAllDocs();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const displayed = docs.filter((d) => {
    if (filterType && d.docType !== filterType) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const employeesWithDocIds = new Set(
    allDocs.map((d) => d.employee?._id).filter(Boolean),
  );
  const employeesWithDocs = employees.filter((e) =>
    employeesWithDocIds.has(e._id),
  ).length;
  const employeesMissingDocs = employees.length - employeesWithDocs;
  const perTypeCounts = DOC_TYPES.map((t) => ({
    ...t,
    count: new Set(
      allDocs
        .filter((d) => d.docType === t.value)
        .map((d) => d.employee?._id)
        .filter(Boolean),
    ).size,
  }));

  return (
    <AppLayout title="Document Vault">
      {!isEmployee && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard
            title="Docs Uploaded"
            value={employeesWithDocs}
            icon={FileCheck2}
            bg="bg-[#00C48C]"
          />
          <StatCard
            title="Missing Docs"
            value={employeesMissingDocs}
            icon={FileX2}
            bg="bg-red-500"
          />
          {perTypeCounts.map((t) => (
            <StatCard
              key={t.value}
              title={t.label}
              value={t.count}
              icon={t.icon}
              bg={t.bg}
              iconColor={t.iconColor}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2 flex-1">
          {!isEmployee && (
            <div className="relative">
              <select
                value={selectedEmployee}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white pr-8 appearance-none"
              >
                <option value="">All Employees</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white pr-8 appearance-none"
            >
              <option value="">All Types</option>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 min-w-48">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-full font-medium"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {!isEmployee && (
          <button
            onClick={() => setUploadModal(true)}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
          >
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#024BAB] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No documents found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {!isEmployee
              ? "Upload documents for employees"
              : "No documents uploaded yet"}
          </p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Document Name",
                  "Type",
                  !isEmployee ? "Employee" : null,
                  "Size",
                  "Uploaded",
                  "",
                ]
                  .filter(Boolean)
                  .map((h) => (
                    <th
                      key={h as string}
                      className="px-4 py-3 text-xs font-bold text-black uppercase tracking-wider text-left"
                    >
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((doc) => {
                const TypeIcon =
                  DOC_TYPES.find((t) => t.value === doc.docType)?.icon || File;
                return (
                  <tr
                    key={doc._id}
                    className="border-b border-black/10 hover:bg-[#024BAB]/5"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-[#024BAB] shrink-0" />
                        <span className="font-semibold text-black">
                          {doc.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="border-2 border-[#024BAB] text-[#024BAB] text-[10px] font-bold px-2 py-0.5">
                        {DOC_TYPE_MAP[doc.docType] || doc.docType}
                      </span>
                    </td>
                    {!isEmployee && (
                      <td className="px-4 py-3 font-medium text-black text-xs">
                        {doc.employee?.firstName} {doc.employee?.lastName}
                        <p className="text-[10px] text-muted-foreground">
                          {doc.employee?.employeeId}
                        </p>
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatBytes(doc.sizeBytes)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canManage ? (
                          <>
                            <button
                              onClick={() => handleDownload(doc)}
                              className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors"
                            >
                              <Download className="w-3 h-3" /> Download
                            </button>
                            <button
                              onClick={() => {
                                setFileObj(null);
                                setEditDoc({ ...doc });
                              }}
                              className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(doc._id)}
                              className="flex items-center gap-1 text-xs font-bold border-2 border-red-500 text-red-500 px-2 py-1 hover:bg-red-500 hover:text-white transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Admin / HR Manager only
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {uploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">
                Upload Document
              </h3>
              <button
                onClick={() => {
                  setUploadModal(false);
                  setFileObj(null);
                  setForm({
                    employeeId: "",
                    name: DOC_TYPE_MAP.id_proof,
                    docType: "id_proof",
                  });
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                  Employee *
                </label>
                <EmployeeCombobox
                  employees={employees}
                  value={form.employeeId}
                  onChange={(id) => setForm((p) => ({ ...p, employeeId: id }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                  Document Type *
                </label>
                <DocTypePicker
                  value={form.docType}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      docType: v,
                      name: v === "other" ? "" : DOC_TYPE_MAP[v],
                    }))
                  }
                />
              </div>
              {form.docType === "other" && (
                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                    Document Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g. Salary Slip"
                    className="border-2 border-black px-3 py-2 text-sm font-medium outline-none w-full"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                  File * (max 5 MB, PDF/JPG/PNG)
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed border-black w-full py-4 text-sm font-semibold flex flex-col items-center gap-1 hover:bg-[#024BAB]/5 transition-colors",
                    fileObj
                      ? "border-[#00C48C] text-[#00C48C]"
                      : "text-muted-foreground",
                  )}
                >
                  <Upload className="w-5 h-5" />
                  {fileObj ? "File selected" : "Click to select file"}
                  {fileObj && (
                    <span className="text-[10px]">
                      {formatBytes(fileObj.size)}
                    </span>
                  )}
                </button>
              </div>
              <button
                onClick={handleUpload}
                disabled={
                  uploading || !fileObj || !form.name || !form.employeeId
                }
                className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold w-full disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onCropped={(blob) => {
            const baseName = cropFile.name.replace(/\.[^.]+$/, "");
            acceptFinalFile(blob, cropFile.type, baseName);
            setCropFile(null);
          }}
        />
      )}

      {editDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">Edit Document</h3>
              <button
                onClick={() => {
                  setEditDoc(null);
                  setFileObj(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                  Document Type
                </label>
                <DocTypePicker
                  value={editDoc.docType}
                  onChange={(v) =>
                    setEditDoc((p: any) => ({ ...p, docType: v }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                  Document Name
                </label>
                <input
                  type="text"
                  value={editDoc.name}
                  onChange={(e) =>
                    setEditDoc((p: any) => ({ ...p, name: e.target.value }))
                  }
                  className="border-2 border-black px-3 py-2 text-sm font-medium outline-none w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                  Replace File (optional, max 5 MB)
                </label>
                <input
                  ref={editFileRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <button
                  onClick={() => editFileRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed border-black w-full py-4 text-sm font-semibold flex flex-col items-center gap-1 hover:bg-[#024BAB]/5 transition-colors",
                    fileObj
                      ? "border-[#00C48C] text-[#00C48C]"
                      : "text-muted-foreground",
                  )}
                >
                  <Upload className="w-5 h-5" />
                  {fileObj ? "New file selected" : "Click to replace file"}
                </button>
              </div>
              <button
                onClick={handleEditSave}
                className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold w-full"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
