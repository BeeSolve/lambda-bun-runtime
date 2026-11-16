#!/usr/bin/env bun
/**
 * Publishes the Bun layer zip to one region and shares it with all AWS accounts.
 * Idempotent: a layer version whose description names this package version is reused.
 *
 * Usage:
 *   bun command/publishLayer.ts --region <region> --zip <path> --bun-version <x.y.z> \
 *     --package-version <version> --git-sha <sha> --out <result.json>
 *
 * Needs AWS credentials with lambda:PublishLayerVersion, lambda:ListLayerVersions and
 * lambda:AddLayerVersionPermission on the BunRuntime layer in the region.
 */

import { readFileSync, writeFileSync } from "node:fs";

import {
  AddLayerVersionPermissionCommand,
  LambdaClient,
  ListLayerVersionsCommand,
  PublishLayerVersionCommand,
  ResourceConflictException,
} from "@aws-sdk/client-lambda";

export const layerName = "BunRuntime";

// Direct upload limit of PublishLayerVersion is 50 MiB (zipped).
const maxDirectUploadBytes = 50 * 1024 * 1024;

export interface PublishLayerProps {
  readonly region: string;
  readonly zip: Uint8Array;
  readonly bunVersion: string;
  readonly packageVersion: string;
  readonly gitSha: string;
  readonly client?: Pick<LambdaClient, "send">;
}

export interface PublishLayerResult {
  readonly region: string;
  readonly layerVersionArn: string;
  readonly reused: boolean;
}

export function layerDescription(props: {
  readonly bunVersion: string;
  readonly packageVersion: string;
  readonly gitSha: string;
  readonly zipSha256: string;
}): string {
  return `Bun v${props.bunVersion} | package v${props.packageVersion} | git ${props.gitSha.slice(0, 12)} | sha256 ${props.zipSha256.slice(0, 16)}`;
}

export function descriptionMatchesPackage(props: {
  readonly description: string | undefined;
  readonly packageVersion: string;
}): boolean {
  return (props.description ?? "").split(" | ").includes(`package v${props.packageVersion}`);
}

export async function publishLayer(props: PublishLayerProps): Promise<PublishLayerResult> {
  if (props.zip.byteLength > maxDirectUploadBytes) {
    throw new Error(
      `Layer zip is ${props.zip.byteLength} bytes, above the ${maxDirectUploadBytes} byte direct upload limit. Upload it through S3 instead.`,
    );
  }

  const client = props.client ?? new LambdaClient({ region: props.region });

  const existingArn = await findVersionArn({ client, packageVersion: props.packageVersion });
  const layerVersionArn =
    existingArn ??
    (await publishNewVersion({
      client,
      zip: props.zip,
      bunVersion: props.bunVersion,
      packageVersion: props.packageVersion,
      gitSha: props.gitSha,
    }));

  await makePublic({ client, layerVersionArn });

  return { region: props.region, layerVersionArn, reused: existingArn != null };
}

async function findVersionArn(props: {
  readonly client: Pick<LambdaClient, "send">;
  readonly packageVersion: string;
}): Promise<string | undefined> {
  let marker: string | undefined;
  do {
    const page = await props.client.send(
      new ListLayerVersionsCommand({
        LayerName: layerName,
        Marker: marker,
        CompatibleArchitecture: "arm64",
      }),
    );
    const match = (page.LayerVersions ?? []).find((version) =>
      descriptionMatchesPackage({
        description: version.Description,
        packageVersion: props.packageVersion,
      }),
    );
    if (match?.LayerVersionArn != null) return match.LayerVersionArn;
    marker = page.NextMarker;
  } while (marker != null);
  return undefined;
}

async function publishNewVersion(props: {
  readonly client: Pick<LambdaClient, "send">;
  readonly zip: Uint8Array;
  readonly bunVersion: string;
  readonly packageVersion: string;
  readonly gitSha: string;
}): Promise<string> {
  const zipSha256 = new Bun.CryptoHasher("sha256").update(props.zip).digest("hex");
  const published = await props.client.send(
    new PublishLayerVersionCommand({
      LayerName: layerName,
      Description: layerDescription({
        bunVersion: props.bunVersion,
        packageVersion: props.packageVersion,
        gitSha: props.gitSha,
        zipSha256,
      }),
      Content: { ZipFile: props.zip },
      CompatibleArchitectures: ["arm64"],
      CompatibleRuntimes: ["provided.al2023"],
      LicenseInfo: "MIT",
    }),
  );
  if (published.LayerVersionArn == null) {
    throw new Error("PublishLayerVersion returned no LayerVersionArn.");
  }
  return published.LayerVersionArn;
}

async function makePublic(props: {
  readonly client: Pick<LambdaClient, "send">;
  readonly layerVersionArn: string;
}): Promise<void> {
  const version = Number(props.layerVersionArn.split(":").at(-1));
  try {
    await props.client.send(
      new AddLayerVersionPermissionCommand({
        LayerName: layerName,
        VersionNumber: version,
        StatementId: "public",
        Action: "lambda:GetLayerVersion",
        Principal: "*",
      }),
    );
  } catch (error) {
    if (error instanceof ResourceConflictException) return;
    throw error;
  }
}

function parseArgs(props: { readonly argv: ReadonlyArray<string> }): Record<string, string> {
  const values: Record<string, string> = {};
  for (let index = 0; index < props.argv.length; index += 2) {
    const flag = props.argv[index];
    const value = props.argv[index + 1];
    if (!flag.startsWith("--") || value == null) {
      throw new Error(`Invalid arguments near "${flag}". Expected --name value pairs.`);
    }
    values[flag.slice(2)] = value;
  }
  return values;
}

function required(props: { readonly args: Record<string, string>; readonly name: string }): string {
  const value = props.args[props.name];
  if (value == null) throw new Error(`Missing --${props.name}.`);
  return value;
}

if (import.meta.main) {
  const args = parseArgs({ argv: process.argv.slice(2) });
  const result = await publishLayer({
    region: required({ args, name: "region" }),
    zip: readFileSync(required({ args, name: "zip" })),
    bunVersion: required({ args, name: "bun-version" }),
    packageVersion: required({ args, name: "package-version" }),
    gitSha: required({ args, name: "git-sha" }),
  });
  writeFileSync(required({ args, name: "out" }), `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `${result.reused ? "Reused" : "Published"} ${result.layerVersionArn} (public) in ${result.region}`,
  );
}
