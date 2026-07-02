import { describe, expect, test } from "bun:test";

describe("version parameter precedence (Property 6)", () => {
  // Uses non-existent versions that pass validation but 404 at download (fast failure)
  test("CLI argument takes precedence over env var", () => {
    const proc = Bun.spawnSync(["bun", "command/buildLayer.ts", "1.0.999"], {
      env: { ...process.env, BUN_VERSION: "9.9.999" },
    });
    const output = proc.stdout.toString() + proc.stderr.toString();
    expect(output).toContain("1.0.999");
    expect(output).not.toContain("9.9.999");
  });

  test("env var is used when CLI arg is absent", () => {
    const proc = Bun.spawnSync(["bun", "command/buildLayer.ts"], {
      env: { ...process.env, BUN_VERSION: "1.0.999" },
    });
    const output = proc.stdout.toString() + proc.stderr.toString();
    expect(output).toContain("1.0.999");
  });

  test("falls back to src/index.ts version when both are absent", () => {
    // The script resolves 1.3.14 from src/index.ts and starts downloading.
    // We don't wait for the full download — just verify it found the right version.
    // Use a fake non-downloadable version by temporarily patching would be complex,
    // so instead we rely on the output showing the resolved version.
    const proc = Bun.spawnSync(["bun", "command/buildLayer.ts"], {
      env: { ...process.env, BUN_VERSION: undefined },
      timeout: 3000,
    });
    const output = proc.stdout.toString() + proc.stderr.toString();
    // The script should print "Downloading Bun v1.3.14" proving it read src/index.ts
    expect(output).toContain("1.3.14");
  });
});

describe("semver validation (Property 7)", () => {
  test("accepts valid semver versions", () => {
    // Valid versions pass format validation — they fail at download (404), not at validation
    const validVersions = ["1.0.999", "2.5.999", "10.20.999"];
    for (const version of validVersions) {
      const proc = Bun.spawnSync(["bun", "command/buildLayer.ts", version], {
        env: process.env,
      });
      const stderr = proc.stderr.toString();
      expect(stderr).not.toContain("Invalid version format");
      // Should fail at download, not validation
      expect(stderr).toContain("release not found");
    }
  });

  test("rejects invalid version formats", () => {
    const invalidVersions = [
      "0.1.0", // major must be positive
      "1.03.13", // leading zeros
      "1.3.013", // leading zeros
      "01.3.13", // leading zeros
      "1.3.13.0", // extra segment
      "1.3.13-beta", // prerelease
      "v1.3.13", // prefix
      "abc", // not a version
      "", // empty
      "1.3", // missing patch
    ];

    for (const version of invalidVersions) {
      const proc = Bun.spawnSync(["bun", "command/buildLayer.ts", version], {
        env: process.env,
      });
      expect(proc.exitCode).not.toBe(0);
      expect(proc.stderr.toString()).toContain("Invalid version format");
    }
  });
});

describe("build layer script unit tests (Task 2.5)", () => {
  test("exits with error for invalid version format", () => {
    const proc = Bun.spawnSync(["bun", "command/buildLayer.ts", "invalid"], {
      env: process.env,
    });
    expect(proc.exitCode).not.toBe(0);
    expect(proc.stderr.toString()).toContain("Invalid version format");
  });
});
