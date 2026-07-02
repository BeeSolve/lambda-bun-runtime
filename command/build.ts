#!/usr/bin/env bun
/**
 * Build orchestration script.
 *
 * 1. Build the Lambda layer zip (downloads Bun binary, compiles runtime)
 * 2. Bundle construct source (ESM, external CDK deps)
 * 3. Generate .d.ts declaration files
 * 4. Copy layer zip into dist/ so it's included in the published package
 */

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

import { Glob } from "bun";

const projectRoot = resolve(import.meta.dir, "..");
const distDir = join(projectRoot, "dist");

async function main(): Promise<void> {
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  await buildLayer();
  await bundleSource();
  await generateDeclarations();
  copyLayerZip();

  console.log("\nBuild complete. Output in dist/");
}

async function buildLayer(): Promise<void> {
  console.log("=== Building Lambda layer ===");
  const proc = Bun.spawnSync(["bun", join(projectRoot, "command/buildLayer.ts")], {
    cwd: projectRoot,
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (proc.exitCode !== 0) {
    console.error("Layer build failed.");
    process.exit(1);
  }
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

function copyLayerZip(): void {
  console.log("\n=== Copying layer zip to dist ===");
  const libDir = join(projectRoot, "lib");
  const glob = new Glob("bun-lambda-layer-*.zip");

  for (const match of glob.scanSync({ cwd: libDir, absolute: true })) {
    const filename = match.split("/").at(-1) ?? "";
    const destPath = join(distDir, filename);
    cpSync(match, destPath);
    console.log(`Copied ${match} → ${destPath}`);
  }
}

await main();
