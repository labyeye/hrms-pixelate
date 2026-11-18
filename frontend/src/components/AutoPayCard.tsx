import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { autopayAPI, creditsAPI } from "@/services/api";
import { authorizeMandate } from "@/lib/cashfree";
import { useToast } from "@/hooks/use-toast";

// Auto-pay: one UPI AutoPay / eNACH mandate pays the yearly renewal and WhatsApp credit auto-refills.
// Hidden until the backend turns AUTOPAY_ENABLED on.
export default function AutoPayCard({ showRefill = true }: { showRefill?: boolean }) {
  const { toast } = useToast();
  const [s, setS] = useState<any>(null);
  const [packs, setPacks] = useState<any[]>([]);
  const [gstPct, setGstPct] = useState(18);
  const [renew, setRenew] = useState(true);
  const [refill, setRefill] = useState(false);
  const [threshold, setThreshold] = useState("100");
  const [packId, setPackId] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = useCallback((d: any) => {
    setS(d);
    setRenew(d.exists ? d.renew : true);
    setRefill(!!d.refill?.enabled);
    setThreshold(String(d.refill?.thresholdCredits ?? 100));
    setPackId(d.refill?.packId || "");
  }, []);

  useEffect(() => {
    autopayAPI.get().then((r) => r.success && apply(r.data)).catch(() => {});
    creditsAPI
      .packs()
      .then((r) => {
        if (!r.success) return;
        setPacks(r.data.packs);
        setGstPct(r.data.gstPct ?? 18);
        setPackId((p) => p || r.data.packs[0]?.id);
      })
      .catch(() => {});
  }, [apply]);

  if (!s?.enabled) return null;

  const body = {
    renew,
    refill: { enabled: showRefill && refill, thresholdCredits: Number(threshold), packId },
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      toast({ title: "Auto-pay", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const activate = () =>
    run(async () => {
      const r = await autopayAPI.setup(body);
      if (!r.data.active) await authorizeMandate(r.data);
      apply((await autopayAPI.refresh()).data);
      toast({ title: "Auto-pay saved", description: "If your bank approval is pending it turns on automatically." });
    });
  const save = () =>
    run(async () => {
      apply((await autopayAPI.save(body)).data);
      toast({ title: "Auto-pay settings saved" });
    });
  const stop = () =>
    run(async () => {
      apply((await autopayAPI.cancel()).data);
      toast({ title: "Auto-pay cancelled" });
    });

  const pack = packs.find((p) => p.id === packId);
  const input = "border-2 border-black h-9 px-2 text-sm bg-white";

  return (
    <div className="border-2 p-4 sm:p-5 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-lg text-black">Auto-pay</h3>
        <span className="text-xs font-bold">
          {s.active ? "ACTIVE" : s.exists ? (s.status || "").replace(/_/g, " ") : "OFF"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Approve one UPI AutoPay / eNACH mandate (up to ₹{Number(s.maxAmount).toLocaleString("en-IN")} per charge).
        All charges include {gstPct}% GST and come with a GST invoice. Cancel any time.
      </p>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={renew} onChange={(e) => setRenew(e.target.checked)} />
        Auto-renew my plan before it expires
      </label>
      {showRefill && (
        <>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={refill} onChange={(e) => setRefill(e.target.checked)} />
            Auto-refill WhatsApp credits
          </label>
          {refill && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-bold space-y-1 block">
                When balance drops below (credits)
                <input className={`${input} w-full`} type="number" min={50} max={5000} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
              </label>
              <label className="text-xs font-bold space-y-1 block">
                Add this pack
                <select className={`${input} w-full`} value={packId} onChange={(e) => setPackId(e.target.value)}>
                  {packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      ₹{p.price.toLocaleString("en-IN")} → {p.credits.toLocaleString("en-IN")} credits
                    </option>
                  ))}
                </select>
              </label>
              {pack && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Each refill charges ₹{pack.total?.toLocaleString("en-IN")} (incl. GST). Max 3 refills in 24 hours.
                </p>
              )}
            </div>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {s.exists && s.status !== "CANCELLED" ? (
          <>
            {s.active ? (
              <button disabled={busy} onClick={save} className="border-2 border-black bg-[#024BAB] text-white font-bold text-sm px-4 py-2 disabled:opacity-60">
                Save settings
              </button>
            ) : (
              <button disabled={busy} onClick={activate} className="border-2 border-black bg-[#024BAB] text-white font-bold text-sm px-4 py-2 disabled:opacity-60">
                Complete bank approval
              </button>
            )}
            <button disabled={busy} onClick={() => run(async () => apply((await autopayAPI.refresh()).data))} className="border-2 border-black font-bold text-sm px-3 py-2" title="Check status">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button disabled={busy} onClick={stop} className="border-2 border-black font-bold text-sm px-4 py-2 text-red-600">
              Cancel auto-pay
            </button>
          </>
        ) : (
          <button disabled={busy} onClick={activate} className="border-2 border-black bg-[#024BAB] text-white font-bold text-sm px-4 py-2 disabled:opacity-60">
            Set up auto-pay
          </button>
        )}
      </div>
    </div>
  );
}
