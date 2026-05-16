import { basename, dirname } from "node:path";
import { RemovalPolicy } from "aws-cdk-lib";
import {
  Architecture,
  Code,
  Function,
  LayerVersion,
  LayerVersionProps,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { type NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

const bunVersion = "1.3.13";

export interface BunFunctionProps {
  /**
   * Path to the entrypoint — accepts .ts or .js files.
   * If .ts is provided, the construct builds it with Bun during CDK synth.
   * If .js is provided, it is used directly (pre-compiled).
   *
   * Example: `${__dirname}/dist/index.js` or `${__dirname}/src/handler.ts`
   */
  readonly entrypoint: `${string}.ts` | `${string}.js`;

  /**
   * Optional export name. Defaults to "handler".
   * @default "handler"
   */
  readonly exportName?: string;

  /**
   * Bun layer needs to be set.
   */
  readonly bunLayer: BunLambdaLayer;
}
export interface BunFunctionProps extends Omit<
  NodejsFunctionProps,
  "entry" | "runtime" | "architecture" | "handler" | "code" | "bundling"
> {}

export class BunFunction extends Function {
  constructor(scope: Construct, id: string, props: BunFunctionProps) {
    const { entrypoint, exportName, logGroup, ...rest } = props;

    const derivedBasename = deriveBasename(entrypoint);
    const handler = `${derivedBasename}.${exportName ?? "handler"}`;

    let code: Code;
    if (entrypoint.endsWith(".ts")) {
      const outputDir = `${dirname(entrypoint)}/.bun-build/${derivedBasename}`;
      code = Code.fromCustomCommand(outputDir, [
        "bun",
        "build",
        entrypoint,
        "--outdir",
        outputDir,
        "--target",
        "bun",
        "--minify",
      ]);
    } else {
      code = Code.fromAsset(dirname(entrypoint));
    }

    super(scope, id, {
      logGroup:
        logGroup ??
        new LogGroup(scope, `${id}LogGroup`, {
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.TWO_WEEKS,
        }),
      ...rest,
      code,
      handler,
      runtime: Runtime.PROVIDED_AL2023,
      architecture: Architecture.ARM_64,
      layers: [rest.bunLayer, ...(rest.layers ?? [])],
    });
  }
}

export interface BunLambdaLayerProps {}
export interface BunLambdaLayerProps extends Omit<
  LayerVersionProps,
  | "description"
  | "removalPolicy"
  | "code"
  | "compatibleArchitectures"
  | "compatibleRuntimes"
  | "layerVersionName"
> {}

export class BunLambdaLayer extends LayerVersion {
  constructor(scope: Construct, id: string, props?: BunLambdaLayerProps) {
    super(scope, id, {
      ...(props ?? {}),
      description: "A custom Lambda layer for Bun.",
      removalPolicy: RemovalPolicy.DESTROY,
      code: Code.fromAsset(`${__dirname}/bun-lambda-layer-${bunVersion}.zip`),
      compatibleArchitectures: [Architecture.ARM_64],
      compatibleRuntimes: [Runtime.PROVIDED_AL2023],
      layerVersionName: "BunRuntime",
    });
  }
}

/**
 * Derives the base filename without extension from an entrypoint path.
 * Throws if the entrypoint has no parseable basename.
 */
function deriveBasename(entrypoint: string): string {
  const base = basename(entrypoint);
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex <= 0) {
    throw new Error(
      `Cannot derive handler from entrypoint: ${entrypoint}`,
    );
  }
  return base.substring(0, dotIndex);
}
