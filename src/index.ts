import { basename, dirname } from "node:path";
import { RemovalPolicy, Stack } from "aws-cdk-lib";
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

const bunVersion = "1.3.14";

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

// jsii requires CDK construct constructors to follow (scope, id, props) signature
export class BunFunction extends Function {
  constructor(scope: Construct, id: string, props: BunFunctionProps) {
    const derivedBasename = deriveBasename({ entrypoint: props.entrypoint });
    const handler = `${derivedBasename}.${props.exportName ?? "handler"}`;
    const code = resolveCode({ entrypoint: props.entrypoint, derivedBasename });

    super(scope, id, {
      logGroup:
        props.logGroup ??
        new LogGroup(scope, `${id}LogGroup`, {
          logGroupName: `/aws/lambda/${Stack.of(scope).stackName}-${id}`,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.TWO_WEEKS,
        }),
      ...props,
      code,
      handler,
      runtime: Runtime.PROVIDED_AL2023,
      architecture: Architecture.ARM_64,
      layers: [props.bunLayer, ...(props.layers ?? [])],
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
      description: `Bun v${bunVersion} Lambda runtime layer.`,
      removalPolicy: RemovalPolicy.DESTROY,
      code: Code.fromAsset(`${__dirname}/bun-lambda-layer-${bunVersion}.zip`),
      compatibleArchitectures: [Architecture.ARM_64],
      compatibleRuntimes: [Runtime.PROVIDED_AL2023],
      layerVersionName: "BunRuntime",
    });
  }
}

function deriveBasename(props: { entrypoint: string }): string {
  const base = basename(props.entrypoint);
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex <= 0) {
    throw new Error(
      `Cannot derive handler from entrypoint: ${props.entrypoint}`,
    );
  }
  return base.substring(0, dotIndex);
}

function resolveCode(props: {
  entrypoint: string;
  derivedBasename: string;
}): Code {
  if (props.entrypoint.endsWith(".ts")) {
    const outputDir = `${dirname(props.entrypoint)}/.bun-build/${props.derivedBasename}`;
    return Code.fromCustomCommand(outputDir, [
      "bun",
      "build",
      props.entrypoint,
      "--outdir",
      outputDir,
      "--target",
      "bun",
      "--minify",
    ]);
  }
  return Code.fromAsset(dirname(props.entrypoint));
}
