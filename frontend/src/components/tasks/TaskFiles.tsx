import { useEffect, useRef, useState } from "react";
import { taskAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FileText, Film, Image as ImageIcon, Paperclip, Trash2, Download, Upload, X, Loader2 } from "lucide-react";

export interface TaskAttachment {
  _id: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "video" | "document";
  purpose: "reference" | "work";
  uploadedBy?: { _id?: string; name?: string } | string;
  uploadedAt: string;
}

export const MAX_FILE_MB = 100;
export const MAX_FILES = 10;
export const ACCEPT =
  "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

export const fmtSize = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const kindOfFile = (f: File): "image" | "video" | "document" =>
  f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "document";

/** Drag-and-drop / click picker that returns the validated File[]; used in the create/edit form. */
export function FilePicker({
  files,
  onChange,
  label = "Reference files (images, videos, documents)",
}: {
  files: File[];
  onChange: (f: File[]) => void;
  label?: string;
}) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls: Record<string, string> = {};
    files.forEach((f) => {
      if (f.type.startsWith("image/") && !f.type.includes("heic")) urls[key(f)] = URL.createObjectURL(f);
    });
    setThumbs(urls);
    return () => Object.values(urls).forEach(URL.revokeObjectURL);
  }, [files]);

  const key = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
  const add = (list: FileList | File[]) => {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_MB * 1048576) {
        toast({ title: `${f.name} is over ${MAX_FILE_MB} MB`, variant: "destructive" });
        continue;
      }
      if (next.length >= MAX_FILES) {
        toast({ title: `Up to ${MAX_FILES} files at a time`, variant: "destructive" });
        break;
      }
      if (!next.some((x) => key(x) === key(f))) next.push(f);
    }
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-black">{label}</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        className={cn(
          "border-2 border-dashed cursor-pointer px-3 py-4 text-center text-xs",
          over ? "border-[#024BAB] bg-[#024BAB]/5" : "border-black/40",
        )}
      >
        <Upload className="w-5 h-5 mx-auto mb-1 text-[#024BAB]" />
        <b>Click or drop files here</b>
        <p className="text-muted-foreground mt-0.5">
          Images, videos (MP4/MOV/WEBM), PDF, Word, Excel, PowerPoint, TXT, CSV · up to {MAX_FILES} files, {MAX_FILE_MB} MB each
        </p>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f) => {
            const k = kindOfFile(f);
            return (
              <div key={key(f)} className="flex items-center gap-2 border border-black/20 px-2 py-1.5 text-xs">
                {thumbs[key(f)] ? (
                  <img src={thumbs[key(f)]} alt="" className="w-8 h-8 object-cover border border-black/20" />
                ) : k === "video" ? (
                  <Film className="w-5 h-5 text-[#7C3AED]" />
                ) : k === "image" ? (
                  <ImageIcon className="w-5 h-5 text-[#00C48C]" />
                ) : (
                  <FileText className="w-5 h-5 text-[#024BAB]" />
                )}
                <span className="flex-1 truncate font-medium">{f.name}</span>
                <span className="text-muted-foreground shrink-0">{fmtSize(f.size)}</span>
                <button type="button" onClick={() => onChange(files.filter((x) => key(x) !== key(f)))}>
                  <X className="w-4 h-4 text-[#EF4444]" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttachmentCard({
  taskId,
  att,
  canDelete,
  onDelete,
}: {
  taskId: string;
  att: TaskAttachment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [lightbox, setLightbox] = useState(false);
  const previewable = att.kind === "image" ? !att.mime.includes("hei") : att.kind === "video";

  useEffect(() => {
    if (!previewable) return;
    let live = true;
    taskAPI.fileUrl(taskId, att._id).then((u) => live && setUrl(u)).catch(() => {});
    return () => {
      live = false;
    };
  }, [taskId, att._id, previewable]);

  const open = async (download: boolean) => {
    try {
      window.open(await taskAPI.fileUrl(taskId, att._id, download), "_blank", "noopener");
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };
  const by = typeof att.uploadedBy === "object" ? att.uploadedBy?.name : undefined;

  return (
    <div className="border-2 border-black/15 bg-white">
      {att.kind === "image" && url && (
        <img
          src={url}
          alt={att.name}
          loading="lazy"
          onClick={() => setLightbox(true)}
          className="w-full h-32 object-cover cursor-zoom-in border-b border-black/10"
        />
      )}
      {att.kind === "video" && url && (
        <video src={url} controls preload="metadata" className="w-full h-32 bg-black" />
      )}
      {!(url && previewable) && (
        <div className="h-16 flex items-center justify-center bg-[#F8FAFF] border-b border-black/10">
          {att.kind === "video" ? (
            <Film className="w-7 h-7 text-[#7C3AED]" />
          ) : att.kind === "image" ? (
            <ImageIcon className="w-7 h-7 text-[#00C48C]" />
          ) : (
            <FileText className="w-7 h-7 text-[#024BAB]" />
          )}
        </div>
      )}
      <div className="p-2 text-[11px]">
        <p className="font-bold truncate" title={att.name}>
          {att.name}
        </p>
        <p className="text-muted-foreground">
          {fmtSize(att.size)}
          {by ? ` · ${by}` : ""}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {att.kind !== "video" && att.mime !== "text/csv" && (
            <button type="button" onClick={() => open(false)} className="text-[#024BAB] font-bold">
              Open
            </button>
          )}
          <button type="button" onClick={() => open(true)} className="text-[#024BAB] font-bold flex items-center gap-0.5">
            <Download className="w-3 h-3" /> Download
          </button>
          {canDelete && (
            <button type="button" onClick={onDelete} className="ml-auto text-[#EF4444]" title="Remove">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <img src={url} alt={att.name} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}

/** Reference material + submitted work for a task, with upload for the right people. */
export function TaskFilesPanel({
  taskId,
  attachments,
  isManager,
  isAssignee,
  meId,
  onUpdated,
}: {
  taskId: string;
  attachments: TaskAttachment[];
  isManager: boolean;
  isAssignee: boolean;
  meId?: string;
  onUpdated: (task: any) => void;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [purpose, setPurpose] = useState<"reference" | "work">(isManager ? "reference" : "work");
  const canUpload = isManager || isAssignee;

  const refs = attachments.filter((a) => a.purpose === "reference");
  const work = attachments.filter((a) => a.purpose === "work");

  const upload = async () => {
    if (!pending.length) return;
    setBusy(true);
    try {
      const r = await taskAPI.addFiles(taskId, pending, purpose);
      onUpdated(r.data);
      setPending([]);
      toast({ title: purpose === "work" ? "Work uploaded" : "Files added" });
    } catch (e: any) {
      toast({ title: e.message || "Upload failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const remove = async (a: TaskAttachment) => {
    if (!window.confirm(`Remove "${a.name}"?`)) return;
    try {
      const r = await taskAPI.deleteFile(taskId, a._id);
      onUpdated(r.data);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };
  const mine = (a: TaskAttachment) =>
    isManager || (typeof a.uploadedBy === "object" ? a.uploadedBy?._id : a.uploadedBy) === meId;

  const Group = ({ title, list }: { title: string; list: TaskAttachment[] }) => (
    <div className="space-y-1.5">
      <p className="text-xs font-bold uppercase text-black flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" /> {title} ({list.length})
      </p>
      {list.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">None yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {list.map((a) => (
            <AttachmentCard key={a._id} taskId={taskId} att={a} canDelete={mine(a)} onDelete={() => remove(a)} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="border-t-2 border-black/10 pt-4 space-y-4">
      <Group title="Reference files" list={refs} />
      <Group title="Submitted work" list={work} />
      {canUpload && (
        <div className="border-2 border-black/15 p-2.5 space-y-2 bg-[#F8FAFF]">
          {isManager && (
            <div className="flex gap-2 text-xs">
              {(["reference", "work"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={cn("flex-1 border-2 px-2 py-1 font-bold", purpose === p ? "bg-[#024BAB] text-white border-black" : "bg-white border-black/20")}
                >
                  {p === "reference" ? "Add reference" : "Add as work"}
                </button>
              ))}
            </div>
          )}
          <FilePicker
            files={pending}
            onChange={setPending}
            label={isManager && purpose === "reference" ? "Add reference files" : "Upload your work / proof"}
          />
          {pending.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={upload}
              className="w-full border-2 border-black bg-[#024BAB] text-white py-1.5 text-xs font-bold disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {busy ? "Uploading…" : `Upload ${pending.length} file${pending.length > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
