import { describe, expect, test } from "bun:test";

function runCli(args: Array<string>): { output: string; exitCode: number } {
  const proc = Bun.spawnSync(["bun", "command/cli.ts", ...args]);
  return {
    output: proc.stdout.toString() + proc.stderr.toString(),
    exitCode: proc.exitCode ?? -1,
  };
}

describe("bun-lambda-runtime cli", () => {
  test("prints usage and exits 0 without a command", () => {
    const { output, exitCode } = runCli([]);
    expect(exitCode).toBe(0);
    expect(output).toContain("build-layer");
  });

  test("prints usage and exits 1 for an unknown command", () => {
    const { output, exitCode } = runCli(["nope"]);
    expect(exitCode).toBe(1);
    expect(output).toContain("Usage: bun-lambda-runtime");
  });

  test("build-layer rejects --out without a directory", () => {
    const { output, exitCode } = runCli(["build-layer", "1.0.999", "--out"]);
    expect(exitCode).toBe(1);
    expect(output).toContain("--out needs a directory");
  });

  test("build-layer uses the version argument (fails at download for a missing release)", () => {
    const { output, exitCode } = runCli(["build-layer", "1.0.999"]);
    expect(exitCode).toBe(1);
    expect(output).toContain("Bun v1.0.999");
  });
});
