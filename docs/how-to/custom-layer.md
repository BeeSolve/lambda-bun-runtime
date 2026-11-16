# How to: Use another region or your own layer

> Full working example: https://github.com/BeeSolve/lambda-bun-runtime/tree/main/examples/sample-app

`new BunLambdaLayer(this, "BunLayer")` looks up the layer BeeSolve publishes for this
package version in the stack's region (`eu-north-1`, `eu-central-1`, `eu-west-1`,
`us-east-1`, `us-west-2`). It throws at synth when the stack has no concrete region or the
region has no published layer. Two props cover those cases.

## Prerequisites

- `@beesolve/lambda-bun-runtime` installed
- [Bun](https://bun.sh) installed (only for building the layer yourself)

## Steps

### 1. Use an existing layer ARN

If you already published the layer (or want to pin a specific published version), pass its ARN:

```ts
import { BunLambdaLayer } from "@beesolve/lambda-bun-runtime";

const bunLayer = new BunLambdaLayer(this, "BunLayer", {
  layerVersionArn: "arn:aws:lambda:eu-west-3:123456789012:layer:BunRuntime:1",
});
```

### 2. Or build the layer zip and deploy it as a CDK asset

Build the zip for the Bun version this package targets (downloads the Bun binary from
the official GitHub release, no AWS access needed):

```sh
bunx bun-lambda-runtime build-layer --out lib
```

Pass a version as the first argument to build a different Bun release, for example
`bunx bun-lambda-runtime build-layer 1.4.4 --out lib`. Then use the zip:

```ts
const bunLayer = new BunLambdaLayer(this, "BunLayer", {
  assetZipPath: "lib/bun-lambda-layer-1.4.4.zip",
});
```

CDK publishes the layer in your own account during `cdk deploy`.

## Common Pitfalls

- **Only one option at a time.** `layerVersionArn` and `assetZipPath` are mutually exclusive.
- **arm64 only.** The layer is built for `arm64` and `PROVIDED_AL2023`.
- **Environment-agnostic stacks.** Without `env.region` and no prop, the published layer cannot be
  resolved. Set the region on the stack or pass one of the props above.

## See Also

- [Getting Started](./getting-started.md)
- [Full example](https://github.com/BeeSolve/lambda-bun-runtime/tree/main/examples/sample-app)
