/**
 * Prueba local de la cascada OCR (GATE 1–3) sin HTTP.
 * Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/rendicion/test-ocr-cascade.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

async function main() {
  // Import dinámico para respetar server-only en runtime Node
  const { runOcrCascade } = await import("../../src/lib/commercial/ocr/cascade.js");
  const { isRendicionLlmOcrEnabled } = await import(
    "../../src/lib/commercial/ocr/config.js"
  );

  const dir = path.join(ROOT, "fixtures", "rendicion");
  const cases = [
    { file: "afip-qr.png", expect: "qr_afip" as const, gate: "GATE 1" },
    { file: "ticket-sin-qr.png", expect: "tesseract" as const, gate: "GATE 2" },
    { file: "blank.png", expect: "none" as const, gate: "GATE 3/4" },
  ];

  console.log(`RENDICION_OCR_LLM=${isRendicionLlmOcrEnabled() ? "ON" : "OFF"}`);

  for (const c of cases) {
    const buf = readFileSync(path.join(dir, c.file));
    const t0 = Date.now();
    const result = await runOcrCascade({ buffer: buf, mime: "image/png" });
    const ms = Date.now() - t0;
    const ok =
      c.expect === "none"
        ? result.metodo === "none" ||
          (result.total == null && !result.fecha_emision)
        : result.metodo === c.expect ||
          (c.expect === "tesseract" &&
            (result.metodo === "tesseract" || result.metodo === "llm"));
    console.log(
      `${ok ? "✓" : "✗"} ${c.gate} ${c.file} → metodo=${result.metodo} phases=${JSON.stringify(result.phases)} total=${result.total} fecha=${result.fecha_emision} cuit=${result.cuit} (${ms}ms)`,
    );
    if (result.notes) console.log(`   notes: ${result.notes}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
