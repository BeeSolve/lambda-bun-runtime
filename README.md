# Lambda bun runtime

This repository contains custom built bun runtime for AWS Lambda. It also contains CDK constructs for `BunFunction` which uses `BunLambdaLayer`.

[Bun](https://bun.com) is a fast JavaScript runtime.

Current bun version: [1.3.3](https://bun.com/blog/bun-v1.3.3)

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
