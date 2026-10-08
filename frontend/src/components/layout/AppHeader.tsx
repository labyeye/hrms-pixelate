import { useAuth } from "@/contexts/AuthContext";
import { dashboardAPI } from "@/services/api";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Menu,
  LogIn,
  LogOut,
  Clock,
  CalendarDays,
  FileEdit,
  AlarmClock,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface AppHeaderProps {
  title: string;
  onMenuOpen: () => void;
}

type Kind = "checkin" | "checkout" | "leave" | "correction" | "late";

interface NotifEntry {
  id: string;
  kind: Kind;
  name: string;
  avatar?: string;
  status?: "pending" | "approved" | "rejected" | "cancelled";
  detail?: string;
  time: Date;
}

const FILTERS: { key: "all" | "attendance" | "requests"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attendance", label: "Check-ins" },
  { key: "requests", label: "Requests" },
];

const KIND_LINK: Record<Kind, string> = {
  checkin: "/attendance",
  checkout: "/attendance",
  leave: "/leave",
  correction: "/attendance",
  late: "/late-approvals",
};

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmt12(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function describe(n: NotifEntry): { icon: JSX.Element; text: string; color: string } {
  const st = n.status;
  const verb =
    st === "pending" ? "requested" : st === "approved" ? "approved" : st === "rejected" ? "rejected" : st ?? "";
  const color =
    st === "approved" ? "text-[#00C48C]" : st === "rejected" ? "text-red-600" : "text-[#FA731C]";
  switch (n.kind) {
    case "checkin":
      return { icon: <LogIn className="w-3 h-3 shrink-0" />, text: `Checked in at ${fmt12(n.time)}`, color: "text-[#00C48C]" };
    case "checkout":
      return { icon: <LogOut className="w-3 h-3 shrink-0" />, text: `Checked out at ${fmt12(n.time)}`, color: "text-[#FA731C]" };
    case "leave":
      return { icon: <CalendarDays className="w-3 h-3 shrink-0" />, text: `Leave ${verb} · ${n.detail}`, color };
    case "correction":
      return { icon: <FileEdit className="w-3 h-3 shrink-0" />, text: `Correction ${verb} · ${n.detail}`, color };
    default:
      return { icon: <AlarmClock className="w-3 h-3 shrink-0" />, text: `Late approval ${verb} · ${n.detail}`, color };
  }
}

export function AppHeader({ title, onMenuOpen }: AppHeaderProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState("");
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifEntry[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(false);
  const [seen, setSeen] = useState(false);
  const [filter, setFilter] = useState<"all" | "attendance" | "requests">("all");
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await dashboardAPI.getActivity();
      if (!res.success) return;
      setNotifs(
        (res.data ?? []).map((n: any) => ({ ...n, time: new Date(n.time) })),
      );
      setPending(res.pending ?? 0);
    } catch {}
    setLoading(false);
  }, []);

  // Pull once on mount so the badge reflects pending requests before opening.
  useEffect(() => {
    if (user) fetchFeed();
  }, [user, fetchFeed]);

  const handleBell = () => {
    if (!open) {
      fetchFeed();
      setSeen(true);
    }
    setOpen((v) => !v);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visible = notifs.filter((n) =>
    filter === "all"
      ? true
      : filter === "attendance"
        ? n.kind === "checkin" || n.kind === "checkout"
        : n.kind !== "checkin" && n.kind !== "checkout",
  );

  if (!user) return null;

  return (
    <header className="h-16 border-b-2 border-black bg-white flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="lg:hidden w-9 h-9 border-2 border-black bg-white flex items-center justify-center hover:bg-[#024BAB]/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-[18px] h-[18px] text-black" />
        </button>
        <h1 className="font-display font-bold text-lg sm:text-xl text-black">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2 border-2 border-black bg-white px-3 py-1.5 w-48 lg:w-52">
          <Search className="w-4 h-4 text-black shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-black placeholder:text-muted-foreground font-medium"
          />
        </div>

        {/* Bell + notification panel */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={handleBell}
            className="relative w-9 h-9 border-2 border-black bg-white flex items-center justify-center hover:bg-[#024BAB]/10 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px] text-black" />
            {(pending > 0 || !seen) && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-[#FA731C] border border-black rounded-xl text-[9px] font-bold text-white flex items-center justify-center">
                {pending > 0 ? (pending > 9 ? "9+" : pending) : ""}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-11 w-80 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-[#024BAB]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-white" />
                  <span className="text-sm font-bold text-white">
                    Notifications
                  </span>
                </div>
                <span className="text-xs text-white/70 font-medium">
                  {new Date().toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>

              {/* Filters */}
              <div className="flex border-b-2 border-black">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`flex-1 py-2 text-[11px] font-bold transition-colors ${filter === f.key ? "bg-black text-white" : "bg-white text-black hover:bg-[#024BAB]/10"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="max-h-80 overflow-y-auto">
                {loading && notifs.length === 0 ? (
                  <div className="flex items-center justify-center py-10 gap-2">
                    <div className="w-4 h-4 border-2 border-[#024BAB] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground font-medium">
                      Loading...
                    </span>
                  </div>
                ) : visible.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Bell className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-xs font-bold text-muted-foreground">
                      No activity
                    </p>
                  </div>
                ) : (
                  visible.map((n) => {
                    const d = describe(n);
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          setOpen(false);
                          navigate(KIND_LINK[n.kind]);
                        }}
                        className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-black/10 last:border-0 hover:bg-[#024BAB]/5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full border-2 border-black shrink-0 overflow-hidden bg-[#024BAB] flex items-center justify-center text-xs font-bold text-white">
                          {n.avatar ? (
                            <img src={n.avatar} alt={n.name} className="w-full h-full object-cover" />
                          ) : (
                            n.name[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-black truncate">{n.name}</p>
                          <div className={`flex items-center gap-1 mt-0.5 ${d.color}`}>
                            {d.icon}
                            <span className="text-[11px] font-semibold capitalize truncate">{d.text}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                          {timeAgo(n.time)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="border-t-2 border-black px-4 py-2.5 bg-[#F8FAFF] flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground font-medium">
                  {pending} pending request{pending === 1 ? "" : "s"}
                </span>
                <button
                  onClick={fetchFeed}
                  className="text-[11px] font-bold text-[#024BAB] hover:underline"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-2 border-black bg-[#024BAB] px-2 sm:px-3 py-1.5">
          <div className="w-6 h-6 border-2 border-black shrink-0 overflow-hidden bg-[#FA731C] flex items-center justify-center text-[10px] font-bold text-white rounded-full">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              (user.name?.[0]?.toUpperCase() ?? "U")
            )}
          </div>
          <span className="hidden sm:block text-sm font-bold text-white max-w-[100px] truncate">
            {user.name}
          </span>
        </div>
      </div>
    </header>
  );
}
