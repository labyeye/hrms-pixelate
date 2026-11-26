import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { trackingAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  Navigation,
  RefreshCw,
  Clock,
  Battery,
  MapPin,
  ExternalLink,
  ShieldAlert,
  Search,
  Gauge,
  X,
} from "lucide-react";

const POLL_MS = 15_000;
const LIVE_MS = 2 * 60_000; // updated in the last 2 min = live
const STALE_MS = 15 * 60_000; // older than 15 min = signal lost

type Freshness = "live" | "recent" | "lost";

function freshness(updatedAt?: string): Freshness {
  if (!updatedAt) return "lost";
  const age = Date.now() - new Date(updatedAt).getTime();
  if (age <= LIVE_MS) return "live";
  if (age <= STALE_MS) return "recent";
  return "lost";
}

const COLORS: Record<Freshness, string> = {
  live: "#16A34A",
  recent: "#F59E0B",
  lost: "#9CA3AF",
};
const LABELS: Record<Freshness, string> = {
  live: "Live",
  recent: "Delayed",
  lost: "Signal lost",
};

function ago(updatedAt?: string) {
  if (!updatedAt) return "—";
  const s = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(emp: any) {
  return `${emp?.firstName?.[0] || ""}${emp?.lastName?.[0] || ""}`.toUpperCase() || "?";
}

function pinIcon(emp: any, f: Freshness, selected: boolean) {
  const size = selected ? 40 : 32;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${COLORS[f]};border:${
      selected ? 3 : 2
    }px solid #0A0A0A;color:#fff;font:700 ${selected ? 13 : 11}px system-ui;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.35)">${initials(
      emp,
    )}</div>`,
  });
}

const startIcon = L.divIcon({
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #024BAB"></div>`,
});

/** Fits the map to all staff once, then to the selected route when one is picked. */
function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  const done = useRef("");
  useEffect(() => {
    if (!points.length || done.current === fitKey) return;
    done.current = fitKey;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
  }, [points, fitKey, map]);
  return null;
}

export default function LiveTrackingPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [waiting, setWaiting] = useState<any[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await trackingAPI.getLive();
      setLogs(res.data || []);
      setWaiting((res as any).waiting || []);
      setEnabled((res as any).enabled !== false);
    } catch (err: any) {
      toast({
        title: "Failed to load live tracking",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  const loadRoute = useCallback(async (employeeId: string) => {
    try {
      const res: any = await trackingAPI.getHistory(employeeId);
      const pts: [number, number][] = (res?.data?.pings || [])
        .filter((p: any) => p.latitude != null && p.longitude != null)
        .map((p: any) => [p.latitude, p.longitude]);
      setRoute(pts);
    } catch {
      setRoute([]);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    // re-render the "x s ago" labels and colours between polls
    const clock = setInterval(() => setTick((t) => t + 1), 5_000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
  }, [load]);

  // Keep the selected person's trail growing as new points arrive.
  useEffect(() => {
    if (!selectedId) {
      setRoute([]);
      return;
    }
    loadRoute(selectedId);
  }, [selectedId, logs, loadRoute]);

  const located = useMemo(
    () => logs.filter((l) => l.lastLocation?.latitude != null && l.lastLocation?.longitude != null),
    [logs],
  );

  const filtered = located.filter((item) => {
    if (!search.trim()) return true;
    const name = `${item.employee?.firstName || ""} ${item.employee?.lastName || ""}`.toLowerCase();
    const code = (item.employee?.employeeId || "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  const sorted = [...filtered].sort(
    (a, b) =>
      new Date(b.lastLocation?.updatedAt || 0).getTime() -
      new Date(a.lastLocation?.updatedAt || 0).getTime(),
  );

  const selected = located.find((l) => String(l.employee?._id) === selectedId);
  const liveCount = located.filter((l) => freshness(l.lastLocation?.updatedAt) === "live").length;

  const fitPoints: [number, number][] = selected
    ? route.length
      ? route
      : [[selected.lastLocation.latitude, selected.lastLocation.longitude]]
    : located.map((l) => [l.lastLocation.latitude, l.lastLocation.longitude]);
  const fitKey = selected ? `sel:${selectedId}:${route.length ? "route" : "pt"}` : `all:${located.length > 0}`;

  return (
    <AppLayout title="Live Field Tracking">
      <div className="space-y-4">
        <div className="border-2 border-black bg-[#EFF6FF] p-4 flex items-center gap-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <ShieldAlert className="w-5 h-5 text-[#024BAB] shrink-0" />
          <p className="text-xs font-medium text-[#1E40AF]">
            <span className="font-bold">Duty-Hour Protected:</span> Location is shared only between Check-In and
            Check-Out, even if the app is closed. Staff off-duty are never tracked.
          </p>
        </div>

        {!enabled && (
          <div className="border-2 border-black bg-[#FEF3C7] p-4 flex items-center justify-between gap-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-medium text-black">
              <span className="font-bold">Live tracking is OFF</span> for your company, so no location is being
              recorded.
            </p>
            <button
              onClick={async () => {
                try {
                  await trackingAPI.updateSettings({ enabled: true });
                  load();
                } catch (err: any) {
                  toast({ title: "Could not turn on", description: err.message, variant: "destructive" });
                }
              }}
              className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider shrink-0"
            >
              Turn on
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" /> {liveCount} live
            </span>
            <span className="text-muted-foreground">{located.length} on duty today</span>
            <span className="text-muted-foreground">Updates every {POLL_MS / 1000}s</span>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              load();
            }}
            disabled={refreshing}
            className="flex items-center gap-2 border-2 border-black bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Loading field positions...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
            {/* Staff list */}
            <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col lg:h-[620px]">
              <div className="p-3 border-b-2 border-black relative">
                <Search className="absolute left-6 top-[22px] h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search field staff..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border-2 border-black bg-white text-xs font-medium focus:outline-none"
                />
              </div>
              <div className="overflow-y-auto flex-1 max-h-[420px] lg:max-h-none">
                {sorted.length === 0 ? (
                  <div className="p-8 text-center">
                    <Navigation className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase">No one on duty yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Staff appear here once they check in on the mobile app.
                    </p>
                  </div>
                ) : (
                  sorted.map((item) => {
                    const emp = item.employee;
                    const loc = item.lastLocation;
                    const f = freshness(loc?.updatedAt);
                    const id = String(emp?._id);
                    const active = id === selectedId;
                    return (
                      <button
                        key={item._id}
                        onClick={() => setSelectedId(active ? null : id)}
                        className={`w-full text-left px-3 py-3 border-b border-gray-200 flex items-center gap-3 hover:bg-[#F8FAFC] ${
                          active ? "bg-[#EFF6FF]" : ""
                        }`}
                      >
                        <span
                          className="w-9 h-9 rounded-full border-2 border-black text-white text-xs font-bold flex items-center justify-center shrink-0"
                          style={{ background: COLORS[f] }}
                        >
                          {initials(emp)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold truncate">
                            {emp ? `${emp.firstName} ${emp.lastName}` : "Field Employee"}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            <span style={{ color: COLORS[f] }} className="font-bold">
                              {LABELS[f]}
                            </span>{" "}
                            · {ago(loc?.updatedAt)} · {item.totalDistanceKm || 0} km
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
                {waiting.length > 0 && (
                  <div className="p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      No location today ({waiting.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {waiting
                        .filter(
                          (e) =>
                            !search.trim() ||
                            `${e.firstName} ${e.lastName} ${e.employeeId}`
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                        )
                        .map((e) => (
                          <span key={e._id} className="border border-gray-300 px-2 py-0.5 text-[11px]">
                            {e.firstName} {e.lastName}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Map */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative h-[480px] lg:h-[620px]">
              <MapContainer
                center={[20.5937, 78.9629]}
                zoom={5}
                scrollWheelZoom
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                <FitBounds points={fitPoints} fitKey={fitKey} />
                {selected && route.length > 1 && (
                  <>
                    <Polyline positions={route} pathOptions={{ color: "#024BAB", weight: 5, opacity: 0.85 }} />
                    <Marker position={route[0]} icon={startIcon}>
                      <Tooltip>Start of duty</Tooltip>
                    </Marker>
                  </>
                )}
                {located.map((item) => {
                  const id = String(item.employee?._id);
                  const f = freshness(item.lastLocation?.updatedAt);
                  const isSel = id === selectedId;
                  return (
                    <Marker
                      key={item._id}
                      position={[item.lastLocation.latitude, item.lastLocation.longitude]}
                      icon={pinIcon(item.employee, f, isSel)}
                      zIndexOffset={isSel ? 1000 : 0}
                      eventHandlers={{ click: () => setSelectedId(isSel ? null : id) }}
                    >
                      <Tooltip direction="top" offset={[0, -16]}>
                        <b>
                          {item.employee?.firstName} {item.employee?.lastName}
                        </b>{" "}
                        · {ago(item.lastLocation?.updatedAt)}
                      </Tooltip>
                    </Marker>
                  );
                })}
              </MapContainer>

              {selected && (
                <div className="absolute top-3 right-3 z-[1000] w-72 border-2 border-black bg-white p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-bold">
                        {selected.employee?.firstName} {selected.employee?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selected.employee?.designation || "Staff"}
                        {selected.employee?.phone ? ` · ${selected.employee.phone}` : ""}
                      </p>
                    </div>
                    <button onClick={() => setSelectedId(null)} aria-label="Close">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> {ago(selected.lastLocation?.updatedAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {selected.totalDistanceKm || 0} km today
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" />
                      {selected.lastLocation?.speed != null
                        ? `${Math.round(selected.lastLocation.speed * 3.6)} km/h`
                        : "—"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Battery className="w-3.5 h-3.5" />
                      {selected.lastLocation?.battery != null ? `${selected.lastLocation.battery}%` : "—"}
                    </span>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selected.lastLocation.latitude},${selected.lastLocation.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 border-2 border-black bg-[#024BAB] text-white py-2 text-xs font-bold uppercase tracking-wider"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in Google Maps
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
