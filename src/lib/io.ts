import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  MAX_RETRIES,
  RATE_LIMIT_MS,
  REQUEST_TIMEOUT_MS,
  USER_AGENT,
} from "../config.js";

let lastRequestAt = 0;

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function writeText(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, data, "utf8");
}

export function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function contentHash(obj: unknown): string {
  const canonical = JSON.stringify(obj);
  return sha256(canonical);
}

export function newId(): string {
  return randomUUID();
}

export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function absoluteUrl(base: string, maybeRelative: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

export function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return url.split("?")[0] ?? url;
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

export type FetchResult = {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: Buffer;
  contentType: string | null;
  error?: string;
};

export async function fetchWithRetry(
  url: string,
  options: { method?: string; accept?: string } = {},
): Promise<FetchResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await rateLimit();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(url, {
        method: options.method ?? "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: options.accept ?? "*/*",
        },
      });
      clearTimeout(timer);
      const body = Buffer.from(await res.arrayBuffer());
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k] = v;
      });
      return {
        url,
        finalUrl: res.url,
        status: res.status,
        ok: res.ok,
        headers,
        body,
        contentType: res.headers.get("content-type"),
      };
    } catch (err) {
      lastError = err;
      const backoff = Math.min(10_000, 500 * 2 ** attempt);
      await sleep(backoff);
    }
  }
  return {
    url,
    finalUrl: url,
    status: 0,
    ok: false,
    headers: {},
    body: Buffer.alloc(0),
    contentType: null,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

export async function downloadFile(
  url: string,
  destPath: string,
  options: { skipIfExists?: boolean } = {},
): Promise<{
  ok: boolean;
  skipped: boolean;
  status: number;
  bytes: number;
  checksum?: string;
  error?: string;
  contentType?: string | null;
}> {
  if (options.skipIfExists !== false && (await pathExists(destPath))) {
    const existing = await fs.readFile(destPath);
    return {
      ok: true,
      skipped: true,
      status: 200,
      bytes: existing.length,
      checksum: sha256(existing),
    };
  }

  const result = await fetchWithRetry(url);
  if (!result.ok) {
    return {
      ok: false,
      skipped: false,
      status: result.status,
      bytes: 0,
      error: result.error ?? `HTTP ${result.status}`,
      contentType: result.contentType,
    };
  }

  await ensureDir(path.dirname(destPath));
  await fs.writeFile(destPath, result.body);
  return {
    ok: true,
    skipped: false,
    status: result.status,
    bytes: result.body.length,
    checksum: sha256(result.body),
    contentType: result.contentType,
  };
}

export async function streamDownload(
  url: string,
  destPath: string,
): Promise<void> {
  const result = await fetchWithRetry(url);
  if (!result.ok) throw new Error(result.error ?? `HTTP ${result.status}`);
  await ensureDir(path.dirname(destPath));
  const readable = Readable.from(result.body);
  await pipeline(readable, createWriteStream(destPath));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function log(step: string, message: string, extra?: unknown): void {
  const suffix = extra === undefined ? "" : ` ${JSON.stringify(extra)}`;
  console.log(`[${nowIso()}] [${step}] ${message}${suffix}`);
}
