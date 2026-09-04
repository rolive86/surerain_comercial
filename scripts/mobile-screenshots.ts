/**
 * Mobile screenshots (390×844) for vendedor módulo gestión.
 * Output: reports/mobile/*.png
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { chromium, type Page } from "playwright";
import { ROOT } from "../src/config.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const BASE_URL = (
  process.env.BASE_URL ??
  "https://surerain-comercial-git-preview-b44b03-rodrigo-oliveras-projects.vercel.app"
).replace(/\/$/, "");

const OUT_DIR = path.join(ROOT, "reports", "mobile");
const VIEWPORT = { width: 390, height: 844 };
const VENDEDOR = process.env.DEMO_STAFF_EMAIL ?? "vendedor.demo@surerain.test";

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not reachable at ${BASE_URL}`);
}

async function login(page: Page, email: string, password: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
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
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
  const overflow = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  const ok = overflow.sw <= overflow.iw + 2;
  console.log(`${ok ? "✓" : "⚠ overflow"} ${name} (sw=${overflow.sw} iw=${overflow.iw})`);
}

async function gotoSettle(page: Page, route: string): Promise<void> {
  await page.goto(`${BASE_URL}${route}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(1000);
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

  await gotoSettle(page, "/gestion/pedidos");
  await shot(page, "01-pedidos-lista.png");

  // Abrir primer pedido si hay link
  const pedidoHref = await page
    .locator('a[href^="/gestion/pedidos/"]')
    .filter({ hasNotText: /nueva/i })
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (pedidoHref) {
    await gotoSettle(page, pedidoHref);
    await shot(page, "02-pedido-detalle.png");
  }

  await gotoSettle(page, "/gestion/pedidos/nueva");
  await shot(page, "03-nueva-cotizacion.png");

  await gotoSettle(page, "/gestion/clientes");
  await shot(page, "04-clientes.png");

  await gotoSettle(
    page,
    "/gestion/inteligencia?tab=recontactar&familia=ASPERSORES&desde=8&hasta=10&anio=2025",
  );
  await page.waitForSelector("table, li", { timeout: 45_000 }).catch(() => undefined);
  await shot(page, "05-inteligencia.png");

  const year = new Date().getFullYear();
  await gotoSettle(
    page,
    `/gestion/explorador?group=familia&metric=facturacion&desde=${year}-01-01&hasta=${year}-12-31&interanual=1`,
  );
  await page.waitForSelector("table, li", { timeout: 45_000 }).catch(() => undefined);
  await shot(page, "06-explorador.png");

  await gotoSettle(page, "/gestion/vendedores");
  await shot(page, "07-vendedores.png");

  // Nav visible (bottom bar)
  await gotoSettle(page, "/gestion/pedidos");
  await shot(page, "00-nav-pedidos.png");

  await browser.close();
  console.log("Done →", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
