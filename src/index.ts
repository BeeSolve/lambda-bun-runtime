import { basename, dirname } from "node:path";

import { RemovalPolicy, Resource, Stack, Token } from "aws-cdk-lib";
import {
  Architecture,
  Code,
  Function,
  LayerVersion,
  Runtime,
  RuntimeFamily,
  mixins,
} from "aws-cdk-lib/aws-lambda";
import type { FunctionProps, ILayerVersion, LayerVersionPermission } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

import { publishedArtifacts, resolveRegionArtifacts } from "./artifacts";

const bunVersion = "1.4.5";

const customRuntime = new Runtime("custom", RuntimeFamily.OTHER);

export interface BunFunctionBaseProps extends Omit<
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
}

export interface BunRuntimeProps {
  /**
   * ARN of the customer-managed runtime. Defaults to the runtime BeeSolve publishes
   * in the stack's region. Set it to use a runtime you built and published yourself.
   */
  readonly runtimeArn?: string;

  /**
   * Runtime alias. Defaults to the alias published with this package version,
   * or `latest` when `runtimeArn` is given.
   */
  readonly runtimeAlias?: string;
}

export interface BunFunctionProps extends BunFunctionBaseProps {
  /**
   * Override the customer-managed runtime. Without it the function uses the
   * runtime BeeSolve publishes for this package version.
   */
  readonly bunRuntime?: BunRuntimeProps;
}

/**
 * A Lambda function running on the Bun customer-managed runtime (CMR).
 */
export class BunFunction extends Function {
  constructor(scope: Construct, id: string, props: BunFunctionProps) {
    const runtimeConfig = resolveRuntimeConfig({ scope, runtime: props.bunRuntime ?? {} });

    super(scope, id, {
      ...baseFunctionProps({ scope, id, props }),
      runtime: customRuntime,
    });

    this.with(runtimeConfig);
  }
}

export interface BunFunctionWithLayerProps extends BunFunctionBaseProps {
  /**
   * The Bun layer the function runs on.
   */
  readonly bunLayer: ILayerVersion;
}

/**
 * A Lambda function running Bun from a layer on `provided.al2023`.
 * Use it where the customer-managed runtime is not available.
 */
export class BunFunctionWithLayer extends Function {
  constructor(scope: Construct, id: string, props: BunFunctionWithLayerProps) {
    super(scope, id, {
      ...baseFunctionProps({ scope, id, props }),
      runtime: Runtime.PROVIDED_AL2023,
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

function baseFunctionProps(props: {
  readonly scope: Construct;
  readonly id: string;
  readonly props: BunFunctionBaseProps;
}): FunctionProps {
  const derivedBasename = deriveBasename({ entrypoint: props.props.entrypoint });
  return {
    logGroup:
      props.props.logGroup ??
      new LogGroup(props.scope, `${props.id}LogGroup`, {
        logGroupName: `/aws/lambda/${Stack.of(props.scope).stackName}-${props.id}`,
        removalPolicy: RemovalPolicy.DESTROY,
        retention: RetentionDays.TWO_WEEKS,
      }),
    ...props.props,
    code: resolveCode({ entrypoint: props.props.entrypoint, derivedBasename }),
    handler: `${derivedBasename}.${props.props.exportName ?? "handler"}`,
    runtime: customRuntime,
    architecture: Architecture.ARM_64,
  };
}

function resolveRuntimeConfig(props: {
  readonly scope: Construct;
  readonly runtime: BunRuntimeProps;
}): mixins.FunctionRuntimeConfig {
  if (props.runtime.runtimeArn != null) {
    return new mixins.FunctionRuntimeConfig({
      runtimeArn: props.runtime.runtimeArn,
      runtimeAlias: props.runtime.runtimeAlias ?? "latest",
    });
  }

  const published = resolveRegionArtifacts({
    region: concreteRegion({ scope: props.scope }),
    artifacts: publishedArtifacts,
  });
  if (published.runtimeArn == null || published.runtimeAlias == null) {
    throw new Error(
      "No published Bun runtime for this region. Set bunRuntime.runtimeArn to use your own runtime, or use BunFunctionWithLayer.",
    );
  }
  return new mixins.FunctionRuntimeConfig({
    runtimeArn: published.runtimeArn,
    runtimeAlias: props.runtime.runtimeAlias ?? published.runtimeAlias,
  });
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
