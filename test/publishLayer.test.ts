import { describe, expect, test } from "bun:test";

import {
  AddLayerVersionPermissionCommand,
  ListLayerVersionsCommand,
  PublishLayerVersionCommand,
  ResourceConflictException,
} from "@aws-sdk/client-lambda";

import { descriptionMatchesPackage, layerDescription, publishLayer } from "../command/publishLayer";
import { mergeArtifacts } from "../command/writeArtifacts";

const arnBase = "arn:aws:lambda:eu-central-1:123456789012:layer:BunRuntime";

interface FakeOptions {
  readonly existing?: ReadonlyArray<{ Description: string; LayerVersionArn: string }>;
  readonly conflictOnPermission?: boolean;
}

function fakeClient(options: FakeOptions = {}) {
  const sent: Array<unknown> = [];
  const client = {
    send: async (command: unknown): Promise<unknown> => {
      sent.push(command);
      if (command instanceof ListLayerVersionsCommand) {
        return { LayerVersions: options.existing ?? [] };
      }
      if (command instanceof PublishLayerVersionCommand) {
        return { LayerVersionArn: `${arnBase}:5` };
      }
      if (command instanceof AddLayerVersionPermissionCommand) {
        if (options.conflictOnPermission === true) {
          throw new ResourceConflictException({ message: "exists", $metadata: {} });
        }
        return {};
      }
      throw new Error("unexpected command");
    },
  };
  return { client: client as never, sent };
}

const baseProps = {
  region: "eu-central-1",
  zip: new Uint8Array([1, 2, 3]),
  bunVersion: "1.4.4",
  packageVersion: "4.10404.0",
  gitSha: "0123456789abcdef0123",
};

describe("layer description", () => {
  test("names bun version, package version, git sha and zip hash", () => {
    const description = layerDescription({
      bunVersion: "1.4.4",
      packageVersion: "4.10404.0",
      gitSha: "0123456789abcdef0123",
      zipSha256: "a".repeat(64),
    });
    expect(description).toBe(
      "Bun v1.4.4 | package v4.10404.0 | git 0123456789ab | sha256 aaaaaaaaaaaaaaaa",
    );
    expect(description.length).toBeLessThanOrEqual(256);
  });

  test("matches only the exact package version", () => {
    const description = "Bun v1.4.4 | package v4.10404.0 | git abc | sha256 def";
    expect(descriptionMatchesPackage({ description, packageVersion: "4.10404.0" })).toBe(true);
    expect(descriptionMatchesPackage({ description, packageVersion: "4.10404.1" })).toBe(false);
    expect(descriptionMatchesPackage({ description: undefined, packageVersion: "4.10404.0" })).toBe(
      false,
    );
  });
});

describe("publishLayer", () => {
  test("publishes a new version and makes it public", async () => {
    const { client, sent } = fakeClient();
    const result = await publishLayer({ ...baseProps, client });

    expect(result).toEqual({
      region: "eu-central-1",
      layerVersionArn: `${arnBase}:5`,
      reused: false,
    });
    const permission = sent.find((command) => command instanceof AddLayerVersionPermissionCommand);
    expect((permission as AddLayerVersionPermissionCommand).input).toMatchObject({
      VersionNumber: 5,
      Principal: "*",
      Action: "lambda:GetLayerVersion",
    });
  });

  test("reuses an existing version for the same package version", async () => {
    const { client, sent } = fakeClient({
      existing: [
        {
          Description: "Bun v1.4.4 | package v4.10404.0 | git abc | sha256 def",
          LayerVersionArn: `${arnBase}:3`,
        },
      ],
    });
    const result = await publishLayer({ ...baseProps, client });

    expect(result.reused).toBe(true);
    expect(result.layerVersionArn).toBe(`${arnBase}:3`);
    expect(sent.some((command) => command instanceof PublishLayerVersionCommand)).toBe(false);
  });

  test("an already existing public permission is not an error", async () => {
    const { client } = fakeClient({ conflictOnPermission: true });
    const result = await publishLayer({ ...baseProps, client });
    expect(result.layerVersionArn).toBe(`${arnBase}:5`);
  });

  test("rejects a zip above the direct upload limit", async () => {
    const { client } = fakeClient();
    await expect(
      publishLayer({ ...baseProps, zip: new Uint8Array(50 * 1024 * 1024 + 1), client }),
    ).rejects.toThrow("direct upload limit");
  });
});

describe("mergeArtifacts", () => {
  test("merges results sorted by region", () => {
    const artifacts = mergeArtifacts({
      packageVersion: "4.10404.0",
      bunVersion: "1.4.4",
      results: [
        { region: "us-east-1", layerVersionArn: "arn:b" },
        { region: "eu-central-1", layerVersionArn: "arn:a" },
      ],
    });
    expect(Object.keys(artifacts.regions)).toEqual(["eu-central-1", "us-east-1"]);
    expect(artifacts.regions["eu-central-1"]).toEqual({ layerVersionArn: "arn:a" });
  });

  test("rejects duplicate regions", () => {
    expect(() =>
      mergeArtifacts({
        packageVersion: "4.10404.0",
        bunVersion: "1.4.4",
        results: [
          { region: "eu-central-1", layerVersionArn: "arn:a" },
          { region: "eu-central-1", layerVersionArn: "arn:b" },
        ],
      }),
    ).toThrow("Duplicate result");
  });

  test("merges layer and runtime results of the same region", () => {
    const artifacts = mergeArtifacts({
      packageVersion: "4.10404.0",
      bunVersion: "1.4.4",
      results: [
        { region: "eu-central-1", layerVersionArn: "arn:a" },
        { region: "eu-central-1", runtimeArn: "arn:r", runtimeAlias: "1.4" },
      ],
    });
    expect(artifacts.regions["eu-central-1"]).toEqual({
      layerVersionArn: "arn:a",
      runtimeArn: "arn:r",
      runtimeAlias: "1.4",
    });
  });

  test("rejects a region without a layer result", () => {
    expect(() =>
      mergeArtifacts({
        packageVersion: "4.10404.0",
        bunVersion: "1.4.4",
        results: [{ region: "eu-central-1", runtimeArn: "arn:r", runtimeAlias: "1.4" }],
      }),
    ).toThrow("Missing layer result");
  });
});
