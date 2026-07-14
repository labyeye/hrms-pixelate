import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}

const HANDLE_SIZE = 10;
type Handle = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

// ponytail: hand-rolled drag/resize crop box instead of a new dependency —
// no rotation, just free-form crop from any edge/corner.
export function ImageCropModal({ file, onCancel, onCropped }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [box, setBox] = useState({ x: 20, y: 20, w: 200, h: 200 });
  const dragState = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    box: typeof box;
  } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current!;
      const maxW = 560;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      setBox({
        x: canvas.width * 0.1,
        y: canvas.height * 0.1,
        w: canvas.width * 0.8,
        h: canvas.height * 0.8,
      });
      draw();
    };
    img.src = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(img.src);
  }, [file]);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, box.y);
    ctx.fillRect(0, box.y + box.h, canvas.width, canvas.height - box.y - box.h);
    ctx.fillRect(0, box.y, box.x, box.h);
    ctx.fillRect(box.x + box.w, box.y, canvas.width - box.x - box.w, box.h);

    ctx.strokeStyle = "#024BAB";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    ctx.fillStyle = "#024BAB";
    const handles = handlePositions();
    for (const p of Object.values(handles)) {
      ctx.fillRect(
        p.x - HANDLE_SIZE / 2,
        p.y - HANDLE_SIZE / 2,
        HANDLE_SIZE,
        HANDLE_SIZE,
      );
    }
  };

  useEffect(draw, [box]);

  const handlePositions = () => ({
    nw: { x: box.x, y: box.y },
    n: { x: box.x + box.w / 2, y: box.y },
    ne: { x: box.x + box.w, y: box.y },
    e: { x: box.x + box.w, y: box.y + box.h / 2 },
    se: { x: box.x + box.w, y: box.y + box.h },
    s: { x: box.x + box.w / 2, y: box.y + box.h },
    sw: { x: box.x, y: box.y + box.h },
    w: { x: box.x, y: box.y + box.h / 2 },
  });

  const hitHandle = (x: number, y: number): Handle => {
    const handles = handlePositions();
    for (const [name, p] of Object.entries(handles)) {
      if (
        Math.abs(x - p.x) <= HANDLE_SIZE &&
        Math.abs(y - p.y) <= HANDLE_SIZE
      ) {
        return name as Handle;
      }
    }
    if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
      return "move";
    }
    return "move";
  };

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getPos(e);
    dragState.current = { handle: hitHandle(x, y), startX: x, startY: y, box };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current) return;
    const canvas = canvasRef.current!;
    const { x, y } = getPos(e);
    const dx = x - dragState.current.startX;
    const dy = y - dragState.current.startY;
    const b = dragState.current.box;
    let next = { ...b };

    const clampX = (v: number) => Math.max(0, Math.min(canvas.width, v));
    const clampY = (v: number) => Math.max(0, Math.min(canvas.height, v));

    switch (dragState.current.handle) {
      case "move":
        next.x = clampX(b.x + dx);
        next.y = clampY(b.y + dy);
        next.x = Math.min(next.x, canvas.width - b.w);
        next.y = Math.min(next.y, canvas.height - b.h);
        break;
      case "nw":
        next.x = clampX(b.x + dx);
        next.y = clampY(b.y + dy);
        next.w = b.x + b.w - next.x;
        next.h = b.y + b.h - next.y;
        break;
      case "ne":
        next.y = clampY(b.y + dy);
        next.w = clampX(b.x + b.w + dx) - b.x;
        next.h = b.y + b.h - next.y;
        break;
      case "sw":
        next.x = clampX(b.x + dx);
        next.w = b.x + b.w - next.x;
        next.h = clampY(b.y + b.h + dy) - b.y;
        break;
      case "se":
        next.w = clampX(b.x + b.w + dx) - b.x;
        next.h = clampY(b.y + b.h + dy) - b.y;
        break;
      case "n":
        next.y = clampY(b.y + dy);
        next.h = b.y + b.h - next.y;
        break;
      case "s":
        next.h = clampY(b.y + b.h + dy) - b.y;
        break;
      case "e":
        next.w = clampX(b.x + b.w + dx) - b.x;
        break;
      case "w":
        next.x = clampX(b.x + dx);
        next.w = b.x + b.w - next.x;
        break;
    }
    if (next.w > 20 && next.h > 20) setBox(next);
  };

  const onMouseUp = () => {
    dragState.current = null;
  };

  const handleApply = () => {
    const canvas = canvasRef.current!;
    const img = imgRef.current!;
    const scaleX = img.width / canvas.width;
    const scaleY = img.height / canvas.height;

    const out = document.createElement("canvas");
    out.width = box.w * scaleX;
    out.height = box.h * scaleY;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(
      img,
      box.x * scaleX,
      box.y * scaleY,
      box.w * scaleX,
      box.h * scaleY,
      0,
      0,
      out.width,
      out.height,
    );
    out.toBlob(
      (blob) => blob && onCropped(blob),
      file.type === "image/png" ? "image/png" : "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="border-2 border-black bg-white w-full max-w-xl">
        <div className="flex items-center justify-between p-4 border-b-2 border-black">
          <h3 className="font-display font-bold text-lg">Crop Document</h3>
          <button onClick={onCancel}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 flex justify-center bg-black/5">
          <canvas
            ref={canvasRef}
            className="cursor-move touch-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        </div>
        <div className="p-4 border-t-2 border-black flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="border-2 border-black px-4 py-2 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm font-bold"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
