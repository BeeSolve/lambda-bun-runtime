/**
 * Downloads the Bun binary from GitHub releases, compiles the runtime,
 * and packages everything into a Lambda layer zip file.
 *
 * Usage:
 *   bun command/buildLayer.ts [version] [--out <dir>]   (thin wrapper around this module)
 *   bun-lambda-runtime build-layer [version] [--out <dir>]   (installed package)
 *
 * Version can be provided as:
 *   1. CLI argument (takes precedence)
 *   2. BUN_VERSION environment variable
 *   3. The Bun version this package was built for
 *
 * The zip is written to --out (default: ./lib in the repository, the current
 * directory when run from the installed package).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Glob } from "bun";

// Replaced at package build time (see command/build.ts). Undefined in the repository.
declare const __BUN_VERSION__: string | undefined;

export async function buildLayerCommand(argv: ReadonlyArray<string>): Promise<void> {
  const args = parseArgs({ argv });
  const version = resolveVersion({ cliVersion: args.version });
  validateVersion({ version });

  const tmpDir = mkdtempSync(join(tmpdir(), "bun-layer-"));

  try {
    const zipPath = await downloadBunBinary({ version, tmpDir });
    const bunBinaryPath = await extractBunBinary({ zipPath, tmpDir });
    const runtimePath = await compileRuntime({ tmpDir });
    const bootstrapPath = generateBootstrap({ tmpDir });
    const outputZip = await createLayerZip({
      version,
      bunBinaryPath,
      runtimePath,
      bootstrapPath,
      tmpDir,
      outDir: args.outDir ?? defaultOutDir(),
    });

    console.log(`\nLayer built successfully: ${outputZip}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function parseArgs(props: { argv: ReadonlyArray<string> }): { version?: string; outDir?: string } {
  const positional: Array<string> = [];
  let outDir: string | undefined;
  for (let index = 0; index < props.argv.length; index++) {
    const arg = props.argv[index];
    if (arg === "--out") {
      outDir = props.argv[index + 1];
      if (outDir == null) {
        console.error("--out needs a directory.");
        process.exit(1);
      }
      index++;
      continue;
    }
    positional.push(arg);
  }
  return { version: positional[0], outDir: outDir == null ? undefined : resolve(outDir) };
}

function isRepositoryLayout(): boolean {
  return existsSync(resolve(import.meta.dir, "..", "src", "index.ts"));
}

function defaultOutDir(): string {
  return isRepositoryLayout() ? resolve(import.meta.dir, "..", "lib") : process.cwd();
}

export function resolveVersion(props: { cliVersion?: string }): string {
  if (props.cliVersion != null) return props.cliVersion;
  const envVar = process.env.BUN_VERSION;
  if (envVar != null) return envVar;
  if (typeof __BUN_VERSION__ !== "undefined") return __BUN_VERSION__;

  const srcPath = resolve(import.meta.dir, "..", "src", "index.ts");
  if (existsSync(srcPath)) {
    const match = readFileSync(srcPath, "utf8").match(/const bunVersion = "([^"]+)"/);
    if (match) return match[1];
  }

  console.error(
    "No Bun version specified. Set BUN_VERSION, pass as argument, or define bunVersion in src/index.ts.",
  );
  process.exit(1);
}

export function validateVersion(props: { version: string }): void {
  const semverPattern = /^([1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

  if (!semverPattern.test(props.version)) {
    console.error(`Invalid version format: ${props.version}. Expected semver (e.g., 1.3.13).`);
    process.exit(1);
  }
}

export async function downloadBunBinary(props: {
  version: string;
  tmpDir: string;
}): Promise<string> {
  const url = `https://github.com/oven-sh/bun/releases/download/bun-v${props.version}/bun-linux-aarch64.zip`;

  console.log(`Downloading Bun v${props.version} from ${url}...`);

  const response = await fetch(url).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to download Bun v${props.version}: ${message}`);
    process.exit(1);
  });

  if (!response.ok) {
    if (response.status === 404) {
      console.error(`Failed to download Bun v${props.version}: release not found.`);
    } else {
      console.error(
        `Failed to download Bun v${props.version}: HTTP ${response.status} ${response.statusText}`,
      );
    }
    process.exit(1);
  }

  const zipPath = join(props.tmpDir, "bun-linux-aarch64.zip");
  const arrayBuffer = await response.arrayBuffer();
  await Bun.write(zipPath, arrayBuffer);

  return zipPath;
}

export async function extractBunBinary(props: {
  zipPath: string;
  tmpDir: string;
}): Promise<string> {
  console.log("Extracting Bun binary...");

  const proc = Bun.spawnSync(["unzip", "-o", props.zipPath, "-d", props.tmpDir]);

  if (proc.exitCode !== 0) {
    console.error(`Failed to extract Bun binary: ${proc.stderr.toString().trim()}`);
    process.exit(1);
  }

  const glob = new Glob("**/bun");
  for await (const match of glob.scan({ cwd: props.tmpDir, absolute: true })) {
    if (!match.endsWith(".zip")) {
      return match;
    }
  }

  console.error("Failed to extract Bun binary: bun executable not found in archive.");
  process.exit(1);
}

export async function compileRuntime(props: { tmpDir: string }): Promise<string> {
  console.log("Compiling runtime...");

  const runtimeSource = resolve(import.meta.dir, "runtime.mts");
  const outDir = join(props.tmpDir, "compiled");
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
    console.error(`Failed to compile runtime: ${errors || "unknown error"}`);
    process.exit(1);
  }

  const outputPath = join(outDir, "runtime.js");
  if (!existsSync(outputPath)) {
    console.error("Failed to compile runtime: output file not produced.");
    process.exit(1);
  }

  return outputPath;
}

function generateBootstrap(props: { tmpDir: string }): string {
  const bootstrapContent = "#!/bin/sh\nexec /opt/bun /opt/runtime.js\n";
  const bootstrapPath = join(props.tmpDir, "bootstrap");
  writeFileSync(bootstrapPath, bootstrapContent, { mode: 0o755 });
  return bootstrapPath;
}

async function createLayerZip(props: {
  version: string;
  bunBinaryPath: string;
  runtimePath: string;
  bootstrapPath: string;
  tmpDir: string;
  outDir: string;
}): Promise<string> {
  console.log("Creating layer zip...");

  mkdirSync(props.outDir, { recursive: true });

  // Remove any existing layer zips so only the current version is packaged
  const glob = new Glob("bun-lambda-layer-*.zip");
  for (const match of glob.scanSync({ cwd: props.outDir, absolute: true })) {
    rmSync(match);
  }

  const outputZip = join(props.outDir, `bun-lambda-layer-${props.version}.zip`);

  const stageDir = join(props.tmpDir, "stage");
  mkdirSync(stageDir, { recursive: true });

  const cpBun = Bun.spawnSync(["cp", props.bunBinaryPath, join(stageDir, "bun")]);
  if (cpBun.exitCode !== 0) {
    console.error("Failed to create layer zip: could not copy bun binary");
    process.exit(1);
  }

  const cpRuntime = Bun.spawnSync(["cp", props.runtimePath, join(stageDir, "runtime.js")]);
  if (cpRuntime.exitCode !== 0) {
    console.error("Failed to create layer zip: could not copy runtime.js");
    process.exit(1);
  }

  const cpBootstrap = Bun.spawnSync(["cp", props.bootstrapPath, join(stageDir, "bootstrap")]);
  if (cpBootstrap.exitCode !== 0) {
    console.error("Failed to create layer zip: could not copy bootstrap");
    process.exit(1);
  }

  Bun.spawnSync(["chmod", "+x", join(stageDir, "bun")]);
  Bun.spawnSync(["chmod", "+x", join(stageDir, "bootstrap")]);

  const zipProc = Bun.spawnSync(["zip", "-j", outputZip, "bootstrap", "bun", "runtime.js"], {
    cwd: stageDir,
  });

  if (zipProc.exitCode !== 0) {
    console.error(`Failed to create layer zip: ${zipProc.stderr.toString().trim()}`);
    process.exit(1);
  }

  return outputZip;
}
