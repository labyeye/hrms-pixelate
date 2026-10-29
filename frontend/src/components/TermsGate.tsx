// Fallback for sessions that were already open when the Terms/Privacy version changed. New sign-ins and registrations
// record acceptance on the login/register screens (they show the links), once per account, so this stays hidden then.
// A slim bar with links — no modal. Backend: /api/legal, utils/terms.js.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { legalAPI } from "@/services/api";

const SITE = "https://www.pixelatenest.com/legal";

type Status = { version: string; required: boolean; accepted: boolean };

export default function TermsGate() {
  const { isAuthenticated } = useAuth() as { isAuthenticated: boolean };
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(() => {
    if (!isAuthenticated) return setStatus(null);
    legalAPI
      .status()
      .then(setStatus)
      .catch(() => {});
  }, [isAuthenticated]);
  useEffect(check, [check]);

  const pending = !!status && status.required && !status.accepted;
  useEffect(() => {
    if (!pending) return;
    const prev = document.body.style.paddingTop;
    document.body.style.paddingTop = "48px";
    return () => {
      document.body.style.paddingTop = prev;
    };
  }, [pending]);

  if (!pending) return null;

  async function accept() {
    setBusy(true);
    setError("");
    try {
      setStatus(await legalAPI.accept());
    } catch (e: any) {
      setError(
        e?.message || "Could not save your acceptance. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const a = "font-bold underline";
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100000,
        height: 48,
      }}
      className="flex items-center justify-between gap-3 bg-amber-500 px-4 text-sm font-medium text-black shadow"
    >
      <span>
        Please accept the updated{" "}
        <a
          className={a}
          href={`${SITE}/terms-of-service.html`}
          target="_blank"
          rel="noreferrer"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          className={a}
          href={`${SITE}/privacy-policy.html`}
          target="_blank"
          rel="noreferrer"
        >
          Privacy Policy
        </a>{" "}
        to continue.
        {error && <span className="ml-2 text-red-900">{error}</span>}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={accept}
        className="shrink-0 rounded bg-black px-3 py-1 text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "I agree"}
      </button>
    </div>
  );
}
