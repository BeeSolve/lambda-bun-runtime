import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";

const runInteg = process.env.RUN_AWS_INTEG === "1";
const describeInteg = runInteg ? describe : describe.skip;

type StackOutputs = {
  RestApiUrl: string;
  FunctionUrl: string;
};

function run(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function runBestEffort(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): void {
  spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function assertCookieHeader(headers: Headers): void {
  const setCookie = headers.get("set-cookie") ?? "";
  expect(setCookie).toContain("it_cookie=server-set");
}

describeInteg("CDK deploy -> test -> destroy", () => {
  test("tests REST v1 and Function URL v2 with cookies", async () => {
    const rootDir = process.cwd();
    const sampleAppDir = join(rootDir, "examples", "sample-app");
    const suffix = Date.now().toString(36);
    const stackName = `BunLayerInteg-${suffix}`;
    const tempDir = mkdtempSync(join(tmpdir(), "bun-layer-integ-"));
    const outputsFile = join(tempDir, "outputs.json");

    try {
      run("bun", ["run", "build-layer"], rootDir);
      run("bun", ["run", "compile"], rootDir);
      run("bun", ["run", "build:handler"], sampleAppDir);

      run(
        "bunx",
        [
          "cdk",
          "deploy",
          stackName,
          "--require-approval",
          "never",
          "--outputs-file",
          outputsFile,
        ],
        sampleAppDir,
        { INTEG_STACK_NAME: stackName },
      );

      const json = JSON.parse(readFileSync(outputsFile, "utf8")) as Record<
        string,
        StackOutputs
      >;
      const outputs = json[stackName];
      expect(outputs).toBeDefined();

      const restResponse = await fetch(`${outputs.RestApiUrl}cookie-check`, {
        headers: { Cookie: "it_cookie=from-client" },
      });
      expect(restResponse.status).toBe(200);
      const restPayload = (await restResponse.json()) as Record<string, unknown>;
      expect(restPayload.ok).toBe(true);
      expect(restPayload.eventVersion).toBe("v1");
      expect(restPayload.requestCookie).toBe("from-client");
      assertCookieHeader(restResponse.headers);

      const urlResponse = await fetch(`${outputs.FunctionUrl}cookie-check`, {
        headers: { Cookie: "it_cookie=from-client" },
      });
      expect(urlResponse.status).toBe(200);
      const urlPayload = (await urlResponse.json()) as Record<string, unknown>;
      expect(urlPayload.ok).toBe(true);
      expect(urlPayload.eventVersion).toBe("v2");
      expect(urlPayload.requestCookie).toBe("from-client");
      assertCookieHeader(urlResponse.headers);
    } finally {
      runBestEffort(
        "bunx",
        ["cdk", "destroy", stackName, "--force"],
        sampleAppDir,
        { INTEG_STACK_NAME: stackName },
      );
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 20 * 60 * 1000);
});
