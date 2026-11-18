import { useEffect, useState } from "react";
import { Copy, Loader2, RefreshCw, KeyRound } from "lucide-react";
import { biometricAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";

interface Setup {
  host: string;
  port: number;
  url: string;
}

const STEPS: { title: string; lines: string[] }[] = [
  {
    title: "Generate the device address (above)",
    lines: [
      "Click “Generate device setup”. The three values are private to this company — do not share them.",
      "Keep this page open; you will copy each value into the device.",
    ],
  },
  {
    title: "Connect the device to the network",
    lines: [
      "Power on the Hikvision terminal and connect it to WiFi or an Ethernet cable on the same network as your computer.",
      "On the device screen go to Comm. → Wi-Fi / Wired Network and note its IP address (e.g. 192.168.1.32).",
      "Tip: reserve this IP for the device in your router so it never changes.",
    ],
  },
  {
    title: "Open the device web page",
    lines: [
      "On a computer on the same network open https://<device-ip> (use https; accept the browser warning).",
      "Log in as admin with the password set when the device was activated.",
    ],
  },
  {
    title: "Set DNS so the device can find our server",
    lines: [
      "Configuration → Network → Network Settings.",
      "Set DNS server to 8.8.8.8 and Save.",
      "Also check System → Time Settings: correct timezone, NTP on. Punch times depend on it.",
    ],
  },
  {
    title: "Paste the three values",
    lines: [
      "Configuration → Network → Device Access → ISUP tab → scroll to “ISUP Listening”.",
      "ISUP Alarm Center IP/Domain Name = the host shown above (no http://).",
      "ISUP Alarm Center URL = the URL shown above, exactly as copied.",
      "ISUP Alarm Center Port = the port shown above. Click Save.",
      "Leave the ISUP section above it (Server IP 0.0.0.0, Device ID, Key) untouched.",
    ],
  },
  {
    title: "Add people on the device",
    lines: [
      "Person Management → Add.",
      "Employee ID MUST be exactly the same as the employee's ID in this HRMS, otherwise the punch is ignored.",
      "Enrol the face (and/or fingerprint/card).",
    ],
  },
  {
    title: "Test it",
    lines: [
      "Ask an enrolled person to punch their face.",
      "Open the Attendance page — first punch of the day is check-in, a later punch is check-out.",
      "Nothing showing? Check: Employee ID matches, device DNS set, device time correct, token not regenerated since you pasted it.",
    ],
  },
];

function Field({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  return (
    <div className="flex items-center justify-between gap-3 border-2 border-black px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-gray-500">{label}</p>
        <p className="font-mono text-sm break-all">{value}</p>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast({ title: "Copied" });
        }}
        className="shrink-0 p-2 border-2 border-black hover:bg-gray-50"
        aria-label={`Copy ${label}`}
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
}

function AgentCard() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [a, setA] = useState<{ server: string; token: string; online: boolean; lastSeen: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (regenerate = false) => {
    setBusy(true);
    try {
      setA((await biometricAPI.getHikvisionAgentSetup(regenerate)).data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setBusy(false);
  };

  const regen = async () => {
    if (await confirm({ title: "Regenerate agent token?", description: "The running agent stops working until you restart it with the new token." })) load(true);
  };

  const cmd = a
    ? `HRMS_TOKEN=${a.token} DEVICE_HOST=<device-ip> DEVICE_USER=admin DEVICE_PASS=<device-password> node agent.js`
    : "";

  return (
    <div className="border-2 border-black p-5">
      <h2 className="font-display font-bold text-base mb-1">Site agent (recommended)</h2>
      <p className="text-sm text-gray-600 mb-4">
        Lets NestHR add employees and face photos on the terminal even when it sits on your office
        network. Run one small program on any always-on computer in the same network as the
        terminal. It only connects out to NestHR: no VPN, no port forwarding.
      </p>
      {!a ? (
        <button onClick={() => load(false)} disabled={busy} className="px-4 py-2 bg-[#024BAB] text-white font-bold border-2 border-black disabled:opacity-50">
          Show agent setup
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-bold">
            Status:{" "}
            <span className={a.online ? "text-green-700" : "text-red-600"}>
              {a.online ? "Agent online" : "Agent not running"}
            </span>
            {a.lastSeen && <span className="font-normal text-gray-500"> (last seen {new Date(a.lastSeen).toLocaleString()})</span>}
          </p>
          <Field label="Agent token (private)" value={a.token} />
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
            <li>Install Node.js 18+ on that computer (nodejs.org).</li>
            <li>
              Download <a className="underline" href={`${a.server}/api/attendance/hikvision-agent-files/agent.js`}>agent.js</a> and{" "}
              <a className="underline" href={`${a.server}/api/attendance/hikvision-agent-files/isapi.js`}>isapi.js</a> into one folder.
            </li>
            <li>In that folder run the command below (replace the device IP and password).</li>
            <li>Status above turns green within a minute. Then click "Sync all employees now" or add employees as usual.</li>
          </ol>
          <Field label="Run command (Mac/Linux; on Windows set the same names as environment variables)" value={cmd} />
          <button onClick={regen} disabled={busy} className="flex items-center gap-2 text-sm font-bold text-red-600">
            <RefreshCw className="w-4 h-4" /> Regenerate agent token
          </button>
        </div>
      )}
    </div>
  );
}

function DeviceForm() {
  const { toast } = useToast();
  const [f, setF] = useState({ host: "", port: "80", https: false, username: "admin", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    biometricAPI
      .getHikvisionDevice()
      .then((r: any) => {
        const d = r.data;
        if (d?.host) setF((p) => ({ ...p, host: d.host, port: String(d.port), https: d.https, username: d.username }));
      })
      .catch(() => {});
  }, []);

  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fn();
      setMsg(r.message || `Synced ${r.synced}/${r.total} employees${r.failed?.length ? ". Errors: " + r.failed.join("; ") : ""}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setBusy(false);
  };

  const inp = "border-2 border-black px-3 py-2 text-sm w-full";
  return (
    <div className="border-2 border-black p-5">
      <h2 className="font-display font-bold text-base mb-1">Direct push (only if the server can reach the device)</h2>
      <p className="text-sm text-gray-600 mb-4">
        Optional. Enter the device's IP and admin login so new employees (and face photos you
        upload) are sent to the terminal automatically. The server must be able to reach this IP.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input className={inp} placeholder="Device IP (e.g. 192.168.1.32)" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} />
        <input className={inp} placeholder="Port" value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} />
        <input className={inp} placeholder="Username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
        <input className={inp} type="password" placeholder="Password (leave blank to keep saved)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={f.https} onChange={(e) => setF({ ...f, https: e.target.checked })} /> Device uses HTTPS
      </label>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => run(() => biometricAPI.saveHikvisionDevice(f))} className="px-4 py-2 bg-[#024BAB] text-white font-bold border-2 border-black disabled:opacity-50">
          Save &amp; test connection
        </button>
        <button disabled={busy} onClick={() => run(() => biometricAPI.syncHikvisionUsers())} className="px-4 py-2 font-bold border-2 border-black disabled:opacity-50">
          Sync all employees now
        </button>
      </div>
      {msg && <p className="text-sm mt-3">{msg}</p>}
    </div>
  );
}

export function HikvisionSetupCard() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (regenerate = false) => {
    setLoading(true);
    try {
      const res = await biometricAPI.getHikvisionSetup(regenerate);
      setSetup(res.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const regenerate = async () => {
    const ok = await confirm({
      title: "Regenerate token?",
      description:
        "The old URL stops working immediately. You must update it on every Hikvision device.",
    });
    if (ok) load(true);
  };

  return (
    <div className="space-y-6">
      <div className="border-2 border-black p-5">
        <h2 className="font-display font-bold text-base mb-1">
          Hikvision face / fingerprint terminal
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Click the button to create this company's private device address.
          Punches from the device will mark attendance automatically.
        </p>

        {!setup ? (
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#024BAB] text-white font-bold border-2 border-black disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            Generate device setup
          </button>
        ) : (
          <div className="space-y-3">
            <Field label="ISUP Alarm Center IP/Domain Name" value={setup.host} />
            <Field label="ISUP Alarm Center URL" value={setup.url} />
            <Field label="ISUP Alarm Center Port" value={String(setup.port)} />
            <button
              onClick={regenerate}
              disabled={loading}
              className="flex items-center gap-2 text-sm font-bold text-red-600"
            >
              <RefreshCw className="w-4 h-4" /> Regenerate token
            </button>
          </div>
        )}
      </div>

      <AgentCard />

      <DeviceForm />

      {STEPS.map((st, i) => (
        <div key={i} className="border-2 border-black p-5">
          <h3 className="font-display font-bold text-base mb-2 flex items-center gap-2">
            <span className="w-6 h-6 bg-black text-white text-xs font-bold flex items-center justify-center">
              {i + 1}
            </span>
            {st.title}
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            {st.lines.map((l, j) => (
              <li key={j}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
