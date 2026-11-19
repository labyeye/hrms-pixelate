import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

export default function LiveTrackingPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [waiting, setWaiting] = useState<any[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [search, setSearch] = useState("");

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

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [load]);

  const filtered = logs.filter((item) => {
    if (!search.trim()) return true;
    const name = `${item.employee?.firstName || ""} ${item.employee?.lastName || ""}`.toLowerCase();
    const code = (item.employee?.employeeId || "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  return (
    <AppLayout title="Live Field Tracking">
      <div className="space-y-6">
        {/* Banner */}
        <div className="border-2 border-black bg-[#EFF6FF] p-4 flex items-center gap-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <ShieldAlert className="w-5 h-5 text-[#024BAB] shrink-0" />
          <p className="text-xs font-medium text-[#1E40AF]">
            <span className="font-bold">Duty-Hour Protected:</span> Live tracking is only recorded between Punch-In and Punch-Out. Staff off-duty are never tracked.
          </p>
        </div>

        {!enabled && (
          <div className="border-2 border-black bg-[#FEF3C7] p-4 flex items-center justify-between gap-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-medium text-black">
              <span className="font-bold">Live tracking is OFF</span> for your company, so no location is being recorded.
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

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search field staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border-2 border-black bg-white text-xs font-medium focus:outline-none focus:ring-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                setRefreshing(true);
                load();
              }}
              disabled={refreshing}
              className="flex items-center gap-2 border-2 border-black bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Loading field positions...
            </p>
          </div>
        ) : filtered.length === 0 && waiting.length === 0 ? (
          <div className="border-2 border-black bg-white p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Navigation className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">
              No field staff currently active
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Employees with live tracking enabled will show here once they check in on the mobile app.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((item) => {
              const emp = item.employee;
              const loc = item.lastLocation;
              const fullName = emp ? `${emp.firstName} ${emp.lastName}` : "Field Employee";
              const timeStr = loc?.updatedAt
                ? new Date(loc.updatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Recently";

              const mapsUrl = loc?.latitude && loc?.longitude
                ? `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`
                : null;

              return (
                <div
                  key={item._id}
                  className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 border-2 border-black bg-[#EFF6FF] flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <Navigation className="w-5 h-5 text-[#024BAB]" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-black">{fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {emp?.designation || "Staff"} {emp?.employeeId ? `· ${emp.employeeId}` : ""}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-[#86EFAC] bg-[#DCFCE7] text-[10px] font-bold uppercase tracking-wider text-[#166534] rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                        On Duty
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y-2 border-gray-100 mb-4 text-center">
                      <div>
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                          <Clock className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Ping</span>
                        </div>
                        <p className="text-xs font-bold text-black">{timeStr}</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                          <MapPin className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Distance</span>
                        </div>
                        <p className="text-xs font-bold text-black">{item.totalDistanceKm || 0} km</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                          <Battery className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Battery</span>
                        </div>
                        <p className="text-xs font-bold text-black">
                          {loc?.battery != null ? `${loc.battery}%` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 border-2 border-black bg-[#024BAB] text-white py-2.5 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View on Google Maps
                    </a>
                  ) : (
                    <div className="text-center py-2 text-xs text-muted-foreground italic">
                      Waiting for GPS coordinates...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && waiting.length > 0 && (
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2">No location received today ({waiting.length})</h3>
            <p className="text-xs text-muted-foreground mb-3">Not checked in yet, app not opened, or location permission off.</p>
            <div className="flex flex-wrap gap-2">
              {waiting.filter((e) => !search.trim() || `${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase().includes(search.toLowerCase())).map((e) => (
                <span key={e._id} className="border border-black px-2 py-1 text-xs font-medium">{e.firstName} {e.lastName} · {e.employeeId}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
