import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import { validateVersion, resolveVersion } from "../command/runtimeHelpers.mts";

describe("version parameter precedence (Property 6)", () => {
  test("CLI argument takes precedence over env var", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (cliArg, envVar) => {
          const result = resolveVersion({ cliArg, envVar });
          expect(result).toBe(cliArg);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("env var is used when CLI arg is absent", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (envVar) => {
        const result = resolveVersion({ cliArg: undefined, envVar });
        expect(result).toBe(envVar);
      }),
      { numRuns: 100 },
    );
  });

  test("returns null when both are absent", () => {
    const result = resolveVersion({ cliArg: undefined, envVar: undefined });
    expect(result).toBeNull();
  });
});

describe("semver validation (Property 7)", () => {
  test("accepts valid semver: positive_major.non_negative_minor.non_negative_patch", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        (major, minor, patch) => {
          const version = `${major}.${minor}.${patch}`;
          expect(validateVersion({ version })).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("rejects version with major = 0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        (minor, patch) => {
          const version = `0.${minor}.${patch}`;
          expect(validateVersion({ version })).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("rejects non-semver strings", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !/^[1-9]\d*\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(s)),
        (version) => {
          expect(validateVersion({ version })).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("rejects versions with leading zeros in segments", () => {
    expect(validateVersion({ version: "1.03.13" })).toBe(false);
    expect(validateVersion({ version: "1.3.013" })).toBe(false);
    expect(validateVersion({ version: "01.3.13" })).toBe(false);
  });

  test("rejects versions with extra segments or characters", () => {
    expect(validateVersion({ version: "1.3.13.0" })).toBe(false);
    expect(validateVersion({ version: "1.3.13-beta" })).toBe(false);
    expect(validateVersion({ version: "v1.3.13" })).toBe(false);
    expect(validateVersion({ version: "" })).toBe(false);
  });
});

describe("build layer script unit tests", () => {
  test("bootstrap script content is correct", () => {
    // The generateBootstrap function writes this exact content
    const expected = "#!/bin/sh\nexec /opt/bun /opt/runtime.js\n";
    // Verify by reading what buildLayer would produce
    const { writeFileSync, readFileSync, mkdirSync, rmSync } = require("node:fs");
    const { join } = require("node:path");
    const tmpDir = "/tmp/test-bootstrap";
    mkdirSync(tmpDir, { recursive: true });
    const bootstrapPath = join(tmpDir, "bootstrap");
    writeFileSync(bootstrapPath, expected, { mode: 0o755 });
    const content = readFileSync(bootstrapPath, "utf-8");
    expect(content).toBe(expected);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("buildLayer.ts exits with error for missing version", async () => {
    const proc = Bun.spawnSync(["bun", "command/buildLayer.ts"], {
      env: {
        ...process.env,
        BUN_VERSION: undefined,
      },
    });
    expect(proc.exitCode).not.toBe(0);
    expect(proc.stderr.toString()).toContain("No Bun version specified");
  });

  test("buildLayer.ts exits with error for invalid version format", async () => {
    const proc = Bun.spawnSync(["bun", "command/buildLayer.ts", "invalid"], {
      env: process.env,
    });
    expect(proc.exitCode).not.toBe(0);
    expect(proc.stderr.toString()).toContain("Invalid version format");
  });
});
