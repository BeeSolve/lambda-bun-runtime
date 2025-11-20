import { aws_lambda, RemovalPolicy } from "aws-cdk-lib";
import {
  Architecture,
  Code,
  LayerVersion,
  Runtime,
  type LayerVersionProps,
} from "aws-cdk-lib/aws-lambda";
import { type NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type BunFunctionProps = Omit<
  NodejsFunctionProps,
  "entry" | "runtime" | "architecture" | "handler" | "code" | "bundling"
> & {
  /**
   * Example: `${__dirname}/dist/index.js`
   */
  entrypoint: `${string}.js`;

  /**
   * Bun layer needs to be set.
   */
  bunLayer: BunLambdaLayer;
};

export class BunFunction extends aws_lambda.Function {
  constructor(
    scope: Construct,
    id: string,
    { entrypoint, ...props }: BunFunctionProps,
  ) {
    super(scope, id, {
      ...props,
      code: Code.fromAsset(dirname(entrypoint)),
      handler: `${toEntry(entrypoint)}.fetch`,
      runtime: Runtime.PROVIDED_AL2,
      architecture: Architecture.ARM_64,
      layers: [props.bunLayer, ...(props.layers ?? [])],
    });
  }
}

export class BunLambdaLayer extends LayerVersion {
  constructor(
    scope: Construct,
    id: string,
    props?: Omit<
      LayerVersionProps,
      | "description"
      | "removalPolicy"
      | "code"
      | "compatibleArchitectures"
      | "compatibleRuntimes"
      | "layerVersionName"
    >,
  ) {
    super(scope, id, {
      ...(props ?? {}),
      description: "A custom Lambda layer for Bun.",
      removalPolicy: RemovalPolicy.DESTROY,
      code: Code.fromAsset(`${__dirname}/../bun-lambda-layer.zip"`),
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
