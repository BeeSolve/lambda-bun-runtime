import { describe, expect, test } from "bun:test";

import * as fc from "fast-check";

import { resolveRegionArtifacts } from "../src/artifacts";
import type { Artifacts } from "../src/artifacts";

const artifacts: Artifacts = {
  regions: {
    "eu-central-1": {
      layerVersionArn: "arn:aws:lambda:eu-central-1:123456789012:layer:BunRuntime:7",
      runtimeArn: "arn:aws:lambda:eu-central-1:123456789012:runtime/bun",
      runtimeAlias: "1.4.4",
    },
    "us-east-1": {
      layerVersionArn: "arn:aws:lambda:us-east-1:123456789012:layer:BunRuntime:9",
    },
  },
};

describe("resolveRegionArtifacts", () => {
  test("returns the artifacts of a published region", () => {
    expect(resolveRegionArtifacts({ region: "eu-central-1", artifacts }).layerVersionArn).toBe(
      "arn:aws:lambda:eu-central-1:123456789012:layer:BunRuntime:7",
    );
  });

  test("runtime fields are optional per region", () => {
    expect(resolveRegionArtifacts({ region: "us-east-1", artifacts }).runtimeArn).toBeUndefined();
  });

  test("the error lists the published regions sorted", () => {
    expect(() => resolveRegionArtifacts({ region: "ap-south-1", artifacts })).toThrow(
      "Published regions: eu-central-1, us-east-1.",
    );
  });

  test("the error says none when nothing is published", () => {
    expect(() =>
      resolveRegionArtifacts({ region: "eu-west-1", artifacts: { regions: {} } }),
    ).toThrow("Published regions: none.");
  });

  test("any region that is not published throws", () => {
    fc.assert(
      fc.property(
        fc
          .stringMatching(/^[a-z]{2}-[a-z]+-[1-9]$/)
          .filter((region) => artifacts.regions[region] == null),
        (region) => {
          expect(() => resolveRegionArtifacts({ region, artifacts })).toThrow(
            `No published Bun layer for region "${region}"`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
