/**
 * Shrinks a photo on the phone before uploading: longest side 1200 px, JPEG, usually < 300 KB.
 * Phones are the hard case, so it tries three ways to read the file and fails with a code the
 * screen can explain (`photoErrorText`): `unsupported_format` (HEIC/HEIF the browser can't read,
 * or a file that isn't a picture), `too_big` (over 25 MB), `no_canvas`, `compress_failed`.
 */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

type Drawable = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function readImage(file: File): Promise<Drawable> {
  // 1) createImageBitmap: respects the camera's rotation. Missing in older iPhones, and it can
  //    throw on very large photos, so it is only the first try.
  if (typeof createImageBitmap === "function") {
    try {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: b, width: b.width, height: b.height, close: () => b.close() };
    } catch {
      // Fall through to the <img> way.
    }
  }
  // 2) <img> from an object URL: works wherever the browser can show the picture.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("unsupported_format");
  }
}

export async function compressImage(file: File, maxSide = 1200, quality = 0.82): Promise<Blob> {
  if (file.size > MAX_INPUT_BYTES) throw new Error("too_big");
  if (file.type && !file.type.startsWith("image/")) throw new Error("unsupported_format");
  const img = await readImage(file);
  try {
    if (!img.width || !img.height) throw new Error("unsupported_format");
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no_canvas");
    // Transparent PNGs would turn black as JPEG: paint white first.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.source, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("compress_failed"))),
        "image/jpeg",
        quality,
      ),
    );
  } finally {
    img.close();
  }
}

/** A sentence in Spanish for what went wrong with a photo (never a raw error code). */
export function photoErrorText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m === "unsupported_format")
    return "Tu teléfono guardó la foto en un formato que no puedo leer (HEIC). Ve a Ajustes › Cámara › Formatos y elige “Más compatible”, o toma la foto de nuevo.";
  if (m === "too_big")
    return "La foto es demasiado grande. Prueba con otra o una captura de pantalla.";
  if (m === "not_signed_in")
    return "Tu sesión se cerró. Entra con tu correo (más abajo) y vuelve a intentarlo.";
  if (m === "cloud_disabled") return "La nube no está conectada en esta versión de la app.";
  if (/network|fetch|failed to fetch|load failed/i.test(m))
    return "No hay conexión. Revisa tu internet e intenta de nuevo.";
  if (/mime|not allowed|invalid/i.test(m))
    return "Ese tipo de foto no se acepta. Usa una foto normal (JPG).";
  if (/exceeded|size|too large|payload/i.test(m)) return "La foto pesa demasiado. Prueba con otra.";
  if (/row-level|policy|unauthorized|jwt/i.test(m))
    return "No tengo permiso para guardar la foto. Cierra sesión, vuelve a entrar e intenta de nuevo.";
  return "No pude subir la foto. Intenta con otra.";
}
