#!/usr/bin/env bun
/**
 * Builds the Bun runtime image and publishes it as a Lambda customer-managed runtime (CMR).
 * Idempotent: an existing image tag, runtime version and alias are reused or updated.
 *
 * Usage:
 *   bun command/publishRuntime.ts --region <region> [bun-version] [--name <runtime>]
 *     [--repository <ecr repo>] [--version-name <name>] [--alias <name>]...
 *     [--moving-alias <name>]... [--release-aliases] [--result-alias <name>] [--public]
 *     [--out <result.json>]
 *   bun-lambda-runtime publish-runtime --region <region> [same options]
 *
 * --alias is always pointed at the version. --moving-alias is pointed at the version unless it
 * already points to a newer one (version names are package versions such as 4.10405.0).
 * --release-aliases adds <x.y.z>, <x.y>, <x> and latest as moving aliases.
 * --public lets every AWS account use the runtime.
 *
 * Needs the AWS CLI (with the lambda-core commands) and Docker with buildx, and credentials with
 * ECR, lambda-core and lambda:PutResourcePolicy permissions.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  compileRuntime,
  downloadBunBinary,
  extractBunBinary,
  resolveVersion,
  validateVersion,
} from "./layer";

export const defaultRuntimeName = "bun";

export interface ExecResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type Exec = (props: {
  readonly command: ReadonlyArray<string>;
  readonly input?: string;
}) => ExecResult;

export interface PublishRuntimeProps {
  readonly region: string;
  readonly contextDir: string;
  readonly runtimeName: string;
  readonly repositoryName: string;
  readonly versionName: string;
  readonly releaseNotes: string;
  readonly aliases: ReadonlyArray<string>;
  readonly movingAliases: ReadonlyArray<string>;
  readonly resultAlias: string;
  readonly isPublic: boolean;
  readonly exec: Exec;
}

export interface PublishRuntimeResult {
  readonly region: string;
  readonly runtimeArn: string;
  readonly runtimeAlias: string;
  readonly runtimeVersion: string;
}

export function aliasNamesForBunVersion(props: {
  readonly bunVersion: string;
}): ReadonlyArray<string> {
  const [major, minor] = props.bunVersion.split(".");
  return [props.bunVersion, `${major}.${minor}`, major, "latest"];
}

export function compareVersionNames(props: {
  readonly left: string;
  readonly right: string;
}): number {
  const left = props.left.split(".").map(Number);
  const right = props.right.split(".").map(Number);
  if ([...left, ...right].some((part) => Number.isNaN(part))) return 0;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function runtimeImageFiles(): { readonly dockerfile: string; readonly bootstrap: string } {
  return {
    // No ENTRYPOINT or CMD: an ENTRYPOINT leaves _HANDLER empty. No RUN, so building the
    // arm64 image needs no emulation on an x86 host.
    dockerfile: [
      "FROM public.ecr.aws/lambda/provided:al2023",
      "COPY --chmod=0755 bun /usr/local/bin/bun",
      "COPY runtime.js /var/runtime/runtime.js",
      "COPY --chmod=0755 bootstrap /var/runtime/bootstrap",
      "",
    ].join("\n"),
    bootstrap: "#!/bin/sh\nexec /usr/local/bin/bun /var/runtime/runtime.js\n",
  };
}

export function publishRuntime(props: PublishRuntimeProps): PublishRuntimeResult {
  const accountId = aws({
    props,
    args: ["sts", "get-caller-identity", "--query", "Account", "--output", "text"],
  });
  const imageUri = `${accountId}.dkr.ecr.${props.region}.amazonaws.com/${props.repositoryName}`;

  ensureRepository({ props });
  ensureImage({ props, accountId, imageUri });
  const runtimeArn = ensureRuntime({ props });
  ensureVersion({ props, imageUri });

  for (const alias of props.aliases) {
    setAlias({ props, alias });
  }
  for (const alias of props.movingAliases) {
    if (isAliasAhead({ props, alias })) continue;
    setAlias({ props, alias });
  }
  if (props.isPublic) {
    makePublic({ props, runtimeArn });
  }

  return {
    region: props.region,
    runtimeArn,
    runtimeAlias: props.resultAlias,
    runtimeVersion: props.versionName,
  };
}

export async function publishRuntimeCommand(argv: ReadonlyArray<string>): Promise<void> {
  const args = parseArgs({ argv });
  const region = args.single.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  if (region == null) throw new Error("Missing --region.");

  const bunVersion = resolveVersion({ cliVersion: args.positional[0] });
  validateVersion({ version: bunVersion });

  const versionName = args.single["version-name"] ?? bunVersion;
  const releaseAliases = args.flags.has("release-aliases")
    ? aliasNamesForBunVersion({ bunVersion })
    : [];
  const movingAliases = [...args.movingAliases, ...releaseAliases];
  const aliases =
    args.aliases.length === 0 && movingAliases.length === 0 ? ["latest"] : args.aliases;
  const resultAlias =
    args.single["result-alias"] ?? releaseAliases[1] ?? aliases[0] ?? movingAliases[0] ?? "latest";

  const tmpDir = mkdtempSync(join(tmpdir(), "bun-runtime-"));
  try {
    const contextDir = await stageContext({ bunVersion, tmpDir });
    const result = publishRuntime({
      region,
      contextDir,
      runtimeName: args.single.name ?? defaultRuntimeName,
      repositoryName: args.single.repository ?? defaultRuntimeName,
      versionName,
      releaseNotes: `Bun v${bunVersion}${process.env.GITHUB_SHA == null ? "" : ` | git ${process.env.GITHUB_SHA.slice(0, 12)}`}`,
      aliases,
      movingAliases,
      resultAlias,
      isPublic: args.flags.has("public"),
      exec: spawnExec,
    });
    const out = args.single.out;
    if (out != null) writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
    console.log(
      `Published runtime ${result.runtimeArn} version ${result.runtimeVersion}, alias ${result.runtimeAlias} in ${region}`,
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function stageContext(props: {
  readonly bunVersion: string;
  readonly tmpDir: string;
}): Promise<string> {
  const zipPath = await downloadBunBinary({ version: props.bunVersion, tmpDir: props.tmpDir });
  const bunBinaryPath = await extractBunBinary({ zipPath, tmpDir: props.tmpDir });
  const runtimePath = await compileRuntime({ tmpDir: props.tmpDir });

  const contextDir = join(props.tmpDir, "image");
  mkdirSync(contextDir, { recursive: true });
  const files = runtimeImageFiles();
  writeFileSync(join(contextDir, "Dockerfile"), files.dockerfile);
  writeFileSync(join(contextDir, "bootstrap"), files.bootstrap);
  await Bun.write(join(contextDir, "bun"), Bun.file(bunBinaryPath));
  await Bun.write(join(contextDir, "runtime.js"), Bun.file(runtimePath));
  return contextDir;
}

function ensureRepository(props: { readonly props: PublishRuntimeProps }): void {
  const found = awsTry({
    props: props.props,
    args: ["ecr", "describe-repositories", "--repository-names", props.props.repositoryName],
  });
  if (found != null) return;

  aws({
    props: props.props,
    args: ["ecr", "create-repository", "--repository-name", props.props.repositoryName],
  });
  aws({
    props: props.props,
    args: [
      "ecr",
      "set-repository-policy",
      "--repository-name",
      props.props.repositoryName,
      "--policy-text",
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "LambdaReadAccess",
            Effect: "Allow",
            Principal: { Service: "lambda.amazonaws.com" },
            Action: ["ecr:BatchGetImage", "ecr:DescribeImages", "ecr:GetDownloadUrlForLayer"],
          },
        ],
      }),
    ],
  });
}

function ensureImage(props: {
  readonly props: PublishRuntimeProps;
  readonly accountId: string;
  readonly imageUri: string;
}): void {
  const existing = awsTry({
    props: props.props,
    args: [
      "ecr",
      "describe-images",
      "--repository-name",
      props.props.repositoryName,
      "--image-ids",
      `imageTag=${props.props.versionName}`,
    ],
  });
  if (existing != null) return;

  const password = aws({ props: props.props, args: ["ecr", "get-login-password"] });
  run({
    props: props.props,
    command: [
      "docker",
      "login",
      "--username",
      "AWS",
      "--password-stdin",
      `${props.accountId}.dkr.ecr.${props.props.region}.amazonaws.com`,
    ],
    input: password,
  });
  // The builder needs the docker-container driver for the image type output below.
  const created = props.props.exec({
    command: ["docker", "buildx", "create", "--name", "bun-runtime-builder", "--use"],
  });
  if (created.exitCode !== 0) {
    run({
      props: props.props,
      command: ["docker", "buildx", "use", "bun-runtime-builder"],
    });
  }
  // Docker v2 Schema 2 (oci-mediatypes=false) is what Lambda CMR images were verified with.
  run({
    props: props.props,
    command: [
      "docker",
      "buildx",
      "build",
      "--platform",
      "linux/arm64",
      "--tag",
      `${props.imageUri}:${props.props.versionName}`,
      "--output",
      "type=image,oci-mediatypes=false",
      "--provenance=false",
      "--sbom=false",
      "--push",
      props.props.contextDir,
    ],
  });
}

function ensureRuntime(props: { readonly props: PublishRuntimeProps }): string {
  const state = awsTry({
    props: props.props,
    args: [
      "lambda-core",
      "get-runtime",
      "--runtime-name",
      props.props.runtimeName,
      "--query",
      "State",
      "--output",
      "text",
    ],
  });
  if (state === "PENDING_DELETION") {
    throw new Error(
      `Runtime ${props.props.runtimeName} is PENDING_DELETION and its name is reserved. Use another --name.`,
    );
  }
  if (state == null) {
    aws({
      props: props.props,
      args: [
        "lambda-core",
        "create-runtime",
        "--name",
        props.props.runtimeName,
        "--description",
        "Bun runtime for AWS Lambda",
        "--license-info",
        "MIT",
      ],
    });
  }
  return aws({
    props: props.props,
    args: [
      "lambda-core",
      "get-runtime",
      "--runtime-name",
      props.props.runtimeName,
      "--query",
      "Arn",
      "--output",
      "text",
    ],
  });
}

function ensureVersion(props: {
  readonly props: PublishRuntimeProps;
  readonly imageUri: string;
}): void {
  const existing = awsTry({
    props: props.props,
    args: [
      "lambda-core",
      "get-runtime-version",
      "--runtime-name",
      props.props.runtimeName,
      "--name",
      props.props.versionName,
    ],
  });
  if (existing == null) {
    aws({
      props: props.props,
      args: [
        "lambda-core",
        "create-runtime-version",
        "--runtime-name",
        props.props.runtimeName,
        "--name",
        props.props.versionName,
        "--image-uri",
        `${props.imageUri}:${props.props.versionName}`,
        "--release-notes",
        props.props.releaseNotes,
      ],
    });
  }
  aws({
    props: props.props,
    args: [
      "lambda-core",
      "wait",
      "runtime-version-active",
      "--runtime-name",
      props.props.runtimeName,
      "--name",
      props.props.versionName,
    ],
  });
}

function currentAliasVersion(props: {
  readonly props: PublishRuntimeProps;
  readonly alias: string;
}): string | undefined {
  return awsTry({
    props: props.props,
    args: [
      "lambda-core",
      "get-runtime-alias",
      "--runtime-name",
      props.props.runtimeName,
      "--name",
      props.alias,
      "--query",
      "RuntimeVersion",
      "--output",
      "text",
    ],
  });
}

function isAliasAhead(props: {
  readonly props: PublishRuntimeProps;
  readonly alias: string;
}): boolean {
  const current = currentAliasVersion(props);
  if (current == null) return false;
  return compareVersionNames({ left: current, right: props.props.versionName }) > 0;
}

function setAlias(props: { readonly props: PublishRuntimeProps; readonly alias: string }): void {
  const exists = currentAliasVersion(props) != null;
  aws({
    props: props.props,
    args: [
      "lambda-core",
      exists ? "update-runtime-alias" : "create-runtime-alias",
      "--runtime-name",
      props.props.runtimeName,
      "--name",
      props.alias,
      "--runtime-version",
      props.props.versionName,
    ],
  });
  aws({
    props: props.props,
    args: [
      "lambda-core",
      "wait",
      "runtime-alias-active",
      "--runtime-name",
      props.props.runtimeName,
      "--name",
      props.alias,
    ],
  });
}

// A policy on the runtime ARN is what works; policies on the alias or version ARN are rejected.
function makePublic(props: {
  readonly props: PublishRuntimeProps;
  readonly runtimeArn: string;
}): void {
  const existing = awsTry({
    props: props.props,
    args: ["lambda", "get-resource-policy", "--resource-arn", props.runtimeArn],
  });
  if (existing?.includes("AssociateRuntimeAlias") === true) return;

  aws({
    props: props.props,
    args: [
      "lambda",
      "put-resource-policy",
      "--resource-arn",
      props.runtimeArn,
      "--policy",
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "public",
            Effect: "Allow",
            Principal: "*",
            Action: "lambda:AssociateRuntimeAlias",
            Resource: [props.runtimeArn, `${props.runtimeArn}/*`],
          },
        ],
      }),
    ],
  });
}

function aws(props: {
  readonly props: PublishRuntimeProps;
  readonly args: ReadonlyArray<string>;
}): string {
  return run({
    props: props.props,
    command: ["aws", ...props.args, "--region", props.props.region, "--no-cli-pager"],
  });
}

function awsTry(props: {
  readonly props: PublishRuntimeProps;
  readonly args: ReadonlyArray<string>;
}): string | undefined {
  const result = props.props.exec({
    command: ["aws", ...props.args, "--region", props.props.region, "--no-cli-pager"],
  });
  if (result.exitCode !== 0) return undefined;
  return result.stdout.trim();
}

function run(props: {
  readonly props: PublishRuntimeProps;
  readonly command: ReadonlyArray<string>;
  readonly input?: string;
}): string {
  const result = props.props.exec({ command: props.command, input: props.input });
  if (result.exitCode === 0) return result.stdout.trim();
  throw new Error(
    `Command failed (${result.exitCode}): ${props.command.slice(0, 4).join(" ")}\n${result.stderr.trim()}`,
  );
}

function spawnExec(props: {
  readonly command: ReadonlyArray<string>;
  readonly input?: string;
}): ExecResult {
  const processResult = Bun.spawnSync([...props.command], {
    stdin: props.input == null ? "ignore" : new TextEncoder().encode(props.input),
  });
  return {
    exitCode: processResult.exitCode ?? -1,
    stdout: processResult.stdout.toString(),
    stderr: processResult.stderr.toString(),
  };
}

interface ParsedArgs {
  readonly positional: ReadonlyArray<string>;
  readonly single: Record<string, string>;
  readonly aliases: ReadonlyArray<string>;
  readonly movingAliases: ReadonlyArray<string>;
  readonly flags: ReadonlySet<string>;
}

function parseArgs(props: { readonly argv: ReadonlyArray<string> }): ParsedArgs {
  const positional: Array<string> = [];
  const single: Record<string, string> = {};
  const aliases: Array<string> = [];
  const movingAliases: Array<string> = [];
  const flags = new Set<string>();

  for (let index = 0; index < props.argv.length; index++) {
    const arg = props.argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (name === "public" || name === "release-aliases") {
      flags.add(name);
      continue;
    }
    const value = props.argv[++index];
    if (value == null) throw new Error(`--${name} needs a value.`);
    if (name === "alias") {
      aliases.push(value);
    } else if (name === "moving-alias") {
      movingAliases.push(value);
    } else {
      single[name] = value;
    }
  }
  return { positional, single, aliases, movingAliases, flags };
}

if (import.meta.main) {
  await publishRuntimeCommand(process.argv.slice(2));
}
