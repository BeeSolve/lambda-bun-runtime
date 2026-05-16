#!/usr/bin/env bun
/**
 * Build Layer Script
 *
 * Downloads the Bun binary from GitHub releases, compiles the runtime,
 * and packages everything into a Lambda layer zip file.
 *
 * Usage:
 *   bun command/buildLayer.ts [version]
 *
 * Version can be provided as:
 *   1. CLI argument (takes precedence)
 *   2. BUN_VERSION environment variable
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Glob } from "bun";

// --- Version Resolution ---

function resolveVersion(): string {
  const cliArg = process.argv[2];
  const envVar = process.env.BUN_VERSION;

  const version = cliArg ?? envVar;

  if (!version) {
    console.error(
      "No Bun version specified. Set BUN_VERSION or pass as argument.",
    );
    process.exit(1);
  }

  return version;
}

// --- Version Validation ---

function validateVersion(version: string): void {
  // Pattern: positive_integer.non_negative_integer.non_negative_integer
  const semverPattern = /^([1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

  if (!semverPattern.test(version)) {
    console.error(
      `Invalid version format: ${version}. Expected semver (e.g., 1.3.13).`,
    );
    process.exit(1);
  }
}

// --- Download ---

async function downloadBunBinary(version: string, tmpDir: string): Promise<string> {
  const url = `https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-linux-aarch64.zip`;

  console.log(`Downloading Bun v${version} from ${url}...`);

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to download Bun v${version}: ${message}`);
    process.exit(1);
  }

  if (!response.ok) {
    if (response.status === 404) {
      console.error(`Failed to download Bun v${version}: release not found.`);
    } else {
      console.error(
        `Failed to download Bun v${version}: HTTP ${response.status} ${response.statusText}`,
      );
    }
    process.exit(1);
  }

  const zipPath = join(tmpDir, "bun-linux-aarch64.zip");
  const arrayBuffer = await response.arrayBuffer();
  await Bun.write(zipPath, arrayBuffer);

  return zipPath;
}

// --- Extract ---

async function extractBunBinary(zipPath: string, tmpDir: string): Promise<string> {
  console.log("Extracting Bun binary...");

  const proc = Bun.spawnSync(["unzip", "-o", zipPath, "-d", tmpDir]);

  if (proc.exitCode !== 0) {
    console.error(
      `Failed to extract Bun binary: ${proc.stderr.toString().trim()}`,
    );
    process.exit(1);
  }

  // The archive contains a directory like bun-linux-aarch64/bun
  const glob = new Glob("**/bun");
  const extractDir = tmpDir;
  for await (const match of glob.scan({ cwd: extractDir, absolute: true })) {
    // Skip .zip files, find the actual binary
    if (!match.endsWith(".zip")) {
      return match;
    }
  }

  console.error("Failed to extract Bun binary: bun executable not found in archive.");
  process.exit(1);
}

// --- Compile Runtime ---

async function compileRuntime(tmpDir: string): Promise<string> {
  console.log("Compiling runtime...");

  const runtimeSource = resolve(import.meta.dir, "runtime.mts");
  const outDir = join(tmpDir, "compiled");
  mkdirSync(outDir, { recursive: true });

  const result = await Bun.build({
    entrypoints: [runtimeSource],
    outdir: outDir,
    target: "bun",
    minify: true,
    naming: "runtime.js",
  });

  if (!result.success) {
    const errors = result.logs
      .filter((log) => log.level === "error")
      .map((log) => log.message)
      .join("\n");
    console.error(`Failed to compile runtime.ts: ${errors || "unknown error"}`);
    process.exit(1);
  }

  const outputPath = join(outDir, "runtime.js");
  if (!existsSync(outputPath)) {
    console.error("Failed to compile runtime.ts: output file not produced.");
    process.exit(1);
  }

  return outputPath;
}

// --- Generate Bootstrap ---

function generateBootstrap(tmpDir: string): string {
  const bootstrapContent = "#!/bin/sh\nexec /opt/bun /opt/runtime.js\n";
  const bootstrapPath = join(tmpDir, "bootstrap");
  writeFileSync(bootstrapPath, bootstrapContent, { mode: 0o755 });
  return bootstrapPath;
}

// --- Package Zip ---

async function createLayerZip(
  version: string,
  bunBinaryPath: string,
  runtimePath: string,
  bootstrapPath: string,
): Promise<string> {
  console.log("Creating layer zip...");

  const libDir = resolve(import.meta.dir, "..", "lib");
  mkdirSync(libDir, { recursive: true });

  const outputZip = join(libDir, `bun-lambda-layer-${version}.zip`);

  // Remove existing zip if present
  if (existsSync(outputZip)) {
    rmSync(outputZip);
  }

  // Create a staging directory with files at root level
  const stageDir = join(resolve(import.meta.dir, "..", ".build-tmp"), "stage");
  mkdirSync(stageDir, { recursive: true });

  // Copy files to staging with correct names at root level
  const cpBun = Bun.spawnSync(["cp", bunBinaryPath, join(stageDir, "bun")]);
  if (cpBun.exitCode !== 0) {
    console.error(`Failed to create layer zip: could not copy bun binary`);
    process.exit(1);
  }

  const cpRuntime = Bun.spawnSync(["cp", runtimePath, join(stageDir, "runtime.js")]);
  if (cpRuntime.exitCode !== 0) {
    console.error(`Failed to create layer zip: could not copy runtime.js`);
    process.exit(1);
  }

  const cpBootstrap = Bun.spawnSync(["cp", bootstrapPath, join(stageDir, "bootstrap")]);
  if (cpBootstrap.exitCode !== 0) {
    console.error(`Failed to create layer zip: could not copy bootstrap`);
    process.exit(1);
  }

  // Ensure bun and bootstrap are executable
  Bun.spawnSync(["chmod", "+x", join(stageDir, "bun")]);
  Bun.spawnSync(["chmod", "+x", join(stageDir, "bootstrap")]);

  // Create zip with files at root level (using -j to junk paths)
  const zipProc = Bun.spawnSync(
    ["zip", "-j", outputZip, "bootstrap", "bun", "runtime.js"],
    { cwd: stageDir },
  );

  if (zipProc.exitCode !== 0) {
    console.error(
      `Failed to create layer zip: ${zipProc.stderr.toString().trim()}`,
    );
    process.exit(1);
  }

  // Clean up staging directory
  rmSync(resolve(import.meta.dir, "..", ".build-tmp"), { recursive: true, force: true });

  return outputZip;
}

// --- Main ---

async function main(): Promise<void> {
  const version = resolveVersion();
  validateVersion(version);

  // Create temp directory for build artifacts
  const tmpDir = join(resolve(import.meta.dir, "..", ".build-tmp"), "layer-build");
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  mkdirSync(tmpDir, { recursive: true });

  try {
    const zipPath = await downloadBunBinary(version, tmpDir);
    const bunBinaryPath = await extractBunBinary(zipPath, tmpDir);
    const runtimePath = await compileRuntime(tmpDir);
    const bootstrapPath = generateBootstrap(tmpDir);
    const outputZip = await createLayerZip(
      version,
      bunBinaryPath,
      runtimePath,
      bootstrapPath,
    );

    console.log(`\nLayer built successfully: ${outputZip}`);
  } finally {
    // Clean up temp directory
    rmSync(resolve(import.meta.dir, "..", ".build-tmp"), { recursive: true, force: true });
  }
}

main();
