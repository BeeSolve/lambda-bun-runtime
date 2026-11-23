# ADR: Publish the Bun runtime as public AWS artifacts and slim the npm package

## Status

Accepted (targets v4.0)

## Context

Today the npm package ships the Bun layer zip (about 50 MB unpacked, `dist/bun-lambda-layer-<version>.zip`).
`BunLambdaLayer` turns it into a CDK asset, so every consumer uploads and publishes their own copy
of the layer in their own account and region. This works everywhere with no trust relationship,
but it makes the package large and slow to install.

Lambda customer-managed runtimes (CMR) reached GA. Findings from testing them against this runtime
(benchmark repo `beesolve/lambda-cmr-beta-bench`, Bun 1.4.0 and 1.4.4, eu-west-1):

- A CMR is a runtime resource with immutable versions (container image) and aliases. Functions use it
  with `aws lambda create-function --runtime custom --runtime-config RuntimeArn=...,RuntimeAlias=...`.
- **Sharing works.** A function in another account can use a runtime owned by account A once account A
  puts a resource policy on the runtime ARN with `aws lambda put-resource-policy` (action
  `lambda:AssociateRuntimeAlias`). It worked for a specific account and for `Principal: "*"`, including
  from an account outside the owner's AWS Organization. Policies on the alias or version ARN are rejected.
- The consumer needs no ECR permission. The image stays in the owner's private ECR repository, readable
  by the Lambda service principal.
- The runtime image must not set `ENTRYPOINT` or `CMD` (an `ENTRYPOINT` leaves `_HANDLER` empty), must
  contain `/var/task` and `/etc/hosts` (use `provided:al2023`), and must not use `/opt`.
- Runtime deletion is soft: `PENDING_DELETION` for 30 days, name reserved.
- Cold start difference between CMR and the layer is real but modest for the Bun client
  (p50 about 444-480 ms for CMR against about 620-660 ms for the layer).
- aws-cdk-lib 2.277.0 has no runtime resources and no `runtimeConfig` on `CfnFunction`. From 2.278.0
  the `lambda.mixins.FunctionRuntimeConfig` mixin sets `runtimeConfig` on a function. There are still no
  CDK resources for creating runtimes, so publishing uses the AWS CLI.

## Decision

1. Publish the runtime as **public artifacts in a BeeSolve AWS account**, in these regions:
   eu-north-1 (Stockholm), eu-central-1 (Frankfurt), eu-west-1 (Ireland), us-east-1, us-west-2 (Oregon).
   Per Bun version, CI publishes:
   - a Lambda layer version (shared with all accounts via `add-layer-version-permission --principal "*"`)
   - a CMR runtime version plus a Bun-version alias and a `latest` alias, with a runtime resource policy
     for `Principal: "*"`
   - the runtime image in a private ECR repository per region
2. Publishing is done with the AWS CLI from GitHub Actions through OIDC, not with CDK.
3. The npm package **stops shipping the layer zip**. It ships a generated `artifacts.json` that maps the
   package version to published ARNs per region.
4. `BunLambdaLayer` resolves the layer ARN from `artifacts.json` for the stack's region. If the region is
   unresolved or unsupported it throws an `Error` that lists supported regions and the escape hatches.
5. Users can always bring their own artifacts:
   - build the layer zip themselves with a shipped command and use it as a CDK asset
   - publish their own CMR with a shipped command that uses the AWS CLI
   - pass an explicit layer ARN or runtime ARN and alias
6. Published layer versions and runtime versions are **never deleted**, because consumers' functions
   reference them.
7. **The customer-managed runtime is the default in v4.** `BunFunction` runs on the published CMR and
   uses the `@beesolve/lambda-bun-runtime` ARN and alias for the stack's region from `artifacts.json`.
   It applies `lambda.mixins.FunctionRuntimeConfig` (aws-cdk-lib 2.278.0 or newer). The optional prop
   `bunRuntime: { runtimeArn, runtimeAlias }` overrides the ARN and alias, for internal tests and for
   users who publish their own runtime. `BunFunctionWithLayer` is the separate construct for the layer
   path. The two never share a construct.
8. **Runtime aliases follow the Bun minor line.** Bun is pre-2.0 and minor releases can break things,
   so the alias unit is `major.minor` instead of only the major as in the Node.js managed runtimes.
   Per published runtime version CI sets:
   - `pkg-<package version>`: set once per package version and never moved, the target of the release
     integration test
   - `<x.y.z>`: the Bun version pin, moves only for internal patch releases of the same Bun version
   - `<x.y>`: the latest patch of the minor line, the default of `BunFunction`
   - `<x>`: the latest release of the major, opt-in
   - `latest`: the newest release, for internal tests

   Patch releases move `<x.y>` and `<x>` automatically, but only after the integration test
   passes against the new runtime version, and an alias never moves to an older version. A new minor creates a new `<x.y>` alias and leaves the
   previous one in place. Only the newest minor line is patched automatically. Older lines keep their
   last patch, because Bun does not maintain release branches for old minors. Users who need an old
   line fix can pass an explicit alias or publish their own runtime. A new major creates `<x>` and
   `<x.0>` and moves nothing across the boundary. Each package version pins its default alias in
   `artifacts.json`.

9. Versioning keeps the scheme `<major>.<bun_major*10000 + bun_minor*100 + bun_patch>.<patch>`, with the
   major bumped to 4.

## Consequences

### Positive

- The tarball shrinks from tens of MB to a few KB, install is fast.
- One layer per region instead of one per consumer stack and account.
- CMR is the default, so consumers get the faster cold start without building anything.
- Patch fixes in Bun reach `<x.y>` users without a redeploy.

### Negative

- **Breaking change.** `BunFunction` is now CMR only, the layer path moved to `BunFunctionWithLayer`, and
  aws-cdk-lib 2.278.0 or newer is required. Consumers outside the five regions must build the layer themselves or pass an ARN.
  The 3.x line remains the last version that works in every region.
- Consumers depend on artifacts in a third-party account. Mitigations: never delete versions, put the
  git SHA and the zip SHA-256 in each layer version description and in the GitHub release notes, keep the
  build script so users can reproduce the layer.
- Moving an alias changes running functions on their next cold start. A broken Bun patch would reach
  `<x.y>` users, which is why the alias moves only after the integration test passes.
- Release now has a publish step that must succeed in all five regions before `npm publish`, and must be
  idempotent for reruns.
- The integration test needs a published layer for the version under test (see open questions).

### Neutral

- The layer zip stays a GitHub Release asset.

## Alternatives considered

1. **Keep shipping the zip.** No new trust or failure modes, but the package stays large.
2. **Public S3 zip as the layer source.** `PublishLayerVersion` accepts an S3 location, but it has to be
   in the same region as the layer, so it needs a public bucket per region and consumers still publish
   their own copy. A shared layer is simpler.
3. **CMR only, drop the layer.** Not possible for all users: CMR is new, needs a recent CLI and
   aws-cdk-lib, and tenancy settings are account-gated in some accounts. The layer stays as
   `BunFunctionWithLayer`.
4. **Per-consumer CMR built at deploy time (CDK asset and custom resource).** Needs Docker at synth and a
   custom resource that AWS will replace with a native resource.

## Resolved questions

1. **Integration test ordering.** The release publishes to `eu-central-1` first, runs the integration
   test against that published layer and runtime (alias `pkg-<package version>`), and only then publishes all regions
   again (idempotent), sets the moving aliases, and publishes to npm. Pull request
   runs have no published layer and deploy a layer built from source (`BUN_LAYER_ZIP`).
2. **Designated account.** The BeeSolve artifacts account, reached from GitHub Actions through an OIDC
   role limited to this repository and the `main` branch. Setup is in `docs/aws-oidc-setup-publish.md`.
3. **Runtime image base.** The image is `provided:al2023` with the Bun binary from the GitHub release zip
   that also goes into the layer, so layer and runtime contain the same binary by construction. The image
   has no `ENTRYPOINT`, `CMD` or `RUN`. The runtime version name is the package version and the image
   tag is the same name, so an internal patch release creates a new version.
4. **API shape.** `BunFunction` is CMR. `BunFunctionWithLayer` takes `bunLayer`. `new BunLambdaLayer(scope, id)` resolves the published layer. Props `layerVersionArn`
   or `assetZipPath` (mutually exclusive) select your own layer. `BunFunctionWithLayer.bunLayer` accepts any
   `ILayerVersion`. The shipped CLI `bun-lambda-runtime build-layer` builds the zip for `assetZipPath`.

## Open questions

1. Adding regions later is a one-line change to the region list, opt-in regions need extra account setup.
2. Whether to patch the previous minor line automatically as well (current decision: no).
