/**
 * Genera fixtures de comprobante para OCR cascada.
 * Output: fixtures/rendicion/*.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import { ROOT } from "../../src/config.js";

const OUT = path.join(ROOT, "fixtures", "rendicion");

async function makeAfipQr(): Promise<void> {
  const payload = {
    ver: 1,
    fecha: "2026-09-01",
    cuit: 30712345678,
    ptoVta: 1,
    tipoCmp: 6,
    nroCmp: 1234,
    importe: 15800.5,
    moneda: "PES",
    ctz: 1,
    tipoCodAut: "E",
    codAut: 70417054367476,
  };
  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  const url = `https://www.afip.gob.ar/fe/qr/?p=${b64}`;
  const qrPng = await QRCode.toBuffer(url, {
    type: "png",
    width: 360,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  // Factura mock: texto + QR
  const svg = `
<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="40" y="60" font-family="Arial" font-size="28" font-weight="bold">FACTURA B</text>
  <text x="40" y="100" font-family="Arial" font-size="16">CUIT: 30-71234567-8</text>
  <text x="40" y="130" font-family="Arial" font-size="16">Fecha: 01/09/2026</text>
  <text x="40" y="160" font-family="Arial" font-size="16">Nro: 00001-00001234</text>
  <text x="40" y="220" font-family="Arial" font-size="22" font-weight="bold">TOTAL $ 15.800,50</text>
  <text x="40" y="280" font-family="Arial" font-size="14" fill="#666">QR AFIP ↓</text>
</svg>`;
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const composed = await sharp(base)
    .composite([{ input: qrPng, top: 320, left: 120 }])
    .png()
    .toBuffer();
  writeFileSync(path.join(OUT, "afip-qr.png"), composed);
  writeFileSync(path.join(OUT, "afip-qr-url.txt"), url);
  console.log("✓ afip-qr.png");
}

async function makeTicket(): Promise<void> {
  const svg = `
<svg width="400" height="560" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="30" y="50" font-family="Courier New, monospace" font-size="20" font-weight="bold">TICKET</text>
  <text x="30" y="90" font-family="Courier New, monospace" font-size="16">CUIT 20-12345678-9</text>
  <text x="30" y="130" font-family="Courier New, monospace" font-size="16">FECHA 03/09/2026</text>
  <text x="30" y="170" font-family="Courier New, monospace" font-size="16">Combustible</text>
  <text x="30" y="230" font-family="Courier New, monospace" font-size="18" font-weight="bold">TOTAL $ 12.450,00</text>
  <text x="30" y="280" font-family="Courier New, monospace" font-size="14">Gracias</text>
</svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(path.join(OUT, "ticket-sin-qr.png"), buf);
  console.log("✓ ticket-sin-qr.png");
}

async function makeBlank(): Promise<void> {
  const svg = `
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f0f0f0"/>
  <text x="80" y="150" font-family="Arial" font-size="18" fill="#999">sin datos legibles</text>
</svg>`;
  writeFileSync(
    path.join(OUT, "blank.png"),
    await sharp(Buffer.from(svg)).png().toBuffer(),
  );
  console.log("✓ blank.png");
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await makeAfipQr();
  await makeTicket();
  await makeBlank();
  console.log("Done →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
