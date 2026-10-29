import { useRef, useState } from "react";
import { Lock, X } from "lucide-react";
import { documentAPI } from "@/services/api";

// Doc-access token lives in memory only (15 min server-side); a page reload asks for a new OTP.
let docToken = "";
let docTokenExp = 0;

const NEED_OTP = /OTP verification required/i;

/**
 * Wraps confidential-file actions: `withOtp(token => documentAPI.download(id, token))`.
 * Asks for a WhatsApp OTP when there is no live access token. Render `otpModal` once in the page.
 */
export function useDocOtp() {
  const [open, setOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{
    ok: (t: string) => void;
    no: (e: Error) => void;
  } | null>(null);

  const sendCode = async () => {
    setMsg("");
    try {
      const r = await documentAPI.requestOtp();
      setMsg(r.message || "OTP sent");
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  const ask = () =>
    new Promise<string>((ok, no) => {
      pending.current = { ok, no };
      setOtp("");
      setOpen(true);
      sendCode();
    });

  const close = () => {
    setOpen(false);
    pending.current?.no(new Error("OTP verification cancelled"));
    pending.current = null;
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await documentAPI.verifyOtp(otp);
      docToken = r.token;
      docTokenExp = Date.now() + (r.expiresInMinutes - 1) * 60_000;
      setOpen(false);
      pending.current?.ok(r.token);
      pending.current = null;
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(false);
  };

  const withOtp = async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    const token = docToken && Date.now() < docTokenExp ? docToken : await ask();
    try {
      return await fn(token);
    } catch (e: any) {
      if (!NEED_OTP.test(e?.message || "")) throw e;
      docToken = "";
      return fn(await ask());
    }
  };

  const otpModal = open ? (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
      <div className="border-2 border-black bg-white w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black bg-[#024BAB] text-white">
          <h3 className="font-bold flex items-center gap-2">
            <Lock className="w-4 h-4" /> Verify to open document
          </h3>
          <button onClick={close}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            This is a confidential document. Enter the 6-digit OTP sent to your
            WhatsApp. Access stays unlocked for 15 minutes.
          </p>
          <input
            autoFocus
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && submit()}
            placeholder="------"
            className="w-full border-2 border-black px-3 py-3 text-center text-2xl font-bold tracking-[0.5em]"
          />
          {msg && <p className="text-xs font-medium text-[#024BAB]">{msg}</p>}
          <button
            disabled={otp.length !== 6 || busy}
            onClick={submit}
            className="w-full border-2 border-black bg-[#024BAB] text-white py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {busy ? "Verifying..." : "Verify & Open"}
          </button>
          <button
            onClick={sendCode}
            className="w-full text-xs font-bold text-[#024BAB] hover:underline"
          >
            Resend OTP
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { withOtp, otpModal };
}
