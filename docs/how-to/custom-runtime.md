# How to: Publish your own Bun runtime

> Full working example: https://github.com/BeeSolve/lambda-bun-runtime/tree/main/examples/sample-app

Use this when your region has no published runtime, or when you want to own the runtime your
functions run on. The command builds the runtime image, pushes it to a private ECR repository in your
account, and creates the customer-managed runtime, its version and an alias.

## Prerequisites

- `@beesolve/lambda-bun-runtime` installed
- A recent AWS CLI that has the `aws lambda-core` commands, and credentials for the target account
- Docker with buildx (the image is built for `linux/arm64`; the build runs no emulated commands)

## Steps

### 1. Publish the runtime

```sh
bunx bun-lambda-runtime publish-runtime --region eu-west-3 --alias latest
```

Pass a Bun version as the first positional argument to publish another release. Options:

- `--name <runtime>` and `--repository <ecr repository>`: both default to `bun`
- `--version-name <name>`: defaults to the Bun version. Runtime versions are immutable
- `--alias <name>`: repeatable, always pointed at the version. Defaults to `latest`
- `--public`: let every AWS account use the runtime (a resource policy on the runtime ARN)
- `--out <file>`: write the result as JSON

The command is safe to rerun: an existing image tag, runtime and version are reused, and aliases are updated.

### 2. Use it in CDK

```ts
const fn = new BunFunction(this, "ApiFn", {
  entrypoint: `${__dirname}/api.ts`,
  bunRuntime: {
    runtimeArn: "arn:aws:lambda:eu-west-3:123456789012:runtime/bun",
    runtimeAlias: "latest",
  },
});
```

`runtimeAlias` defaults to `latest` when you pass only `runtimeArn`.

## Common Pitfalls

- **Deleted runtimes keep their name.** Deleting a runtime is soft (`PENDING_DELETION` for 30 days), so
  the name cannot be reused. The command stops with an error; pick another `--name`.
- **Same account or shared.** Functions in other accounts can use the runtime only after `--public`
  or a resource policy for their account.
- **Do not delete versions that functions use.**

## See Also

- [Getting Started](./getting-started.md)
- [Use a layer instead of the runtime](./custom-layer.md)
