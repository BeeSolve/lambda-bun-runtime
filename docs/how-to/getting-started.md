# How to: Deploy your first Bun Lambda with CDK

> Full working example: https://github.com/BeeSolve/lambda-bun-runtime/tree/main/examples/sample-app

This package provides two AWS CDK constructs: `BunLambdaLayer` (the prebuilt Bun
runtime layer) and `BunFunction` (a `lambda.Function` that runs on it). Functions
run on `PROVIDED_AL2023` / `arm64`.

## Prerequisites

- An AWS CDK app (`aws-cdk-lib` v2)
- A handler file written for Bun (`.ts` or precompiled `.js`)

## Steps

### 1. Install

```sh
bun add @beesolve/lambda-bun-runtime
```

(or `npm install @beesolve/lambda-bun-runtime`)

`aws-cdk-lib` and `constructs` are peer dependencies - install them if your app
does not already have them.

### 2. Create the layer once, then wrap each handler

Add the layer a single time per stack and pass it to every `BunFunction`. Point
`entrypoint` at a `.ts` file (built with Bun during CDK synth) or a precompiled
`.js` file.

```ts
import * as path from "node:path";
import { Stack } from "aws-cdk-lib";
import { FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { BunFunction, BunLambdaLayer } from "@beesolve/lambda-bun-runtime";
import type { Construct } from "constructs";

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bunLayer = new BunLambdaLayer(this, "BunLayer");

    const api = new BunFunction(this, "ApiFn", {
      entrypoint: path.join(__dirname, "../src/http-v2.ts"),
      bunLayer,
    });

    api.addFunctionUrl({ authType: FunctionUrlAuthType.NONE });
  }
}
```

The handler export defaults to `handler`. Override it with `exportName` if your
file exports a differently-named function.

## Common Pitfalls

- **The layer is required.** `BunFunction` needs `bunLayer` - create one
  `BunLambdaLayer` per stack and reuse it across functions.
- **Entrypoint extension matters.** A `.ts` entrypoint is built with Bun at synth
  time; a `.js` entrypoint is used as-is. The type only accepts `.ts` or `.js`.
- **arm64 only.** The layer is published for `arm64` / `PROVIDED_AL2023`; do not
  override `architecture` or `runtime`.

## See Also

- [README](../../README.md) - handler signatures, Fetch API support, and response streaming
- [Full example on GitHub](https://github.com/BeeSolve/lambda-bun-runtime/tree/main/examples/sample-app)
