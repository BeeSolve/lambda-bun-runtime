#!/usr/bin/env bun
/**
 * Merges per-region publish results into src/artifacts.json (read by the package build).
 *
 * Usage:
 *   bun command/writeArtifacts.ts --package-version <v> --bun-version <v> <result.json>...
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Artifacts, RegionArtifacts } from "../src/artifacts";

export interface RegionResult {
  readonly region: string;
  readonly layerVersionArn: string;
}

export function mergeArtifacts(props: {
  readonly packageVersion: string;
  readonly bunVersion: string;
  readonly results: ReadonlyArray<RegionResult>;
}): Artifacts {
  const regions: Record<string, RegionArtifacts> = {};
  for (const result of props.results) {
    if (regions[result.region] != null) {
      throw new Error(`Duplicate result for region ${result.region}.`);
    }
    regions[result.region] = { layerVersionArn: result.layerVersionArn };
  }
  const sortedRegions = Object.fromEntries(
    Object.entries(regions).sort(([left], [right]) => left.localeCompare(right)),
  );
  return {
    packageVersion: props.packageVersion,
    bunVersion: props.bunVersion,
    regions: sortedRegions,
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const files: Array<string> = [];
  let packageVersion: string | undefined;
  let bunVersion: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--package-version") {
      packageVersion = argv[++index];
    } else if (argv[index] === "--bun-version") {
      bunVersion = argv[++index];
    } else {
      files.push(argv[index]);
    }
  }
  if (packageVersion == null || bunVersion == null || files.length === 0) {
    throw new Error(
      "Usage: writeArtifacts.ts --package-version <v> --bun-version <v> <result.json>...",
    );
  }

  const artifacts = mergeArtifacts({
    packageVersion,
    bunVersion,
    results: files.map((file) => JSON.parse(readFileSync(file, "utf8")) as RegionResult),
  });
  const target = resolve(import.meta.dir, "..", "src", "artifacts.json");
  writeFileSync(target, `${JSON.stringify(artifacts, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(artifacts.regions).length} region(s) to ${target}`);
}
