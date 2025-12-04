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
import { Construct } from "constructs";
import { dirname } from "node:path";

const bunVersion = "1.3.3";

export interface BunFunctionProps {
  /**
   * Example: `${__dirname}/dist/index.js`
   */
  readonly entrypoint: `${string}.js`;

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
    const { entrypoint, ...rest } = props;

    super(scope, id, {
      ...rest,
      code: Code.fromAsset(dirname(entrypoint)),
      handler: `${toEntry(entrypoint)}.fetch`,
      runtime: Runtime.PROVIDED_AL2,
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
      compatibleRuntimes: [Runtime.PROVIDED_AL2],
      layerVersionName: "BunRuntime",
    });
  }
}

function toEntry(entrypoint: string): string {
  const entry = entrypoint.split("/").pop()?.split(".").shift();
  if (entry == null) throw Error(`Cannot parse entry from entrypoint.`);

  return entry;
}
