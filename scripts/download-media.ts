import path from "node:path";
import { PATHS, ROOT } from "../src/config.js";
import {
  downloadFile,
  ensureDir,
  log,
  nowIso,
  readJson,
  writeJson,
} from "../src/lib/io.js";
import type { MediaRecord, NormalizedDataset } from "../src/types.js";

type DownloadState = {
  completed: Record<string, { checksum: string; bytes: number; local_path: string }>;
  failed: Array<{ url: string; error: string; status: number }>;
  updated_at: string;
};

const STATE_PATH = path.join(PATHS.checkpoints, "download-media-state.json");

async function main() {
  log("download-media", "Downloading product images and technical sheets");
  await ensureDir(PATHS.mediaProducts);
  await ensureDir(PATHS.mediaDocuments);
  await ensureDir(PATHS.checkpoints);
  await ensureDir(PATHS.reports);

  const dataset = await readJson<NormalizedDataset>(
    path.join(PATHS.dataNormalized, "dataset.json"),
  );
  if (!dataset) {
    throw new Error("Missing normalized dataset — run npm run normalize first");
  }

  const state = (await readJson<DownloadState>(STATE_PATH)) ?? {
    completed: {},
    failed: [],
    updated_at: nowIso(),
  };

  const updatedMedia: MediaRecord[] = [];
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  // Deduplicate by original_url
  const byUrl = new Map<string, MediaRecord>();
  for (const m of dataset.media) {
    if (!byUrl.has(m.original_url)) byUrl.set(m.original_url, m);
  }

  for (const media of byUrl.values()) {
    const dest = path.join(ROOT, media.local_path || path.join("media", media.filename));
    const prev = state.completed[media.original_url];

    const result = await downloadFile(media.original_url, dest, {
      skipIfExists: true,
    });

    if (result.ok) {
      if (result.skipped) skipped++;
      else downloaded++;
      state.completed[media.original_url] = {
        checksum: result.checksum!,
        bytes: result.bytes,
        local_path: media.local_path || dest,
      };
      updatedMedia.push({
        ...media,
        file_size: result.bytes,
        checksum: result.checksum ?? null,
        mime_type: media.mime_type ?? result.contentType ?? null,
        download_status: "downloaded",
      });
      // Also mirror into original/assets when URL is under /assets/
      try {
        const u = new URL(media.original_url);
        if (u.pathname.startsWith("/assets/")) {
          const mirror = path.join(
            PATHS.originalAssets,
            u.pathname.replace(/^\/assets\//, ""),
          );
          await downloadFile(media.original_url, mirror, { skipIfExists: true });
        }
      } catch {
        /* ignore */
      }
    } else {
      failed++;
      state.failed.push({
        url: media.original_url,
        error: result.error ?? "unknown",
        status: result.status,
      });
      updatedMedia.push({
        ...media,
        download_status: "failed",
        error: result.error,
      });
      log("download-media", `FAIL ${media.original_url}`, {
        status: result.status,
      });
    }

    if ((downloaded + skipped + failed) % 40 === 0) {
      state.updated_at = nowIso();
      await writeJson(STATE_PATH, state);
      log("download-media", "progress", {
        downloaded,
        skipped,
        failed,
        total: byUrl.size,
      });
    }
  }

  // Merge media status back
  const statusByUrl = new Map(updatedMedia.map((m) => [m.original_url, m]));
  dataset.media = dataset.media.map((m) => statusByUrl.get(m.original_url) ?? m);
  for (const doc of dataset.documents) {
    const st = statusByUrl.get(doc.original_url);
    if (st) {
      doc.checksum = st.checksum;
      doc.mime_type = st.mime_type ?? doc.mime_type;
    }
  }

  await writeJson(path.join(PATHS.dataNormalized, "dataset.json"), dataset);
  await writeJson(path.join(PATHS.dataNormalized, "media.json"), dataset.media);
  await writeJson(path.join(PATHS.dataNormalized, "documents.json"), dataset.documents);

  // Checksum duplicate report
  const byChecksum = new Map<string, string[]>();
  for (const m of dataset.media) {
    if (!m.checksum) continue;
    if (!byChecksum.has(m.checksum)) byChecksum.set(m.checksum, []);
    byChecksum.get(m.checksum)!.push(m.original_url);
  }
  const duplicates = [...byChecksum.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([checksum, urls]) => ({ checksum, urls }));

  state.updated_at = nowIso();
  await writeJson(STATE_PATH, state);

  const missingAssets = dataset.media
    .filter((m) => m.download_status === "failed")
    .map((m) => ({
      id: m.id,
      original_url: m.original_url,
      error: m.error,
    }));
  await writeJson(path.join(PATHS.reports, "missing-assets.json"), {
    generated_at: nowIso(),
    count: missingAssets.length,
    items: missingAssets,
  });

  await writeJson(path.join(PATHS.reports, "download-media-report.json"), {
    generated_at: nowIso(),
    total: byUrl.size,
    downloaded,
    skipped,
    failed,
    checksum_duplicates: duplicates.length,
    duplicates_sample: duplicates.slice(0, 20),
  });

  log("download-media", "Done", { downloaded, skipped, failed });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
