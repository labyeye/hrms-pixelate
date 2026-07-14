// Client-side convenience only — the backend enforces the real 5MB limit.
// ponytail: quality/scale step-down loop, good enough for photos of ID docs; add a WASM
// encoder later if lossless compression under 5MB ever becomes a real requirement.
export async function compressImageToLimit(
  file: Blob,
  type: string,
  maxBytes = 5 * 1024 * 1024,
): Promise<Blob> {
  if (file.size <= maxBytes) return file;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = URL.createObjectURL(file);
  });

  let { width, height } = img;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  let quality = 0.9;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, quality),
    );
    if (blob && blob.size <= maxBytes) break;
    quality -= 0.15;
    if (quality < 0.4) {
      width = Math.round(width * 0.75);
      height = Math.round(height * 0.75);
      quality = 0.7;
    }
  }
  URL.revokeObjectURL(img.src);
  return blob && blob.size <= maxBytes ? blob : (blob ?? file);
}
