import artifactsJson from "./artifacts.json" with { type: "json" };

export interface RegionArtifacts {
  readonly layerVersionArn: string;
  readonly runtimeArn?: string;
  readonly runtimeAlias?: string;
}

export interface Artifacts {
  readonly packageVersion?: string;
  readonly bunVersion?: string;
  readonly regions: Record<string, RegionArtifacts>;
}

/**
 * Published artifacts for this package version. The file in the repository is an
 * empty placeholder; the release workflow overwrites it with the real ARNs
 * before the package is built.
 */
export const publishedArtifacts: Artifacts = artifactsJson;

export function resolveRegionArtifacts(props: {
  readonly region: string;
  readonly artifacts: Artifacts;
}): RegionArtifacts {
  const found = props.artifacts.regions[props.region];
  if (found != null) return found;

  const supported = Object.keys(props.artifacts.regions).sort();
  const supportedText = supported.length === 0 ? "none" : supported.join(", ");
  throw new Error(
    `No published Bun layer for region "${props.region}". Published regions: ${supportedText}. ` +
      `Pass layerVersionArn to use your own layer, or build the layer zip yourself and pass assetZipPath.`,
  );
}
