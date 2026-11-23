import { describe, expect, test } from "bun:test";

import {
  aliasNamesForBunVersion,
  compareVersionNames,
  publishRuntime,
  runtimeImageFiles,
} from "../command/publishRuntime";
import type { Exec, PublishRuntimeProps } from "../command/publishRuntime";

const runtimeArn = "arn:aws:lambda:eu-central-1:123456789012:runtime/bun";

interface FakeState {
  readonly repository?: boolean;
  readonly image?: boolean;
  readonly runtimeState?: string;
  readonly version?: boolean;
  readonly aliases?: Record<string, string>;
  readonly policy?: boolean;
}

function fakeExec(state: FakeState = {}) {
  const commands: Array<ReadonlyArray<string>> = [];
  const exec: Exec = (props) => {
    commands.push(props.command);
    const line = props.command.join(" ");
    const ok = (stdout = "") => ({ exitCode: 0, stdout, stderr: "" });
    const fail = () => ({ exitCode: 254, stdout: "", stderr: "not found" });
    if (line.includes("sts get-caller-identity")) return ok("123456789012");
    if (line.includes("ecr describe-repositories"))
      return state.repository === true ? ok() : fail();
    if (line.includes("ecr describe-images")) return state.image === true ? ok() : fail();
    if (line.includes("ecr get-login-password")) return ok("secret");
    if (line.includes("buildx create")) return ok();
    if (line.includes("lambda-core get-runtime --runtime-name") && line.includes("State")) {
      return state.runtimeState == null ? fail() : ok(state.runtimeState);
    }
    if (line.includes("lambda-core get-runtime --runtime-name") && line.includes("Arn")) {
      return ok(runtimeArn);
    }
    if (line.includes("lambda-core get-runtime-version")) {
      return state.version === true ? ok("{}") : fail();
    }
    if (line.includes("lambda-core get-runtime-alias")) {
      const name = props.command[props.command.indexOf("--name") + 1];
      const current = state.aliases?.[name];
      return current == null ? fail() : ok(current);
    }
    if (line.includes("lambda get-resource-policy")) {
      return state.policy === true ? ok("AssociateRuntimeAlias") : fail();
    }
    return ok();
  };
  return { exec, commands };
}

function props(overrides: Partial<PublishRuntimeProps>, exec: Exec): PublishRuntimeProps {
  return {
    region: "eu-central-1",
    contextDir: "/tmp/context",
    runtimeName: "bun",
    repositoryName: "bun",
    versionName: "4.10405.0",
    releaseNotes: "Bun v1.4.5",
    aliases: ["pkg-4.10405.0"],
    movingAliases: [],
    resultAlias: "pkg-4.10405.0",
    isPublic: false,
    exec,
    ...overrides,
  };
}

function lines(commands: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> {
  return commands.map((command) => command.join(" "));
}

describe("alias names", () => {
  test("a Bun version produces exact, minor, major and latest aliases", () => {
    expect(aliasNamesForBunVersion({ bunVersion: "1.4.5" })).toEqual([
      "1.4.5",
      "1.4",
      "1",
      "latest",
    ]);
  });

  test("version names compare numerically", () => {
    expect(compareVersionNames({ left: "4.10405.0", right: "4.10404.9" })).toBeGreaterThan(0);
    expect(compareVersionNames({ left: "4.10405.0", right: "4.10405.1" })).toBeLessThan(0);
    expect(compareVersionNames({ left: "4.10405.0", right: "4.10405.0" })).toBe(0);
    expect(compareVersionNames({ left: "4.10405.0", right: "bench" })).toBe(0);
  });
});

describe("runtime image", () => {
  test("has no ENTRYPOINT, CMD or RUN and ships the bootstrap", () => {
    const files = runtimeImageFiles();
    expect(files.dockerfile).not.toMatch(/^(ENTRYPOINT|CMD|RUN)/m);
    expect(files.dockerfile).toContain("/var/runtime/bootstrap");
    expect(files.bootstrap).toContain("exec /usr/local/bin/bun /var/runtime/runtime.js");
  });
});

describe("publishRuntime", () => {
  test("creates repository, image, runtime, version and alias on a fresh account", () => {
    const { exec, commands } = fakeExec();
    const result = publishRuntime(props({}, exec));
    const executed = lines(commands);

    expect(result).toEqual({
      region: "eu-central-1",
      runtimeArn,
      runtimeAlias: "pkg-4.10405.0",
      runtimeVersion: "4.10405.0",
    });
    expect(executed.some((line) => line.includes("ecr create-repository"))).toBe(true);
    expect(executed.some((line) => line.includes("ecr set-repository-policy"))).toBe(true);
    expect(
      executed.some(
        (line) =>
          line.includes("docker buildx build") &&
          line.includes("--platform linux/arm64") &&
          line.includes("123456789012.dkr.ecr.eu-central-1.amazonaws.com/bun:4.10405.0"),
      ),
    ).toBe(true);
    expect(executed.some((line) => line.includes("lambda-core create-runtime "))).toBe(true);
    expect(executed.some((line) => line.includes("lambda-core create-runtime-version"))).toBe(true);
    expect(executed.some((line) => line.includes("lambda-core create-runtime-alias"))).toBe(true);
    expect(executed.some((line) => line.includes("put-resource-policy"))).toBe(false);
  });

  test("a rerun reuses repository, image, runtime and version", () => {
    const { exec, commands } = fakeExec({
      repository: true,
      image: true,
      runtimeState: "ACTIVE",
      version: true,
      aliases: { "pkg-4.10405.0": "4.10405.0" },
    });
    publishRuntime(props({}, exec));
    const executed = lines(commands);

    for (const forbidden of [
      "ecr create-repository",
      "docker buildx build",
      "lambda-core create-runtime ",
      "lambda-core create-runtime-version",
      "lambda-core create-runtime-alias",
    ]) {
      expect(executed.some((line) => line.includes(forbidden))).toBe(false);
    }
    expect(executed.some((line) => line.includes("lambda-core update-runtime-alias"))).toBe(true);
  });

  test("a moving alias does not move backwards but a plain alias does", () => {
    const { exec, commands } = fakeExec({
      repository: true,
      image: true,
      runtimeState: "ACTIVE",
      version: true,
      aliases: { "1.4": "4.10406.0", "1": "4.10404.0" },
    });
    publishRuntime(props({ aliases: [], movingAliases: ["1.4", "1", "latest"] }, exec));
    const updates = lines(commands).filter(
      (line) => line.includes("-runtime-alias --runtime-name") && !line.includes("get-"),
    );

    expect(updates.some((line) => line.includes("--name 1.4 "))).toBe(false);
    expect(
      updates.some((line) => line.includes("update-runtime-alias") && line.includes("--name 1 ")),
    ).toBe(true);
    expect(
      updates.some(
        (line) => line.includes("create-runtime-alias") && line.includes("--name latest "),
      ),
    ).toBe(true);
  });

  test("--public puts a policy for every principal on the runtime ARN", () => {
    const { exec, commands } = fakeExec({ repository: true, image: true });
    publishRuntime(props({ isPublic: true }, exec));
    const put = commands.find((command) => command.includes("put-resource-policy"));

    expect(put).toBeDefined();
    expect(put?.[put.indexOf("--resource-arn") + 1]).toBe(runtimeArn);
    const policy = JSON.parse(put?.[put.indexOf("--policy") + 1] ?? "{}");
    expect(policy.Statement[0].Principal).toBe("*");
    expect(policy.Statement[0].Action).toBe("lambda:AssociateRuntimeAlias");
  });

  test("an existing public policy is left alone", () => {
    const { exec, commands } = fakeExec({ repository: true, image: true, policy: true });
    publishRuntime(props({ isPublic: true }, exec));
    expect(lines(commands).some((line) => line.includes("put-resource-policy"))).toBe(false);
  });

  test("a runtime pending deletion is an error", () => {
    const { exec } = fakeExec({ repository: true, image: true, runtimeState: "PENDING_DELETION" });
    expect(() => publishRuntime(props({}, exec))).toThrow("PENDING_DELETION");
  });
});
