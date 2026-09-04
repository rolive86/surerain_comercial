/**
 * Responsive matrix with Playwright evidence (screenshots + checks, not eyeballing).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { chromium, type BrowserContext, type Page } from "playwright";
import { ROOT } from "../src/config.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const BREAKPOINTS = [360, 390, 414, 768, 1024, 1280, 1440] as const;
const BASE_URL = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

const CUSTOMER_EMAIL = process.env.DEMO_CUSTOMER_EMAIL ?? "cliente.demo@surerain.test";
const STAFF_EMAIL = process.env.DEMO_STAFF_EMAIL ?? "vendedor.demo@surerain.test";

type Check = { name: string; pass: boolean; detail: string };

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function slugifyRoute(route: string, productSlug?: string): string {
  if (route === "/") return "home";
  if (route.startsWith("/catalogo/") || route === "ficha") {
    return `catalogo-${productSlug ?? "ficha"}`;
  }
  return route.replace(/^\//, "").replaceAll("/", "-");
}

function viewportHeight(width: number): number {
  if (width <= 414) return 844;
  if (width <= 768) return 1024;
  return 900;
}

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
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  await page.waitForLoadState("domcontentloaded");
}

async function firstProductHref(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/catalogo`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const href = await page.locator('a[href^="/catalogo/"]').first().getAttribute("href");
  if (!href) throw new Error("No product link found on /catalogo");
  return href;
}

async function runChecks(
  page: Page,
  opts: { width: number; isShop: boolean; isFicha: boolean },
): Promise<Check[]> {
  const checks: Check[] = [];
  const { width, isShop, isFicha } = opts;

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      scrollWidth: root.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  const overflowOk = overflow.scrollWidth <= overflow.innerWidth + 1;
  checks.push({
    name: "overflow",
    pass: overflowOk,
    detail: `scrollWidth=${overflow.scrollWidth} innerWidth=${overflow.innerWidth}`,
  });

  const tab = page.locator('[data-testid="shop-tab-bar"]');
  const tabCount = await tab.count();
  const tabVisible = tabCount > 0 ? await tab.isVisible() : false;
  const expectTab = isShop && width < 1024;
  checks.push({
    name: "tabbar",
    pass: tabVisible === expectTab,
    detail: expectTab
      ? tabVisible
        ? "visible <1024"
        : "missing tab bar <1024"
      : tabVisible
        ? "visible at >=1024 or staff"
        : "hidden as expected",
  });

  const header = page.locator("header").first();
  const headerPos = await header.evaluate((el) => getComputedStyle(el).position);
  const stickyOk = headerPos === "sticky" || headerPos === "fixed";
  await page.evaluate(() => window.scrollTo(0, 240));
  await page.waitForTimeout(150);
  const headerBox = await header.boundingBox();
  const stuck = Boolean(headerBox && headerBox.y <= 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  checks.push({
    name: "header-sticky",
    pass: stickyOk && (stuck || headerPos === "sticky"),
    detail: `position=${headerPos} yAfterScroll=${headerBox?.y ?? "n/a"}`,
  });

  if (isFicha && width < 1024) {
    const cta = page.locator('[data-testid="product-sticky-cta"]');
    const ctaVisible = await cta.isVisible();
    const ctaBox = ctaVisible ? await cta.boundingBox() : null;
    const tabBox = tabVisible ? await tab.boundingBox() : null;
    let overlapOk = false;
    let detail = "cta or tab missing";
    if (ctaBox && tabBox) {
      overlapOk = ctaBox.y + ctaBox.height <= tabBox.y + 2;
      detail = `cta.bottom=${(ctaBox.y + ctaBox.height).toFixed(1)} tab.top=${tabBox.y.toFixed(1)}`;
    }
    checks.push({
      name: "cta-vs-tab",
      pass: Boolean(ctaVisible && overlapOk),
      detail,
    });
  } else {
    checks.push({
      name: "cta-vs-tab",
      pass: true,
      detail: "n/a",
    });
  }

  const smallTargets = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        "header a, header button, [data-testid='shop-tab-bar'] a, [data-testid='product-sticky-cta'] button, .btn-primary, .btn-secondary",
      ),
    );
    const fails: string[] = [];
    for (const el of nodes) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 8) continue;
      if (r.height < 44 - 0.5 || r.width < 44 - 0.5) {
        const label = (el.getAttribute("aria-label") || el.textContent || el.tagName)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 40);
        fails.push(`${label} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return fails;
  });
  checks.push({
    name: "targets-44",
    pass: smallTargets.length === 0,
    detail: smallTargets.length ? smallTargets.slice(0, 6).join("; ") : "ok",
  });

  return checks;
}

async function shot(
  context: BrowserContext,
  route: string,
  width: number,
  opts: { isShop: boolean; isFicha: boolean; fileBase: string },
): Promise<{ file: string; checks: Check[] }> {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: viewportHeight(width) });
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(400);
  const checks = await runChecks(page, { width, isShop: opts.isShop, isFicha: opts.isFicha });
  const dir = path.join(ROOT, "reports", "responsive");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${opts.fileBase}-${width}.png`);
  await page.screenshot({ path: file, fullPage: false });
  await page.close();
  return { file, checks };
}

async function main() {
  const password = requireEnv("DEMO_PASSWORD");
  await waitForServer();

  const browser = await chromium.launch({ headless: true });
  const rows: string[] = [];
  let fails = 0;

  const customerCtx = await browser.newContext();
  const customerPage = await customerCtx.newPage();
  await login(customerPage, CUSTOMER_EMAIL, password);
  const productHref = await firstProductHref(customerPage);
  const productSlug = productHref.replace("/catalogo/", "").split("?")[0];
  await customerPage.close();

  const shopRoutes: { route: string; fileBase: string; isFicha: boolean }[] = [
    { route: "/", fileBase: "home", isFicha: false },
    { route: "/catalogo", fileBase: "catalogo", isFicha: false },
    { route: productHref, fileBase: `catalogo-${productSlug}`, isFicha: true },
    { route: "/carrito", fileBase: "carrito", isFicha: false },
    { route: "/mis-pedidos", fileBase: "mis-pedidos", isFicha: false },
    { route: "/cuenta", fileBase: "cuenta", isFicha: false },
  ];

  for (const item of shopRoutes) {
    for (const bp of BREAKPOINTS) {
      const { file, checks } = await shot(customerCtx, item.route, bp, {
        isShop: true,
        isFicha: item.isFicha,
        fileBase: item.fileBase,
      });
      const overall = checks.every((c) => c.pass);
      if (!overall) fails += 1;
      const checkCell = checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} (${c.detail})`).join("<br>");
      rows.push(
        `| ${item.route} | ${bp} | ${overall ? "PASS" : "FAIL"} | ${path.relative(ROOT, file).replaceAll("\\", "/")} | ${checkCell} |`,
      );
    }
  }
  await customerCtx.close();

  const staffCtx = await browser.newContext();
  const staffPage = await staffCtx.newPage();
  await login(staffPage, STAFF_EMAIL, password);
  await staffPage.close();

  for (const route of ["/gestion", "/gestion/pedidos"] as const) {
    for (const bp of BREAKPOINTS) {
      const { file, checks } = await shot(staffCtx, route, bp, {
        isShop: false,
        isFicha: false,
        fileBase: slugifyRoute(route),
      });
      const overall = checks.every((c) => c.pass);
      if (!overall) fails += 1;
      const checkCell = checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} (${c.detail})`).join("<br>");
      rows.push(
        `| ${route} | ${bp} | ${overall ? "PASS" : "FAIL"} | ${path.relative(ROOT, file).replaceAll("\\", "/")} | ${checkCell} |`,
      );
    }
  }
  await staffCtx.close();
  await browser.close();

  const md = [
    "# Matriz responsive (Playwright)",
    "",
    `- Base URL: \`${BASE_URL}\``,
    `- Ficha usada: \`${productHref}\``,
    `- Breakpoints: ${BREAKPOINTS.join(", ")}`,
    `- Combos FAIL: **${fails}** / ${rows.length}`,
    "",
    "| Ruta | bp | Overall | Screenshot | Checks |",
    "|---|---:|---|---|---|",
    ...rows,
    "",
  ].join("\n");

  const out = path.join(ROOT, "reports", "responsive", "summary.md");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, md, "utf8");
  console.log(md);
  if (fails > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
