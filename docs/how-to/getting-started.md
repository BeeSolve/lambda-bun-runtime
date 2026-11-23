# How to: Deploy your first Bun Lambda with CDK

> Full working example: https://github.com/BeeSolve/lambda-bun-runtime/tree/main/examples/sample-app

`BunFunction` is a `lambda.Function` that runs on the Bun customer-managed runtime (CMR)
BeeSolve publishes for this package version. It uses the `custom` runtime on `arm64` and sets
`runtimeConfig` with the `lambda.mixins.FunctionRuntimeConfig` mixin.

## Prerequisites

- An AWS CDK app with `aws-cdk-lib` 2.278.0 or newer and a stack that has a concrete region
  (`env: { region: "eu-central-1" }`). Published runtimes exist in `eu-north-1`,
  `eu-central-1`, `eu-west-1`, `us-east-1` and `us-west-2`
- A handler file written for Bun (`.ts` or precompiled `.js`)

## Steps

### 1. Install

```sh
bun add @beesolve/lambda-bun-runtime
```

(or `npm install @beesolve/lambda-bun-runtime`)

`aws-cdk-lib` and `constructs` are peer dependencies - install them if your app
does not already have them.

### 2. Wrap each handler

Point `entrypoint` at a `.ts` file (built with Bun during CDK synth) or a precompiled
`.js` file.

```ts
import * as path from "node:path";
import { Stack } from "aws-cdk-lib";
import { FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { BunFunction } from "@beesolve/lambda-bun-runtime";
import type { Construct } from "constructs";

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const api = new BunFunction(this, "ApiFn", {
      entrypoint: path.join(__dirname, "../src/http-v2.ts"),
    });

    api.addFunctionUrl({ authType: FunctionUrlAuthType.NONE });
  }
}
```

The handler export defaults to `handler`. Override it with `exportName` if your
file exports a differently-named function.

### 3. Optional: choose the runtime alias

By default the function uses the alias `<major>.<minor>` for the Bun version of this package
version. Patch releases of Bun move that alias, and your function picks them up on its next cold
start. Pass `bunRuntime.runtimeAlias` to choose another published alias:

| Alias    | Moves to                                          |
| -------- | ------------------------------------------------- |
| `1.4.5`  | the Bun version, only for internal patch releases |
| `1.4`    | the latest patch of the minor line (the default)  |
| `1`      | the latest 1.x release                            |
| `latest` | the newest release                                |

## Common Pitfalls

- **Region must be known and published.** An environment-agnostic stack or a region
  without a published runtime throws at synth. Set `bunRuntime.runtimeArn` to a runtime you
  published, see [Publish your own runtime](./custom-runtime.md).
- **Do not combine runtime and layer.** `BunFunction` never uses a layer. Use
  `BunFunctionWithLayer` for the layer path, see [Use a layer instead of the runtime](./custom-layer.md).
- **Entrypoint extension matters.** A `.ts` entrypoint is built with Bun at synth
  time; a `.js` entrypoint is used as-is. The type only accepts `.ts` or `.js`.
- **arm64 only.** Do not override `architecture` or `runtime`.

## See Also

- [Publish your own runtime](./custom-runtime.md)
- [Use a layer instead of the runtime](./custom-layer.md)
- [README](../../README.md) - handler signatures, Fetch API support, and response streaming
- [Full example on GitHub](https://github.com/BeeSolve/lambda-bun-runtime/tree/main/examples/sample-app)
