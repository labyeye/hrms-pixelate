import { Fragment, useState, useEffect, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  Radio,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { biometricAPI } from "@/services/api";
import { cn } from "@/lib/utils";

interface Row {
  _id: string;
  createdAt: string;
  serialNumber?: string;
  device?: { _id: string; name: string } | null;
  event: string;
  status: "ok" | "warn" | "error";
  summary?: string;
  records?: number;
  requestData?: string;
  responseData?: string;
  deviceReturnCode?: string;
  ip?: string;
}

const EVENT_LABEL: Record<string, string> = {
  handshake: "Connected",
  attlog_push: "Punches pushed",
  biodata_push: "Face/finger data",
  command_poll: "Polled for commands",
  command_sent: "Command sent",
  command_result: "Command result",
  unknown_device: "Unknown device",
  error: "Error",
};

const STATUS_STYLE = {
  ok: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  warn: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  error: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]",
};

/** Raw conversation with the ADMS/ESSL hardware: when it fetched, pushed, what we replied, what it answered. */
export function DeviceProtocolLog({
  devices,
}: {
  devices: { _id: string; name: string }[];
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [f, setF] = useState({ deviceId: "", event: "", status: "", date: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "200" };
      Object.entries(f).forEach(([k, v]) => v && (params[k] = v));
      const r = await biometricAPI.getDeviceLogs(params);
      setRows(r.data);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [f]);

  useEffect(() => {
    load();
  }, [load]);

  const sel =
    "border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none";
  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className={sel}
          value={f.deviceId}
          onChange={(e) => setF({ ...f, deviceId: e.target.value })}
        >
          <option value="">All Devices</option>
          {devices.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className={sel}
          value={f.event}
          onChange={(e) => setF({ ...f, event: e.target.value })}
        >
          <option value="">All Events</option>
          {Object.entries(EVENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className={sel}
          value={f.status}
          onChange={(e) => setF({ ...f, status: e.target.value })}
        >
          <option value="">Any Status</option>
          <option value="ok">OK</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <input
          type="date"
          className={sel}
          value={f.date}
          onChange={(e) => setF({ ...f, date: e.target.value })}
        />
        <button
          onClick={load}
          className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 bg-white border-2 border-black">
          <Radio className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-gray-500">
            No device communication recorded yet
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Logs appear as soon as an ADMS device connects. Kept for 30 days.
          </p>
        </div>
      ) : (
        <div className="bg-white border-2 border-black overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "",
                  "Time",
                  "Device",
                  "Event",
                  "Status",
                  "What happened",
                  "Records",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-3 text-xs font-bold uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <Fragment key={r._id}>
                  <tr
                    onClick={() => setOpen(open === r._id ? null : r._id)}
                    className={cn(
                      "border-b border-gray-100 cursor-pointer hover:bg-[#024BAB]/5",
                      i % 2 && "bg-gray-50/50",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      {open === r._id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      <p className="font-medium">
                        {new Date(r.createdAt).toLocaleDateString("en-IN")}
                      </p>
                      <p className="text-gray-400">
                        {new Date(r.createdAt).toLocaleTimeString("en-IN")}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <p className="font-bold">{r.device?.name || "—"}</p>
                      <p className="text-gray-400 font-mono">
                        {r.serialNumber}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold whitespace-nowrap">
                      {EVENT_LABEL[r.event] || r.event}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 border-2",
                          STATUS_STYLE[r.status],
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{r.summary}</td>
                    <td className="px-3 py-2.5 text-xs font-bold">
                      {r.records ?? "—"}
                    </td>
                  </tr>
                  {open === r._id && (
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">
                              Device to server (request)
                            </p>
                            <pre className="text-[11px] font-mono bg-white border border-gray-200 p-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                              {r.requestData || "(empty)"}
                            </pre>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">
                              Server to device (response)
                              {r.deviceReturnCode != null &&
                                ` · device Return=${r.deviceReturnCode}`}
                            </p>
                            <pre className="text-[11px] font-mono bg-white border border-gray-200 p-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                              {r.responseData || "(empty)"}
                            </pre>
                          </div>
                        </div>
                        {r.ip && (
                          <p className="text-[10px] text-gray-400 mt-2">
                            From IP {r.ip}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
