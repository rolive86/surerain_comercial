import path from "node:path";
import * as cheerio from "cheerio";
import { writeFile } from "node:fs/promises";
import { BASE_URL, PATHS, SITE_PAGES } from "../src/config.js";
import {
  absoluteUrl,
  ensureDir,
  fetchWithRetry,
  log,
  nowIso,
  pathExists,
  readJson,
  stripQuery,
  writeJson,
  writeText,
} from "../src/lib/io.js";

type CrawlState = {
  visited: string[];
  downloaded: string[];
  failed: Array<{ url: string; status: number; error?: string }>;
  assets_queued: string[];
  updated_at: string;
};

const STATE_PATH = path.join(PATHS.checkpoints, "crawl-state.json");

function toLocalPath(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.hostname !== "surerain.com" && u.hostname !== "www.surerain.com") {
    return null;
  }
  let p = decodeURIComponent(u.pathname);
  if (p === "/" || p === "") p = "/index.html";
  if (p.endsWith("/")) p += "index.html";

  const hasExt = /\.[a-z0-9]+$/i.test(p);
  if (!hasExt) p = `${p}.html`;

  if (p.startsWith("/assets/")) {
    return path.join(PATHS.originalAssets, p.replace(/^\/assets\//, ""));
  }
  if (p.endsWith(".css")) {
    return path.join(PATHS.originalCss, path.basename(p));
  }
  if (p.endsWith(".js")) {
    return path.join(PATHS.originalJs, path.basename(p));
  }
  if (/\.html?$/i.test(p)) {
    return path.join(PATHS.originalHtml, path.basename(p) || "index.html");
  }
  return path.join(PATHS.originalAssets, p.replace(/^\//, ""));
}

function extractLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $(
    "a[href], link[href], script[src], img[src], source[src], source[srcset], img[srcset]",
  ).each((_, el) => {
    const href = $(el).attr("href") || $(el).attr("src") || "";
    const srcset = $(el).attr("srcset") || "";
    if (
      href &&
      !href.startsWith("javascript:") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("tel:") &&
      !href.startsWith("#")
    ) {
      urls.add(stripQuery(absoluteUrl(pageUrl, href)));
    }
    if (srcset) {
      for (const part of srcset.split(",")) {
        const u = part.trim().split(/\s+/)[0];
        if (u) urls.add(stripQuery(absoluteUrl(pageUrl, u)));
      }
    }
  });
  $("[data-ficha]").each((_, el) => {
    const f = $(el).attr("data-ficha");
    if (f) urls.add(stripQuery(absoluteUrl(pageUrl, f)));
  });
  return [...urls];
}

function isInScope(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname !== "surerain.com" && u.hostname !== "www.surerain.com") {
      return false;
    }
    if (
      /^\/(shop|productos|sistema-riego|blog|nuevo-sitio-web|insumos-para-riego|sistemas-de-riego-eficientes)(\/|$)/i.test(
        u.pathname,
      )
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  log("crawl", "Starting offline mirror crawl (static site)");
  await ensureDir(PATHS.originalHtml);
  await ensureDir(PATHS.originalCss);
  await ensureDir(PATHS.originalJs);
  await ensureDir(PATHS.originalAssets);
  await ensureDir(PATHS.checkpoints);
  await ensureDir(PATHS.reports);

  const previous = (await readJson<CrawlState>(STATE_PATH)) ?? {
    visited: [],
    downloaded: [],
    failed: [],
    assets_queued: [],
    updated_at: nowIso(),
  };

  const visited = new Set(previous.visited);
  const downloaded = new Set(previous.downloaded);
  const failed: CrawlState["failed"] = [...previous.failed];
  const queue: string[] = [];

  for (const p of SITE_PAGES) queue.push(`${BASE_URL}${p}`);
  queue.push(`${BASE_URL}/catalogo`);
  queue.push(`${BASE_URL}/robots.txt`);

  for (const a of previous.assets_queued) {
    if (!downloaded.has(a)) queue.push(a);
  }

  const assetsQueued = new Set(previous.assets_queued);

  while (queue.length) {
    const url = queue.shift()!;
    if (!isInScope(url)) continue;
    const key = stripQuery(url);
    if (visited.has(key) && downloaded.has(key)) continue;
    visited.add(key);

    const local = toLocalPath(key);
    if (!local) continue;

    if (downloaded.has(key) && (await pathExists(local))) continue;

    log("crawl", `GET ${key}`);
    const res = await fetchWithRetry(key);
    if (!res.ok) {
      failed.push({ url: key, status: res.status, error: res.error });
      log("crawl", `FAIL ${key}`, { status: res.status });
      continue;
    }

    await ensureDir(path.dirname(local));
    await writeFile(local, res.body);
    downloaded.add(key);

    const ct = res.contentType || "";
    if (ct.includes("text/html") || /\.html?$/i.test(local)) {
      const html = res.body.toString("utf8");
      const links = extractLinks(html, res.finalUrl || key);
      for (const link of links) {
        if (!isInScope(link)) continue;
        const clean = stripQuery(link);
        assetsQueued.add(clean);
        if (!visited.has(clean) && !downloaded.has(clean)) queue.push(clean);
      }
    }

    if (downloaded.size % 25 === 0) {
      const state: CrawlState = {
        visited: [...visited],
        downloaded: [...downloaded],
        failed,
        assets_queued: [...assetsQueued],
        updated_at: nowIso(),
      };
      await writeJson(STATE_PATH, state);
    }
  }

  const robots = await fetchWithRetry(`${BASE_URL}/robots.txt`);
  if (robots.ok) {
    await writeText(
      path.join(PATHS.original, "robots.txt"),
      robots.body.toString("utf8"),
    );
  }

  const state: CrawlState = {
    visited: [...visited],
    downloaded: [...downloaded],
    failed,
    assets_queued: [...assetsQueued],
    updated_at: nowIso(),
  };
  await writeJson(STATE_PATH, state);

  const report = {
    generated_at: nowIso(),
    visited: visited.size,
    downloaded: downloaded.size,
    failed: failed.length,
    failed_sample: failed.slice(0, 50),
    note: "Offline mirror of public static pages/assets. Product media also downloaded by download-media.ts into /media.",
  };
  await writeJson(path.join(PATHS.reports, "crawl-report.json"), report);
  log("crawl", "Crawl complete", report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
