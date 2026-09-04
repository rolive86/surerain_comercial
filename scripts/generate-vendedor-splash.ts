/**
 * Generate Android splash drawables: white Sure Rain logo on transparent,
 * for use with backgroundColor #006A46 (full-bleed green).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "public", "brand", "logo-blanco.svg");
const resDir = path.join(root, "android-vendedor", "app", "src", "main", "res");

const densities = [
  { folder: "drawable-mdpi", size: 320 },
  { folder: "drawable-hdpi", size: 480 },
  { folder: "drawable-xhdpi", size: 640 },
  { folder: "drawable-xxhdpi", size: 960 },
  { folder: "drawable-xxxhdpi", size: 1200 },
];

const svg = fs.readFileSync(svgPath);

for (const { folder, size } of densities) {
  const logoWidth = Math.round(size * 0.72);
  const logo = await sharp(svg)
    .resize({ width: logoWidth, fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();
  const lw = meta.width ?? logoWidth;
  const lh = meta.height ?? Math.round(logoWidth / 3);
  const left = Math.round((size - lw) / 2);
  const top = Math.round((size - lh) / 2);

  const outDir = path.join(resDir, folder);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "splash.png");

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(outPath);

  console.log("wrote", outPath, `${size}x${size}`, `logo ${lw}x${lh}`);
}

// Also export a web preview asset (optional, green bg) for docs — not used by Android
const preview = path.join(root, "android-vendedor", "splash-preview.png");
const previewLogo = await sharp(svg).resize({ width: 720, fit: "inside" }).png().toBuffer();
const pm = await sharp(previewLogo).metadata();
await sharp({
  create: {
    width: 1080,
    height: 1920,
    channels: 3,
    background: { r: 0, g: 106, b: 70 },
  },
})
  .composite([
    {
      input: previewLogo,
      left: Math.round((1080 - (pm.width ?? 720)) / 2),
      top: Math.round((1920 - (pm.height ?? 200)) / 2),
    },
  ])
  .png()
  .toFile(preview);
console.log("wrote", preview);
