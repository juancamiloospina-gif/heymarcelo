/** Shrinks a photo on the phone before uploading: longest side 1200 px, JPEG, usually < 300 KB. */
export async function compressImage(file: File, maxSide = 1200, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // respects the camera's rotation
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("compress_failed"))),
      "image/jpeg",
      quality,
    ),
  );
}
