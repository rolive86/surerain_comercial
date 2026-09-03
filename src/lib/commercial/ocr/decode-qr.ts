import jsQR from "jsqr";
import sharp from "sharp";

/**
 * Detecta y decodifica QR en la imagen (server-side).
 * Prueba escala original + upscale ×2 para QR chicos en fotos de celular.
 */
export async function decodeQrFromImage(
  buffer: Buffer,
): Promise<string | null> {
  const attempts: Array<{ scale: number; rotate: number }> = [
    { scale: 1, rotate: 0 },
    { scale: 2, rotate: 0 },
    { scale: 1.5, rotate: 0 },
    { scale: 2, rotate: 90 },
    { scale: 2, rotate: 270 },
  ];

  for (const { scale, rotate } of attempts) {
    try {
      let pipeline = sharp(buffer).rotate(rotate).ensureAlpha();
      if (scale !== 1) {
        const meta = await sharp(buffer).metadata();
        const w = Math.round((meta.width ?? 800) * scale);
        pipeline = pipeline.resize({ width: w, withoutEnlargement: false });
      }
      const { data, info } = await pipeline
        .raw()
        .toBuffer({ resolveWithObject: true });

      const code = jsQR(
        new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
        info.width,
        info.height,
        { inversionAttempts: "attemptBoth" },
      );
      if (code?.data?.trim()) return code.data.trim();
    } catch {
      /* try next */
    }
  }
  return null;
}
