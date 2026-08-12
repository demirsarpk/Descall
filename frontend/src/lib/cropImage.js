/**
 * Canvas helpers for react-easy-crop → File/Blob.
 */

export async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (err) => reject(err));
    // Same-origin / blob / data URLs — avoid CORS taint when possible
    if (typeof src === "string" && /^https?:/i.test(src)) {
      img.crossOrigin = "anonymous";
    }
    img.src = src;
  });
}

/**
 * @param {string} imageSrc
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @param {{ mimeType?: string, quality?: number, fileName?: string, maxSize?: number }} [opts]
 * @returns {Promise<File>}
 */
export async function getCroppedImageFile(imageSrc, pixelCrop, opts = {}) {
  const {
    mimeType = "image/jpeg",
    quality = 0.92,
    fileName = "crop.jpg",
    maxSize = 1024,
  } = opts;

  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const cropW = Math.max(1, Math.round(pixelCrop.width));
  const cropH = Math.max(1, Math.round(pixelCrop.height));
  const scale = Math.min(1, maxSize / Math.max(cropW, cropH));
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));

  canvas.width = outW;
  canvas.height = outH;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    cropW,
    cropH,
    0,
    0,
    outW,
    outH
  );

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to crop image"))),
      mimeType,
      quality
    );
  });

  return new File([blob], fileName, { type: mimeType, lastModified: Date.now() });
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Read failed")));
    reader.readAsDataURL(file);
  });
}
