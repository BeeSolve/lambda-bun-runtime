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
  readonly layerVersionArn?: string;
  readonly runtimeArn?: string;
  readonly runtimeAlias?: string;
}

/**
 * Results of the same region (layer and runtime publish steps) are merged into one entry.
 */
export function mergeArtifacts(props: {
  readonly packageVersion: string;
  readonly bunVersion: string;
  readonly results: ReadonlyArray<RegionResult>;
}): Artifacts {
  const partial: Record<string, Omit<RegionResult, "region">> = {};
  for (const result of props.results) {
    const { region, ...fields } = result;
    const previous = partial[region] ?? {};
    for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
      if (previous[key] != null && fields[key] != null) {
        throw new Error(`Duplicate result for region ${region}: ${key}.`);
      }
    }
    partial[region] = { ...previous, ...fields };
  }

  const regions: Record<string, RegionArtifacts> = {};
  for (const [region, fields] of Object.entries(partial)) {
    if (fields.layerVersionArn == null) {
      throw new Error(`Missing layer result for region ${region}.`);
    }
    regions[region] = {
      layerVersionArn: fields.layerVersionArn,
      ...(fields.runtimeArn == null ? {} : { runtimeArn: fields.runtimeArn }),
      ...(fields.runtimeAlias == null ? {} : { runtimeAlias: fields.runtimeAlias }),
    };
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
