// Opens the device camera (front by default) and returns one captured photo as a File.
import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

export default function CameraCaptureModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().then(() => setReady(true));
        }
      })
      .catch(() =>
        setError(
          "Camera not available. Allow camera permission (needs https) and try again.",
        ),
      );
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const snap = () => {
    const v = videoRef.current!;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (b) onCapture(new File([b], "face.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md border-2 border-black bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold">Scan Face</p>
          <button type="button" onClick={onClose} aria-label="Close camera">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full -scale-x-100 bg-black object-cover"
          />
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Look straight at the camera in good light, one face only.
        </p>
        <button
          type="button"
          disabled={!ready}
          onClick={snap}
          className="mt-3 flex w-full items-center justify-center gap-2 border-2 border-black bg-[#024BAB] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          <Camera className="h-4 w-4" /> Capture
        </button>
      </div>
    </div>
  );
}
