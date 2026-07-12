import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { announcementAPI, departmentAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Megaphone,
  Trash2,
  CheckCircle2,
  Pin,
  Search,
  X,
  AlertTriangle,
  CalendarClock,
  ShieldCheck,
  Eye,
} from "lucide-react";

const ADMIN_ROLES = ["super_admin", "hr_manager", "hr_executive"];

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "policy", label: "Policy" },
  { value: "urgent", label: "Urgent" },
  { value: "event", label: "Event" },
  { value: "holiday", label: "Holiday" },
  { value: "hr", label: "HR" },
];

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  medium: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
  high: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  critical: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]",
};

type UserRef = string | { _id: string; name: string; email: string };

interface Announcement {
  _id: string;
  title: string;
  content: string;
  date: string;
  active: boolean;
  readBy: UserRef[];
  postedBy?: { name: string; email: string };
  category: string;
  priority: string;
  pinned: boolean;
  expiryDate?: string | null;
  targetAudience: string;
  departments?: Array<{ _id: string; name: string }>;
  roles?: string[];
  acknowledgementRequired: boolean;
  acknowledgedBy: UserRef[];
  audienceCount?: number;
}

function refId(ref: UserRef) {
  return typeof ref === "string" ? ref : ref._id;
}

function includesUser(list: UserRef[] | undefined, userId?: string) {
  return !!list?.some((r) => refId(r) === userId);
}

interface DeptOption {
  _id: string;
  name: string;
}

const ROLE_OPTIONS = ["hr_manager", "hr_executive", "department_head", "employee"];

const EMPTY_FORM = {
  title: "",
  content: "",
  category: "general",
  priority: "medium",
  pinned: false,
  expiryDate: "",
  targetAudience: "all",
  departments: [] as string[],
  roles: [] as string[],
  acknowledgementRequired: false,
};

function isExpired(a: Announcement) {
  return a.expiryDate ? new Date(a.expiryDate).getTime() < Date.now() : false;
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const isAdmin = ADMIN_ROLES.includes(user?.role || "");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchAnnouncements = async () => {
    try {
      const res = await announcementAPI.getAll();
      setAnnouncements(res.data);
    } catch {
      toast({ title: "Failed to load announcements", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    if (isAdmin) {
      departmentAPI
        .getAll()
        .then((res) => setDepartments(res.data || []))
        .catch(() => {});
    }
  }, []);

  const filtered = useMemo(() => {
    return announcements.filter((a) => {
      if (categoryFilter && a.category !== categoryFilter) return false;
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [announcements, search, categoryFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Title and content are required", variant: "destructive" });
      return;
    }
    const ok = await confirm({
      title: "Post this announcement?",
      description: "It will be sent to the selected audience.",
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      await announcementAPI.create(form);
      toast({ title: "Announcement posted" });
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      fetchAnnouncements();
    } catch (err: any) {
      toast({ title: err.message || "Failed to post announcement", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await announcementAPI.markRead(id);
      fetchAnnouncements();
    } catch {
      /* silent */
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await announcementAPI.acknowledge(id);
      toast({ title: "Acknowledged" });
      fetchAnnouncements();
    } catch (err: any) {
      toast({ title: err.message || "Failed to acknowledge", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this announcement?",
      description: "This will move it to Trash. You can restore it later if needed.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await announcementAPI.delete(id);
      toast({ title: "Announcement deleted" });
      fetchAnnouncements();
    } catch (err: any) {
      toast({ title: err.message || "Failed to delete", variant: "destructive" });
    }
  };

  const unreadCount = announcements.filter((a) => !includesUser(a.readBy, user?.id)).length;
  const pinnedCount = announcements.filter((a) => a.pinned).length;
  const ackPendingCount = announcements.filter(
    (a) => a.acknowledgementRequired && !includesUser(a.acknowledgedBy, user?.id),
  ).length;
  const [viewersOf, setViewersOf] = useState<Announcement | null>(null);

  return (
    <AppLayout title="Announcements">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">Announcements</h1>
        {isAdmin && (
          <button
            onClick={() => setCreateOpen(true)}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
          >
            <Plus className="w-4 h-4" /> New Announcement
          </button>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Unread</p>
            <p className="text-2xl font-bold text-black">{unreadCount}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FA731C]/10 border-2 border-[#FA731C] flex items-center justify-center shrink-0">
            <Pin className="w-5 h-5 text-[#FA731C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pinned</p>
            <p className="text-2xl font-bold text-black">{pinnedCount}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#EF4444]/10 border-2 border-[#EF4444] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#EF4444]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Acknowledgement Pending
            </p>
            <p className="text-2xl font-bold text-black">{ackPendingCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {(search || categoryFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
            }}
            className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-2 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground font-medium">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Megaphone className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const isRead = includesUser(a.readBy, user?.id);
            const acked = includesUser(a.acknowledgedBy, user?.id);
            const expired = isExpired(a);
            return (
              <div
                key={a._id}
                className={cn(
                  "border-2 border-black bg-white p-4",
                  a.pinned && "border-l-[6px] border-l-[#FA731C]",
                  expired && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {a.pinned && <Pin className="w-3.5 h-3.5 text-[#FA731C]" />}
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 border capitalize",
                          PRIORITY_STYLE[a.priority],
                        )}
                      >
                        {a.priority}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 border border-black/20 bg-muted capitalize">
                        {a.category}
                      </span>
                      {a.acknowledgementRequired && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 border border-[#EF4444] text-[#EF4444] bg-[#EF4444]/10 flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> Ack required
                        </span>
                      )}
                      {expired && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 border border-black/20 bg-gray-100 text-gray-500">
                          Expired
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-black">{a.title}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                      {a.content}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2.5 flex-wrap">
                      {a.postedBy && <span>By {a.postedBy.name}</span>}
                      <span>{formatDate(a.date)}</span>
                      {a.expiryDate && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" /> Expires {formatDate(a.expiryDate)}
                        </span>
                      )}
                      {a.targetAudience !== "all" && (
                        <span className="capitalize">
                          Audience:{" "}
                          {a.targetAudience === "department"
                            ? a.departments?.map((d) => d.name).join(", ") || "Department"
                            : a.roles?.join(", ")}
                        </span>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setViewersOf(a)}
                        className="mt-2.5 text-xs font-bold border-2 border-black/20 hover:border-black px-2 py-1 flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Seen by {a.readBy?.length || 0}
                        {a.audienceCount ? ` of ${a.audienceCount}` : ""}
                        {a.acknowledgementRequired &&
                          ` · Acknowledged ${a.acknowledgedBy?.length || 0}`}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(a._id)}
                        className="text-[#EF4444] hover:bg-red-50 p-1.5 border-2 border-transparent hover:border-[#EF4444] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {isRead ? (
                      <span className="text-xs text-[#00C48C] font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Read
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkRead(a._id)}
                        className="border-2 border-black bg-white text-black px-2.5 py-1 text-xs font-bold hover:bg-gray-50 transition-colors"
                      >
                        Mark as read
                      </button>
                    )}
                    {a.acknowledgementRequired &&
                      (acked ? (
                        <span className="text-xs text-[#024BAB] font-bold flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" /> Acknowledged
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAcknowledge(a._id)}
                          className="border-2 border-black bg-[#EF4444] text-white px-2.5 py-1 text-xs font-bold hover:bg-[#D63333] transition-colors"
                        >
                          Acknowledge
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Post an Announcement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-black">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border-2 border-black px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-black">Content *</label>
              <textarea
                rows={5}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full border-2 border-black px-3 py-2 text-sm outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-black">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-black">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none capitalize"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-black">Target Audience</label>
              <select
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value, departments: [], roles: [] })}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              >
                <option value="all">Everyone</option>
                <option value="department">Specific Departments</option>
                <option value="role">Specific Roles</option>
              </select>
            </div>
            {form.targetAudience === "department" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-black">Departments</label>
                <select
                  multiple
                  value={form.departments}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      departments: Array.from(e.target.selectedOptions).map((o) => o.value),
                    })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none h-24"
                >
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.targetAudience === "role" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-black">Roles</label>
                <select
                  multiple
                  value={form.roles}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      roles: Array.from(e.target.selectedOptions).map((o) => o.value),
                    })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none h-24"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r} className="capitalize">
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-black">
                Expiry Date (optional)
              </label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                className="w-full border-2 border-black px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                  className="w-4 h-4"
                />
                Pin to top
              </label>
              <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acknowledgementRequired}
                  onChange={(e) => setForm({ ...form, acknowledgementRequired: e.target.checked })}
                  className="w-4 h-4"
                />
                Require acknowledgement
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="border-2 border-black bg-white text-black px-4 py-2 text-sm font-bold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold hover:bg-[#01368A] transition-colors disabled:opacity-60"
              >
                {submitting ? "Posting..." : "Post"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Viewers dialog */}
      <Dialog open={!!viewersOf} onOpenChange={(open) => !open && setViewersOf(null)}>
        <DialogContent className="max-w-sm">
          {viewersOf && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{viewersOf.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-black mb-2">
                    Seen by ({viewersOf.readBy?.length || 0}
                    {viewersOf.audienceCount ? ` of ${viewersOf.audienceCount}` : ""})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-[#F8FAFF] border border-black/5">
                    {viewersOf.readBy?.length ? (
                      viewersOf.readBy.map((r) => (
                        <p key={refId(r)} className="text-xs font-medium text-black">
                          {typeof r === "string" ? r : `${r.name} — ${r.email}`}
                        </p>
                      ))
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic">No one yet.</p>
                    )}
                  </div>
                </div>
                {viewersOf.acknowledgementRequired && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-black mb-2">
                      Acknowledged ({viewersOf.acknowledgedBy?.length || 0})
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-[#F8FAFF] border border-black/5">
                      {viewersOf.acknowledgedBy?.length ? (
                        viewersOf.acknowledgedBy.map((r) => (
                          <p key={refId(r)} className="text-xs font-medium text-black">
                            {typeof r === "string" ? r : `${r.name} — ${r.email}`}
                          </p>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">No one yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
