import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { trashAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDate } from "@/lib/utils";
import { Trash2, RotateCcw, XCircle } from "lucide-react";

interface TrashItem {
  _id: string;
  modelName: "Leave" | "Task" | "Announcement" | "EmployeeDocument";
  data: Record<string, any>;
  deletedByName?: string;
  createdAt: string;
}

const TYPE_LABEL: Record<TrashItem["modelName"], string> = {
  Leave: "Leave Request",
  Task: "Task",
  Announcement: "Announcement",
  EmployeeDocument: "Document",
};

function displayLabel(item: TrashItem) {
  const d = item.data;
  return d.title || d.subject || d.name || d.leaveType || "(untitled)";
}

export default function TrashPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    trashAPI
      .getAll()
      .then((res: any) => setItems(res.data))
      .catch((err: any) =>
        toast({ title: "Error", description: err.message, variant: "destructive" }),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRestore = async (item: TrashItem) => {
    const ok = await confirm({
      title: "Restore item?",
      description: `"${displayLabel(item)}" will be restored to ${TYPE_LABEL[item.modelName]}.`,
    });
    if (!ok) return;
    try {
      await trashAPI.restore(item._id);
      toast({ title: "Restored", description: "Item restored successfully." });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handlePurge = async (item: TrashItem) => {
    const ok = await confirm({
      title: "Permanently delete?",
      description: `"${displayLabel(item)}" will be deleted forever. This cannot be undone.`,
      confirmText: "Delete forever",
      destructive: true,
    });
    if (!ok) return;
    try {
      await trashAPI.purge(item._id);
      toast({ title: "Deleted", description: "Item permanently deleted." });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Trash</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Deleted tasks, announcements, documents, and leave requests land here.
          Restore them or delete them forever.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Trash is empty.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {items.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
                      {TYPE_LABEL[item.modelName]}
                    </span>
                    <span className="font-medium truncate">{displayLabel(item)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deleted {formatDate(item.createdAt)}
                    {item.deletedByName ? ` by ${item.deletedByName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(item)}
                    className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border hover:bg-accent"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </button>
                  <button
                    onClick={() => handlePurge(item)}
                    className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-destructive text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Delete forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
