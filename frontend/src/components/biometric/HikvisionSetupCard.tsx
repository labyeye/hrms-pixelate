import { useState } from "react";
import { Copy, Loader2, RefreshCw, KeyRound } from "lucide-react";
import { biometricAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";

interface Setup {
  host: string;
  port: number;
  url: string;
}

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

      <div className="border-2 border-black p-5">
        <h3 className="font-bold text-sm mb-3">Steps on the device</h3>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm">
          <li>Connect the device to WiFi/LAN and open <span className="font-mono">https://&lt;device-ip&gt;</span> in a browser; log in as admin.</li>
          <li>Network → Network Settings: set DNS to <span className="font-mono">8.8.8.8</span>.</li>
          <li>Network → Device Access → ISUP Listening: paste the three values above and Save.</li>
          <li>Person Management: add each person with an Employee ID that exactly matches their HRMS Employee ID, and enrol their face.</li>
          <li>Ask someone to punch; check the Attendance page.</li>
        </ol>
      </div>
    </div>
  );
}
