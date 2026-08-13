import { spawn } from "node:child_process";
import path from "node:path";
import { ROOT } from "../src/config.js";
import { log } from "../src/lib/io.js";

function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return new Promise<void>((resolve, reject) => {
    log("all", `${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function main() {
  const npx = "npx";
  const tsx = "tsx";
  await run(npx, [tsx, "scripts/discover.ts"]);
  await run(npx, [tsx, "scripts/crawl.ts"]);
  await run(npx, [tsx, "scripts/extract.ts"]);
  await run(npx, [tsx, "scripts/normalize.ts"]);
  await run(npx, [tsx, "scripts/download-media.ts"]);
  await run(npx, [tsx, "scripts/validate.ts"]);
  await run(npx, [tsx, "scripts/export-supabase.ts"]);
  log("all", "Pipeline complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
