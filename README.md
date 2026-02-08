# Lambda bun runtime

[![View on Construct Hub](https://constructs.dev/badge?package=%40beesolve%2Flambda-bun-runtime)](https://constructs.dev/packages/@beesolve/lambda-bun-runtime)

This repository contains custom built bun runtime for AWS Lambda. It also contains CDK constructs for `BunFunction` which uses `BunLambdaLayer`.

[Bun](https://bun.com) is a fast JavaScript runtime.

Current bun version: [1.3.9](https://bun.com/blog/bun-v1.3.9)

## Installation

You can install current version of our Lambda bun runtime from `npm` like this:

```bash
npm i @beesolve/lambda-bun-runtime
```

## Usage

There are two constructs which you can use right ahead - `BunFunction` which depends on `BunLambdaLayer`:


```ts
import { BunLambdaLayer, BunFunction } from '@beesolve/lambda-bun-runtime';
import { Duration } from "aws-cdk-lib";

const bunLayer = new BunLambdaLayer(this, "BunLayer");

const apiHandler = new BunFunction(this, "ApiHandler", {
  entrypoint: `${__dirname}/dist/api.js`,
  memorySize: 1024,
  timeout: Duration.seconds(10),
  environment: {
    STAGE: 'prod',
  },
  bunLayer,
});
```

You can pass additional properties to both `BunLambdaLayer` and `BunFunction`.

The code for `BunFunction` needs to be built beforehand.

We recommend to use following build script as quick start:


```ts
// build.ts
import * as Bun from "bun";
import { rmSync } from "node:fs";

console.time("Built.");

rmSync("dist", { force: true, recursive: true });

await Bun.build({
  entrypoints: ["api.ts"],
  outdir: "dist",
  target: "bun", // this is important as the built code runs in Bun environment
  minify: true,
  splitting: true,
  sourcemap: "inline",
});

console.timeEnd("Built.");
```

When you persist above build script in `build.ts` you can then run it with `bun run build.ts`.

## Why the fork?

This runtime is fork of official [`bun-lambda`](https://github.com/oven-sh/bun/tree/main/packages/bun-lambda). It was created because it seems that Lambda is not very high on Bun's roadmap and there are multiple pull requests which haven't been merged.

The [usage](https://github.com/oven-sh/bun/tree/main/packages/bun-lambda#usage) is the same as in official runtime.

Here are changes which were added on top of the original runtime:

- https://github.com/oven-sh/bun/pull/17449 - `traceId` is not guaranteed in all Lambda environments so exitting when `traceId` is not present has been removed
- https://github.com/oven-sh/bun/pull/21018 - setting cookies now works with both HTTP Event v1 and HTTP Event v2
- https://github.com/oven-sh/bun/pull/20640 - when using API Gateway Authorizer the authorization context is present in `Request` header called `x-amzn-authorizer`


## Roadmap

- [x] keep in sync with latest versions of Bun
- [ ] investigate https://github.com/oven-sh/bun/pull/20825
- [ ] investigate https://github.com/oven-sh/bun/issues/14139
- [ ] investigate https://github.com/oven-sh/bun/issues/6003
- [ ] investigate https://github.com/oven-sh/bun/issues?q=is%3Aissue%20state%3Aopen%20label%3Alambda
- [ ] implement automatic code bundling with `BunFunction`
