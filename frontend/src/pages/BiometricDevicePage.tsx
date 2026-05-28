import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { biometricAPI } from "@/services/api";
import {
  CreditCard,
  Camera,
  Hash,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  LogIn,
  LogOut,
  Zap,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "nfc" | "face" | "pin";
type ScanState = "idle" | "scanning" | "success" | "error";

interface DeviceInfo {
  _id: string;
  name: string;
  location: { _id: string; name: string; address?: string };
  nfcCards: Array<{
    uid: string;
    label?: string;
    employee: {
      _id: string;
      firstName: string;
      lastName: string;
      employeeId: string;
    };
  }>;
}

interface ScanResult {
  employee: { name: string; employeeId: string };
  type: "check_in" | "check_out";
  timestamp: string;
  location: string;
}

declare global {
  interface Window {
    NDEFReader: any;
  }
}

export default function BiometricDevicePage() {
  const { token } = useParams<{ token: string }>();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("nfc");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");

  // NFC state
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  const [manualUid, setManualUid] = useState("");

  // Face state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceEmployeeId, setFaceEmployeeId] = useState("");

  // PIN state
  const [pinEmployeeId, setPinEmployeeId] = useState("");

  const [online, setOnline] = useState(navigator.onLine);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    setNfcSupported("NDEFReader" in window);
  }, []);

  const fetchDevice = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await biometricAPI.getDeviceInfo(token);
      setDevice(res.data);
    } catch (e: any) {
      setError(e.message || "Device not found");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

  const showResult = (res: ScanResult) => {
    setResult(res);
    setScanState("success");
    setTimeout(() => {
      setScanState("idle");
      setResult(null);
      setManualUid("");
      setPinEmployeeId("");
      setFaceEmployeeId("");
    }, 4000);
  };

  const showScanError = (msg: string) => {
    setScanError(msg);
    setScanState("error");
    setTimeout(() => {
      setScanState("idle");
      setScanError("");
    }, 3000);
  };

  const doRecord = async (opts: {
    method: Mode;
    nfcUid?: string;
    employeeId?: string;
  }) => {
    if (!token) return;
    setScanState("scanning");
    try {
      const res = await biometricAPI.recordBiometric({
        deviceToken: token,
        method: opts.method,
        nfcUid: opts.nfcUid,
        employeeId: opts.employeeId,
      });
      showResult(res.data);
    } catch (e: any) {
      showScanError(e.message || "Scan failed");
    }
  };

  // Web NFC
  const startNfcScan = async () => {
    if (!nfcSupported) return;
    setNfcReading(true);
    try {
      const ndef = new window.NDEFReader();
      await ndef.scan();
      ndef.addEventListener(
        "reading",
        ({ serialNumber }: { serialNumber: string }) => {
          const uid = serialNumber.replace(/:/g, "").toUpperCase();
          setNfcReading(false);
          doRecord({ method: "nfc", nfcUid: uid });
        },
      );
    } catch (e: any) {
      setNfcReading(false);
      showScanError("NFC scan failed: " + e.message);
    }
  };

  // Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      showScanError("Camera access denied");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((t) => t.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (mode !== "face") stopCamera();
  }, [mode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#024BAB] animate-spin mx-auto mb-4" />
          <p className="text-white font-black text-lg">
            Initializing Device...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-white font-black text-2xl mb-2">Device Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={fetchDevice}
            className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-white/20 px-6 py-3 font-black uppercase mx-auto"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col select-none">
      {/* Status bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#024BAB] border border-white/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-black text-sm">
            NestHR Biometric
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <span
            className={cn(
              "flex items-center gap-1",
              online ? "text-green-400" : "text-red-400",
            )}
          >
            {online ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {online ? "Online" : "Offline"}
          </span>
          <span className="text-white/60 font-mono text-sm">
            {clock.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Location info */}
        <div className="text-center mb-8">
          <h1 className="text-white font-black text-3xl">
            {device?.location?.name}
          </h1>
          {device?.location?.address && (
            <p className="text-white/50 text-sm font-medium mt-1">
              {device?.location?.address}
            </p>
          )}
          <p className="text-white/30 text-xs font-medium mt-1">
            {device?.name}
          </p>
        </div>

        {/* Date */}
        <div className="text-white/40 text-sm font-mono mb-8">
          {clock.toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>

        {/* Mode selector */}
        <div className="flex gap-0 border-2 border-white/20 overflow-hidden mb-8">
          {[
            { id: "nfc" as Mode, icon: CreditCard, label: "NFC Card" },
            { id: "face" as Mode, icon: Camera, label: "Face" },
            { id: "pin" as Mode, icon: Hash, label: "PIN" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setScanState("idle");
              }}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-black uppercase transition-all border-r border-white/20 last:border-r-0",
                mode === m.id
                  ? "bg-[#024BAB] text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white",
              )}
            >
              <m.icon className="w-4 h-4" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Scan area */}
        <div className="w-full max-w-sm">
          {/* Result overlay */}
          {scanState === "success" && result && (
            <div className="border-2 border-green-400 bg-green-950/50 p-8 text-center animate-pulse-once">
              <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-white font-black text-2xl mb-1">
                {result.employee.name}
              </h2>
              <p className="text-green-400 font-mono text-sm mb-3">
                {result.employee.employeeId}
              </p>
              <div
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 border font-black text-sm uppercase",
                  result.type === "check_in"
                    ? "border-green-400 text-green-400 bg-green-900/30"
                    : "border-orange-400 text-orange-400 bg-orange-900/30",
                )}
              >
                {result.type === "check_in" ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                {result.type === "check_in" ? "Checked In" : "Checked Out"}
              </div>
              <p className="text-white/40 text-xs font-mono mt-3">
                {new Date(result.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}

          {scanState === "error" && (
            <div className="border-2 border-red-400 bg-red-950/50 p-8 text-center">
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <p className="text-red-300 font-black text-lg">{scanError}</p>
            </div>
          )}

          {scanState === "scanning" && (
            <div className="border-2 border-[#024BAB] bg-blue-950/50 p-8 text-center">
              <Loader2 className="w-16 h-16 text-[#024BAB] animate-spin mx-auto mb-4" />
              <p className="text-white font-black text-lg">Processing...</p>
            </div>
          )}

          {scanState === "idle" && (
            <>
              {/* NFC Mode */}
              {mode === "nfc" && (
                <div className="text-center">
                  <div
                    className={cn(
                      "w-48 h-48 mx-auto border-4 rounded-full flex items-center justify-center cursor-pointer transition-all mb-6",
                      nfcReading
                        ? "border-[#024BAB] bg-blue-950/50 animate-pulse"
                        : "border-white/20 bg-white/5 hover:border-[#024BAB] hover:bg-blue-950/30",
                    )}
                    onClick={nfcSupported ? startNfcScan : undefined}
                  >
                    <CreditCard
                      className={cn(
                        "w-20 h-20",
                        nfcReading ? "text-[#024BAB]" : "text-white/30",
                      )}
                    />
                  </div>
                  {nfcSupported ? (
                    <p className="text-white/60 font-medium mb-6">
                      {nfcReading
                        ? "Waiting for card..."
                        : "Tap the circle to start NFC scan"}
                    </p>
                  ) : (
                    <p className="text-yellow-400/80 text-sm font-medium mb-4">
                      NFC not supported on this browser.
                      <br />
                      Use manual entry below.
                    </p>
                  )}
                  {/* Manual NFC UID input (fallback) */}
                  <div className="border-t border-white/10 pt-6">
                    <p className="text-white/40 text-xs font-black uppercase mb-3">
                      Manual Card UID
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={manualUid}
                        onChange={(e) =>
                          setManualUid(e.target.value.toUpperCase())
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          manualUid &&
                          doRecord({ method: "nfc", nfcUid: manualUid })
                        }
                        placeholder="Enter card UID..."
                        className="flex-1 bg-white/10 border-2 border-white/20 text-white font-mono px-3 py-2 text-sm focus:outline-none focus:border-[#024BAB] placeholder:text-white/20"
                      />
                      <button
                        onClick={() =>
                          manualUid &&
                          doRecord({ method: "nfc", nfcUid: manualUid })
                        }
                        disabled={!manualUid}
                        className="bg-[#024BAB] border-2 border-white/20 text-white px-4 py-2 font-black text-sm disabled:opacity-40"
                      >
                        Scan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Face Mode */}
              {mode === "face" && (
                <div className="text-center">
                  <div className="relative w-full aspect-video border-2 border-white/20 bg-black mb-4 overflow-hidden">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      muted
                      playsInline
                    />
                    {!cameraActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Camera className="w-12 h-12 text-white/30 mb-3" />
                        <p className="text-white/40 font-medium text-sm">
                          Camera inactive
                        </p>
                      </div>
                    )}
                    {cameraActive && (
                      <div className="absolute inset-0 border-4 border-[#024BAB]/50 pointer-events-none">
                        <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-[#024BAB]" />
                        <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-[#024BAB]" />
                        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-[#024BAB]" />
                        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-[#024BAB]" />
                      </div>
                    )}
                  </div>
                  {!cameraActive ? (
                    <button
                      onClick={startCamera}
                      className="w-full bg-[#024BAB] border-2 border-white/20 text-white font-black uppercase py-3 mb-4"
                    >
                      Start Camera
                    </button>
                  ) : (
                    <button
                      onClick={stopCamera}
                      className="w-full bg-white/10 border-2 border-white/20 text-white font-black uppercase py-3 mb-4"
                    >
                      Stop Camera
                    </button>
                  )}
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-white/40 text-xs font-black uppercase mb-2">
                      Select Employee
                    </p>
                    <select
                      value={faceEmployeeId}
                      onChange={(e) => setFaceEmployeeId(e.target.value)}
                      className="w-full bg-white/10 border-2 border-white/20 text-white px-3 py-2 text-sm font-medium focus:outline-none focus:border-[#024BAB] mb-3"
                    >
                      <option value="" className="bg-[#0A0F1E]">
                        Select employee
                      </option>
                      {device?.nfcCards.map((card) => (
                        <option
                          key={card.employee._id}
                          value={card.employee._id}
                          className="bg-[#0A0F1E]"
                        >
                          {card.employee.firstName} {card.employee.lastName} (
                          {card.employee.employeeId})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        faceEmployeeId &&
                        doRecord({ method: "face", employeeId: faceEmployeeId })
                      }
                      disabled={!faceEmployeeId}
                      className="w-full bg-[#024BAB] border-2 border-white/20 text-white font-black uppercase py-3 disabled:opacity-40"
                    >
                      Record Attendance
                    </button>
                  </div>
                </div>
              )}

              {/* PIN Mode */}
              {mode === "pin" && (
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto border-4 border-white/20 rounded-full flex items-center justify-center mb-6">
                    <Hash className="w-10 h-10 text-white/30" />
                  </div>
                  <p className="text-white/60 font-medium mb-6">
                    Select your name to mark attendance
                  </p>
                  <select
                    value={pinEmployeeId}
                    onChange={(e) => setPinEmployeeId(e.target.value)}
                    className="w-full bg-white/10 border-2 border-white/20 text-white px-3 py-3 text-sm font-medium focus:outline-none focus:border-[#024BAB] mb-4"
                  >
                    <option value="" className="bg-[#0A0F1E]">
                      Select your name
                    </option>
                    {device?.nfcCards.map((card) => (
                      <option
                        key={card.employee._id}
                        value={card.employee._id}
                        className="bg-[#0A0F1E]"
                      >
                        {card.employee.firstName} {card.employee.lastName} (
                        {card.employee.employeeId})
                      </option>
                    ))}
                  </select>

                  {/* Numpad-style employee grid */}
                  {device && device.nfcCards.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {device.nfcCards.map((card) => (
                        <button
                          key={card.employee._id}
                          onClick={() =>
                            doRecord({
                              method: "pin",
                              employeeId: card.employee._id,
                            })
                          }
                          className="bg-white/5 hover:bg-[#024BAB]/50 border-2 border-white/10 hover:border-[#024BAB] text-white text-left p-3 transition-all"
                        >
                          <p className="font-black text-sm">
                            {card.employee.firstName} {card.employee.lastName}
                          </p>
                          <p className="text-white/40 text-xs font-mono">
                            {card.employee.employeeId}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {device?.nfcCards.length === 0 && (
                    <p className="text-white/30 text-sm font-medium">
                      No employees assigned to this device
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 border-t border-white/10">
        <p className="text-white/20 text-xs font-medium">
          NestHR Biometric Terminal · {device?.name}
        </p>
      </div>
    </div>
  );
}
