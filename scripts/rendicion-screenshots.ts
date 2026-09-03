/**
 * Capturas mobile (390×844) del flujo Rendición + Stock compacto.
 * Output: reports/rendicion/*.png
 *
 *   $env:DEMO_PASSWORD='...'; npx tsx --tsconfig tsconfig.scripts.json scripts/rendicion-screenshots.ts
 */
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { chromium, type Page } from "playwright";
import { ROOT } from "../src/config.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const BASE_URL = (
  process.env.BASE_URL ??
  "https://surerain-comercial-git-preview-b44b03-rodrigo-oliveras-projects.vercel.app"
).replace(/\/$/, "");

const OUT_DIR = path.join(ROOT, "reports", "rendicion");
const VIEWPORT = { width: 390, height: 844 };
const VENDEDOR = process.env.DEMO_STAFF_EMAIL ?? "vendedor.demo@surerain.test";
const FIXTURE_QR = path.join(ROOT, "fixtures", "rendicion", "afip-qr.png");

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Server not reachable at ${BASE_URL}`);
}

async function login(page: Page, email: string, password: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(`${BASE_URL}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.locator('form input[type="email"]').waitFor({ timeout: 20_000 });
    await page.locator('form input[type="email"]').fill(email);
    await page.locator('form input[type="password"]').fill(password);
    await page.locator('form button[type="submit"]').click();
    try {
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
        timeout: 25_000,
        waitUntil: "commit",
      });
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(800);
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      await page.waitForTimeout(1500);
    }
  }
}

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
  console.log(`✓ ${name}`);
}

async function gotoSettle(page: Page, route: string): Promise<void> {
  await page.goto(`${BASE_URL}${route}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(1200);
}

async function main() {
  const password = process.env.DEMO_PASSWORD?.trim() || "SureRain-Demo-2026!";
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`BASE_URL=${BASE_URL}`);
  await waitForServer();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  await login(page, VENDEDOR, password);

  // Lista
  await gotoSettle(page, "/gestion/rendicion");
  await page.waitForSelector("text=Rendición", { timeout: 30_000 });
  await shot(page, "rendicion-lista.png");

  // Subir
  await page.getByTestId("rendicion-new").click();
  await page.waitForTimeout(400);
  await shot(page, "rendicion-subir.png");

  // OCR con fixture QR (si existe)
  if (existsSync(FIXTURE_QR)) {
    const fileInput = page.getByTestId("rendicion-file-input");
    await fileInput.setInputFiles(FIXTURE_QR);
    await page
      .getByTestId("ocr-metodo-chip")
      .waitFor({ timeout: 90_000 })
      .catch(() => undefined);
    // Esperar a que deje de decir "Leyendo"
    for (let i = 0; i < 40; i++) {
      const txt = await page.getByTestId("ocr-metodo-chip").textContent();
      if (txt && !/Leyendo/i.test(txt)) break;
      await page.waitForTimeout(1000);
    }
    await shot(page, "rendicion-ocr.png");

    // Concepto
    const continuar = page.getByRole("button", { name: /Continuar/i });
    if (await continuar.isEnabled()) {
      await continuar.click();
      await page.waitForTimeout(800);
      await page.getByTestId("rendicion-concepto").waitFor({ timeout: 15_000 });
      await shot(page, "rendicion-concepto.png");
    }
  } else {
    console.warn("⚠ missing fixture afip-qr.png — skip ocr/concepto shots");
  }

  // Stock compacto
  await gotoSettle(page, "/gestion/stock");
  await page.waitForSelector("text=Stock", { timeout: 30_000 });
  await shot(page, "stock-compacto.png");

  await browser.close();
  console.log("Done →", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
