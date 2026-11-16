import { basename, dirname } from "node:path";

import { RemovalPolicy, Resource, Stack, Token } from "aws-cdk-lib";
import { Architecture, Code, Function, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import type { FunctionProps, ILayerVersion, LayerVersionPermission } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

import { publishedArtifacts, resolveRegionArtifacts } from "./artifacts";

const bunVersion = "1.4.5";

export interface BunFunctionProps extends Omit<
  FunctionProps,
  "runtime" | "architecture" | "handler" | "code"
> {
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
  readonly bunLayer: ILayerVersion;
}

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

export type BunLambdaLayerProps =
  | {
      /**
       * Use an existing layer version instead of the published BeeSolve layer.
       */
      readonly layerVersionArn: string;
      readonly assetZipPath?: never;
    }
  | {
      /**
       * Path to a layer zip built with the `build-layer` command. The zip is
       * uploaded as a CDK asset and published as a layer in your account.
       */
      readonly assetZipPath: string;
      readonly layerVersionArn?: never;
    }
  | {
      readonly layerVersionArn?: never;
      readonly assetZipPath?: never;
    };

/**
 * The Bun runtime layer. By default it references the layer BeeSolve publishes
 * for this package version in the stack's region. Pass `layerVersionArn` or
 * `assetZipPath` to use your own layer (needed for regions without a published layer).
 */
export class BunLambdaLayer extends Resource implements ILayerVersion {
  public readonly layerVersionArn: string;
  public readonly compatibleRuntimes: Array<Runtime> = [Runtime.PROVIDED_AL2023];

  private readonly layer: ILayerVersion;

  constructor(scope: Construct, id: string, props: BunLambdaLayerProps = {}) {
    super(scope, id);

    if (props.assetZipPath != null) {
      this.layer = new LayerVersion(this, "Layer", {
        description: `Bun v${bunVersion} Lambda runtime layer.`,
        removalPolicy: RemovalPolicy.DESTROY,
        code: Code.fromAsset(props.assetZipPath),
        compatibleArchitectures: [Architecture.ARM_64],
        compatibleRuntimes: [Runtime.PROVIDED_AL2023],
        layerVersionName: "BunRuntime",
      });
    } else {
      const arn =
        props.layerVersionArn ??
        resolveRegionArtifacts({
          region: concreteRegion({ scope }),
          artifacts: publishedArtifacts,
        }).layerVersionArn;
      this.layer = LayerVersion.fromLayerVersionArn(this, "Layer", arn);
    }

    this.layerVersionArn = this.layer.layerVersionArn;
  }

  public get layerVersionRef(): ILayerVersion["layerVersionRef"] {
    return { layerVersionArn: this.layerVersionArn };
  }

  public addPermission(id: string, permission: LayerVersionPermission): void {
    this.layer.addPermission(id, permission);
  }
}

function concreteRegion(props: { readonly scope: Construct }): string {
  const region = Stack.of(props.scope).region;
  if (Token.isUnresolved(region)) {
    throw new Error(
      "BunLambdaLayer needs a concrete region to find the published layer. " +
        "Set env.region on the stack, or pass layerVersionArn or assetZipPath.",
    );
  }
  return region;
}

function deriveBasename(props: { entrypoint: string }): string {
  const base = basename(props.entrypoint);
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex <= 0) {
    throw new Error(`Cannot derive handler from entrypoint: ${props.entrypoint}`);
  }
  return base.substring(0, dotIndex);
}

function resolveCode(props: { entrypoint: string; derivedBasename: string }): Code {
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
