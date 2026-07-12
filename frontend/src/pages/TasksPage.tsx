import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { taskAPI, employeeAPI } from "@/services/api";
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
  ListChecks,
  Clock,
  Loader2,
  CheckCircle2,
  Search,
  X,
  Calendar,
  MessageSquare,
  ChevronRight,
  Flag,
  Trash2,
  Pencil,
  History,
  GripVertical,
  User2,
  Clock3,
  LayoutGrid,
  Table as TableIcon,
  List as ListIcon,
  CalendarRange,
  AlertTriangle,
} from "lucide-react";

const ASSIGN_ROLES = ["super_admin", "hr_manager", "hr_executive", "department_head"];

const COLUMNS = [
  { key: "pending", label: "Pending", accent: "#FA731C", icon: Clock },
  { key: "in_progress", label: "In Progress", accent: "#024BAB", icon: Loader2 },
  { key: "completed", label: "Completed", accent: "#00C48C", icon: CheckCircle2 },
] as const;

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  medium: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  high: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]",
};

interface Task {
  _id: string;
  title: string;
  description: string;
  assignedTo: { _id: string; name: string; email: string };
  assignedBy: { _id: string; name: string; email: string };
  priority: string;
  status: string;
  dueDate?: string;
  createdAt: string;
  late?: boolean;
  comments?: Array<{ user?: { name: string }; message: string; createdAt: string }>;
  statusHistory?: Array<{ status: string; changedBy?: { name: string }; changedAt: string }>;
}

interface EmployeeOption {
  user: string;
  firstName: string;
  lastName: string;
}

function isLate(task: Task) {
  return (
    task.late ||
    (task.status !== "completed" &&
      !!task.dueDate &&
      new Date(task.dueDate).getTime() < Date.now())
  );
}

type ViewMode = "kanban" | "table" | "list" | "timeline";

const VIEWS: { key: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { key: "kanban", label: "Kanban", icon: LayoutGrid },
  { key: "table", label: "Table", icon: TableIcon },
  { key: "list", label: "List", icon: ListIcon },
  { key: "timeline", label: "Timeline", icon: CalendarRange },
];

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canAssign = ASSIGN_ROLES.includes(user?.role || "");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [comment, setComment] = useState("");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const viewStorageKey = `nesthr_tasks_view_${user?.id || "guest"}`;
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(viewStorageKey) as ViewMode) || "kanban",
  );

  const changeView = (v: ViewMode) => {
    setViewMode(v);
    localStorage.setItem(viewStorageKey, v);
  };

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "medium",
    dueDate: "",
  });

  const fetchTasks = async () => {
    try {
      const res = await taskAPI.getAll();
      setTasks(res.data);
    } catch {
      toast({ title: "Failed to load tasks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    if (canAssign) {
      employeeAPI
        .getAll({ limit: "500" })
        .then((res) => setEmployees(res.data || res.data?.employees || []))
        .catch(() => {});
    }
  }, []);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, search, priorityFilter]);

  const grouped = useMemo(() => {
    const g: Record<string, Task[]> = { pending: [], in_progress: [], completed: [] };
    for (const t of filtered) g[t.status]?.push(t);
    return g;
  }, [filtered]);

  const resetForm = () =>
    setForm({ title: "", description: "", assignedTo: "", priority: "medium", dueDate: "" });

  const openCreate = () => {
    setEditingTask(null);
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      assignedTo: task.assignedTo?._id || "",
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    });
    setSelected(null);
    setCreateOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.assignedTo) {
      toast({ title: "Title and assignee are required", variant: "destructive" });
      return;
    }
    if (!editingTask) {
      const ok = await confirm({
        title: "Assign this task?",
        description: "The assignee will be notified.",
      });
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      if (editingTask) {
        await taskAPI.update(editingTask._id, form);
        toast({ title: "Task updated" });
      } else {
        await taskAPI.create(form);
        toast({ title: "Task assigned" });
      }
      resetForm();
      setEditingTask(null);
      setCreateOpen(false);
      fetchTasks();
    } catch (err: any) {
      toast({ title: err.message || "Failed to save task", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (task: Task, status: string) => {
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status } : t)));
    if (selected?._id === task._id) setSelected({ ...selected, status });
    try {
      await taskAPI.updateStatus(task._id, status);
    } catch (err: any) {
      toast({ title: err.message || "Failed to update status", variant: "destructive" });
      fetchTasks();
    }
  };

  const handleDelete = async (task: Task) => {
    const ok = await confirm({
      title: "Delete this task?",
      description: "This will move it to Trash. You can restore it later if needed.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await taskAPI.delete(task._id);
      setSelected(null);
      toast({ title: "Task deleted" });
      fetchTasks();
    } catch (err: any) {
      toast({ title: err.message || "Failed to delete task", variant: "destructive" });
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !selected) return;
    try {
      const res = await taskAPI.addComment(selected._id, comment);
      setSelected({ ...selected, comments: res.data.comments });
      setComment("");
      fetchTasks();
    } catch (err: any) {
      toast({ title: err.message || "Failed to add comment", variant: "destructive" });
    }
  };

  const statusCounts = {
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };
  const lateCount = tasks.filter(isLate).length;

  const timelineGroups = useMemo(() => {
    const withDate = filtered.filter((t) => t.dueDate);
    const withoutDate = filtered.filter((t) => !t.dueDate);
    withDate.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    const groups: { label: string; tasks: Task[] }[] = [];
    for (const t of withDate) {
      const label = formatDate(t.dueDate!);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.tasks.push(t);
      else groups.push({ label, tasks: [t] });
    }
    if (withoutDate.length) groups.push({ label: "No due date", tasks: withoutDate });
    return groups;
  }, [filtered]);

  return (
    <AppLayout title="Tasks">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">Tasks</h1>
        {canAssign && (
          <button
            onClick={openCreate}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
          >
            <Plus className="w-4 h-4" /> Assign Task
          </button>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {COLUMNS.map((c) => (
          <div
            key={c.key}
            className="border-2 border-black bg-white p-4 flex items-center gap-3"
          >
            <div
              className="w-10 h-10 border-2 flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${c.accent}1A`, borderColor: c.accent }}
            >
              <c.icon className="w-5 h-5" style={{ color: c.accent }} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {c.label}
              </p>
              <p className="text-2xl font-bold text-black">
                {statusCounts[c.key as keyof typeof statusCounts]}
              </p>
            </div>
          </div>
        ))}
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#EF4444]/10 border-2 border-[#EF4444] flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5 text-[#EF4444]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Late
            </p>
            <p className="text-2xl font-bold text-[#EF4444]">{lateCount}</p>
          </div>
        </div>
      </div>

      {/* View tabs + toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 border-2 border-black bg-white p-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => changeView(v.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold border-2 transition-colors",
                viewMode === v.key
                  ? "bg-black text-white border-black"
                  : "bg-white text-black border-transparent hover:border-black/20",
              )}
            >
              <v.icon className="w-3.5 h-3.5" />
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-48 ml-auto">
          <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-1.5 flex-1 min-w-40">
            <Search className="w-4 h-4 shrink-0" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-full font-medium"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border-2 border-black bg-white px-3 py-1.5 text-sm font-semibold outline-none"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          {(search || priorityFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setPriorityFilter("");
              }}
              className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-1.5 hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Views */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground font-medium">
          Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <ListChecks className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No tasks yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {canAssign ? "Assign your first task to get started" : "You have no tasks assigned"}
          </p>
        </div>
      ) : viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className="border-2 border-black bg-[#F8FAFF] flex flex-col">
              <div
                className="border-b-2 border-black px-3 py-2.5 flex items-center justify-between shrink-0"
                style={{ backgroundColor: `${col.accent}14` }}
              >
                <span className="font-bold text-sm flex items-center gap-2" style={{ color: col.accent }}>
                  <col.icon className="w-4 h-4" />
                  {col.label}
                </span>
                <span
                  className="text-xs font-bold border-2 px-1.5 py-0.5 bg-white"
                  style={{ borderColor: col.accent, color: col.accent }}
                >
                  {grouped[col.key].length}
                </span>
              </div>
              <div className="p-2 space-y-2.5 min-h-[200px] max-h-[65vh] overflow-y-auto">
                {grouped[col.key].length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 font-medium">
                    No tasks
                  </p>
                ) : (
                  grouped[col.key].map((task) => {
                    const late = isLate(task);
                    const pcol = COLUMNS.find((c) => c.key === task.status);
                    return (
                      <div
                        key={task._id}
                        onClick={() => setSelected(task)}
                        className={cn(
                          "bg-white border-2 border-black p-3 cursor-pointer hover:shadow-[3px_3px_0_#000] transition-shadow",
                          late && "border-[#EF4444]",
                        )}
                      >
                        {/* Top row: drag handle + icon + title */}
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-black/20 mt-1 shrink-0" />
                          <div
                            className="w-7 h-7 border-2 border-black flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${pcol?.accent}1A` }}
                          >
                            <Flag className="w-3.5 h-3.5" style={{ color: pcol?.accent }} />
                          </div>
                          <p className="font-bold text-sm text-black leading-snug line-clamp-2 flex-1">
                            {task.title}
                          </p>
                        </div>

                        {/* Meta row: assignee + due date */}
                        <div className="flex items-center gap-3 mt-2 ml-9 text-[11px] text-muted-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <User2 className="w-3 h-3" />
                            {task.assignedTo?.name?.split(" ")[0] || "Unassigned"}
                          </span>
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock3 className="w-3 h-3" />
                              {formatDate(task.dueDate)}
                            </span>
                          )}
                          {!!task.comments?.length && (
                            <span className="flex items-center gap-1 ml-auto">
                              <MessageSquare className="w-3 h-3" />
                              {task.comments.length}
                            </span>
                          )}
                        </div>

                        {/* Pill tags: priority + overdue */}
                        <div className="flex items-center gap-1.5 mt-2.5 ml-9 flex-wrap">
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full capitalize",
                              PRIORITY_STYLE[task.priority],
                            )}
                          >
                            {task.priority}
                          </span>
                          {late && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#EF4444] text-white flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> Late
                            </span>
                          )}
                        </div>

                        {/* Quick move */}
                        <div className="flex gap-1 mt-2.5 pt-2 border-t border-black/10 ml-9">
                          {COLUMNS.filter((c) => c.key !== task.status).map((c) => (
                            <button
                              key={c.key}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(task, c.key);
                              }}
                              className="text-[10px] font-bold px-1.5 py-1 border border-black/20 hover:border-black hover:bg-gray-50 transition-colors flex items-center gap-0.5"
                            >
                              <ChevronRight className="w-2.5 h-2.5" />
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "table" ? (
        <div className="border-2 border-black bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b-2 border-black bg-[#F8FAFF]">
                <th className="text-left px-3 py-2 font-bold uppercase text-xs">Title</th>
                <th className="text-left px-3 py-2 font-bold uppercase text-xs">Assignee</th>
                <th className="text-left px-3 py-2 font-bold uppercase text-xs">Priority</th>
                <th className="text-left px-3 py-2 font-bold uppercase text-xs">Status</th>
                <th className="text-left px-3 py-2 font-bold uppercase text-xs">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => {
                const late = isLate(task);
                const scol = COLUMNS.find((c) => c.key === task.status);
                return (
                  <tr
                    key={task._id}
                    onClick={() => setSelected(task)}
                    className="border-b border-black/10 last:border-0 cursor-pointer hover:bg-[#F8FAFF] transition-colors"
                  >
                    <td className="px-3 py-2.5 font-bold text-black">{task.title}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{task.assignedTo?.name}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full capitalize",
                          PRIORITY_STYLE[task.priority],
                        )}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 border-2"
                        style={{ borderColor: scol?.accent, color: scol?.accent }}
                      >
                        {scol?.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {task.dueDate ? (
                        <span
                          className={cn(
                            "font-medium flex items-center gap-1",
                            late ? "text-[#EF4444] font-bold" : "text-muted-foreground",
                          )}
                        >
                          {late && <AlertTriangle className="w-3 h-3" />}
                          {formatDate(task.dueDate)}
                          {late && " · Late"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : viewMode === "list" ? (
        <div className="border-2 border-black bg-white divide-y divide-black/10">
          {filtered.map((task) => {
            const late = isLate(task);
            const scol = COLUMNS.find((c) => c.key === task.status);
            return (
              <div
                key={task._id}
                onClick={() => setSelected(task)}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#F8FAFF] transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: scol?.accent }}
                />
                <p className="font-bold text-sm text-black flex-1 truncate">{task.title}</p>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {task.assignedTo?.name}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full capitalize shrink-0",
                    PRIORITY_STYLE[task.priority],
                  )}
                >
                  {task.priority}
                </span>
                {task.dueDate && (
                  <span
                    className={cn(
                      "text-xs font-medium shrink-0 flex items-center gap-1",
                      late ? "text-[#EF4444] font-bold" : "text-muted-foreground",
                    )}
                  >
                    {late && <AlertTriangle className="w-3 h-3" />}
                    {formatDate(task.dueDate)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {timelineGroups.map((group) => (
            <div key={group.label} className="border-2 border-black bg-white">
              <div className="border-b-2 border-black bg-[#F8FAFF] px-3 py-2 flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-[#024BAB]" />
                <span className="font-bold text-sm text-black">{group.label}</span>
                <span className="text-xs text-muted-foreground font-medium">
                  ({group.tasks.length})
                </span>
              </div>
              <div className="divide-y divide-black/10">
                {group.tasks.map((task) => {
                  const late = isLate(task);
                  const scol = COLUMNS.find((c) => c.key === task.status);
                  return (
                    <div
                      key={task._id}
                      onClick={() => setSelected(task)}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#F8FAFF] transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: scol?.accent }}
                      />
                      <p className="font-bold text-sm text-black flex-1 truncate">{task.title}</p>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {task.assignedTo?.name}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full capitalize shrink-0",
                          PRIORITY_STYLE[task.priority],
                        )}
                      >
                        {task.priority}
                      </span>
                      {late && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#EF4444] text-white flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-2.5 h-2.5" /> Late
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) {
            resetForm();
            setEditingTask(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingTask ? "Edit Task" : "Assign a Task"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-black">
                Title *
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={200}
                className="w-full border-2 border-black px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-black">
                Assign To *
              </label>
              <select
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.user} value={emp.user}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-black">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none capitalize"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-black">
                  Due Date
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full border-2 border-black px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-black">
                Description
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={2000}
                className="w-full border-2 border-black px-3 py-2 text-sm outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
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
                {submitting
                  ? editingTask
                    ? "Saving..."
                    : "Assigning..."
                  : editingTask
                    ? "Save Changes"
                    : "Assign Task"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="font-display">{selected.title}</DialogTitle>
                  {canAssign && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(selected)}
                        className="text-[#024BAB] hover:bg-blue-50 p-1.5 border-2 border-transparent hover:border-[#024BAB] transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(selected)}
                        className="text-[#EF4444] hover:bg-red-50 p-1.5 border-2 border-transparent hover:border-[#EF4444] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase px-2 py-1 border capitalize",
                      PRIORITY_STYLE[selected.priority],
                    )}
                  >
                    {selected.priority} priority
                  </span>
                  {selected.dueDate && (
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Due {formatDate(selected.dueDate)}
                    </span>
                  )}
                </div>

                <p className="text-sm whitespace-pre-wrap text-black">
                  {selected.description || "No description provided."}
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="border-2 border-black/10 p-2">
                    <p className="text-muted-foreground font-bold uppercase tracking-wide text-[10px]">
                      Assigned To
                    </p>
                    <p className="font-bold text-black mt-0.5">{selected.assignedTo?.name}</p>
                  </div>
                  <div className="border-2 border-black/10 p-2">
                    <p className="text-muted-foreground font-bold uppercase tracking-wide text-[10px]">
                      Assigned By
                    </p>
                    <p className="font-bold text-black mt-0.5">{selected.assignedBy?.name}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-black">
                    Status
                  </label>
                  <div className="flex gap-2 mt-1.5">
                    {COLUMNS.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => handleStatusChange(selected, c.key)}
                        className={cn(
                          "flex-1 text-xs font-bold px-2 py-2 border-2 transition-colors flex items-center justify-center gap-1",
                          selected.status === c.key
                            ? "text-white border-black"
                            : "bg-white text-black border-black/20 hover:border-black",
                        )}
                        style={selected.status === c.key ? { backgroundColor: c.accent } : {}}
                      >
                        <c.icon className="w-3.5 h-3.5" />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!!selected.statusHistory?.length && (
                  <div className="border-t-2 border-black/10 pt-4 space-y-2">
                    <p className="text-xs font-bold uppercase text-black flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" /> Status History
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1.5">
                      {[...selected.statusHistory].reverse().map((h, i) => {
                        const col = COLUMNS.find((c) => c.key === h.status);
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: col?.accent }}
                            />
                            <span className="font-bold text-black">{col?.label || h.status}</span>
                            <span className="text-muted-foreground">
                              by {h.changedBy?.name || "System"}
                            </span>
                            <span className="text-muted-foreground ml-auto shrink-0">
                              {formatDate(h.changedAt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="border-t-2 border-black/10 pt-4 space-y-2">
                  <p className="text-xs font-bold uppercase text-black">Comments</p>
                  <div className="max-h-40 overflow-y-auto space-y-2.5 p-2 bg-[#F8FAFF] border border-black/5">
                    {selected.comments?.length ? (
                      selected.comments.map((c, i) => (
                        <div key={i} className="text-xs border-b border-black/5 pb-2 last:border-0 last:pb-0">
                          <p className="font-bold text-black">{c.user?.name || "User"}</p>
                          <p className="text-muted-foreground mt-0.5">{c.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic">No comments yet.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      placeholder="Add a comment..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="flex-1 border-2 border-black px-2.5 py-1.5 text-xs outline-none"
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    />
                    <button
                      onClick={handleAddComment}
                      className="border-2 border-black bg-[#024BAB] text-white px-3 py-1.5 text-xs font-bold hover:bg-[#01368A] transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
