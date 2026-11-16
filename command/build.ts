#!/usr/bin/env bun
/**
 * Build orchestration script.
 *
 * 1. Bundle construct source (ESM, external CDK deps), including src/artifacts.json
 * 2. Generate .d.ts declaration files
 * 3. Bundle the `bun-lambda-runtime` CLI (dist/cli.js) and ship the runtime source
 *    (dist/runtime.mts) it compiles into the layer
 *
 * The layer zip is NOT part of the package. Build it with `bun run build:layer`
 * (used by the release workflow and by `bun-lambda-runtime build-layer`).
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const distDir = join(projectRoot, "dist");

async function main(): Promise<void> {
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  await bundleSource();
  await generateDeclarations();
  await bundleCli();

  console.log("\nBuild complete. Output in dist/");
}

async function bundleSource(): Promise<void> {
  console.log("\n=== Bundling construct source ===");
  const result = await Bun.build({
    entrypoints: [join(projectRoot, "src/index.ts")],
    outdir: distDir,
    target: "node",
    external: ["aws-cdk-lib", "constructs"],
    format: "esm",
  });

  if (!result.success) {
    const errors = result.logs
      .filter((log) => log.level === "error")
      .map((log) => log.message)
      .join("\n");
    console.error(`Bundle failed: ${errors || "unknown error"}`);
    process.exit(1);
  }

  console.log("Bundled src/index.ts → dist/index.js");
}

async function bundleCli(): Promise<void> {
  console.log("\n=== Bundling CLI ===");
  const bunVersion = readFileSync(join(projectRoot, "src/index.ts"), "utf8").match(
    /const bunVersion = "([^"]+)"/,
  )?.[1];
  if (bunVersion == null) {
    console.error("Could not read bunVersion from src/index.ts.");
    process.exit(1);
  }

  const result = await Bun.build({
    entrypoints: [join(projectRoot, "command/cli.ts")],
    outdir: distDir,
    target: "bun",
    format: "esm",
    define: { __BUN_VERSION__: JSON.stringify(bunVersion) },
  });

  if (!result.success) {
    const errors = result.logs
      .filter((log) => log.level === "error")
      .map((log) => log.message)
      .join("\n");
    console.error(`CLI bundle failed: ${errors || "unknown error"}`);
    process.exit(1);
  }

  copyFileSync(join(projectRoot, "command/runtime.mts"), join(distDir, "runtime.mts"));
  console.log("Bundled command/cli.ts → dist/cli.js, copied runtime.mts");
}

async function generateDeclarations(): Promise<void> {
  console.log("\n=== Generating declarations ===");
  const proc = Bun.spawnSync(["bunx", "tsc", "--emitDeclarationOnly", "--outDir", distDir], {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (proc.exitCode !== 0) {
    console.error("Declaration generation failed.");
    process.exit(1);
  }

  console.log("Generated dist/index.d.ts");
}

await main();
