# ADR: Drop jsii and polyglot CDK support

## Status

Accepted (v3.0)

## Context

This package has been published as a jsii library since v1 to support polyglot CDK consumers (Python, Java, .NET, Go) via Construct Hub. In v2, the runtime was simplified from a Fetch API-based approach to raw `(event, context)` handlers, but the jsii/projen build infrastructure remained. This required:

- jsii as the compiler (with its restrictions: no `import type`, interface merging for props, CommonJS output, no template literal types)
- jsii-pacmak for packaging
- jsii-rosetta for documentation examples
- projen for orchestrating the jsii build pipeline

These constraints accumulated significant cost:

1. **Source restrictions** — jsii forbids `import type`, modern TypeScript patterns, and ESM. The codebase was forced into unidiomatic TypeScript to satisfy jsii's subset.
2. **Build complexity** — the build pipeline required projen, ts-node, jsii, jsii-pacmak, jsii-rosetta, and commit-and-tag-version. A 15-second build became 90+ seconds.
3. **Maintenance overhead** — projen generated 15+ config files that couldn't be modified directly. Every change required editing `.projenrc.ts` and re-synthesizing.
4. **No polyglot consumers** — Construct Hub stats showed zero downloads for Python/Java/.NET packages. All real usage is TypeScript CDK apps.

## Decision

Drop jsii and publish as a standard ESM TypeScript package compiled with Bun's bundler.

## Consequences

### Positive

- Modern TypeScript: `import type`, template literal types, ESM, `import.meta.dirname`
- Build time: ~3 seconds (Bun.build + tsc declarations)
- Zero code generation — all config is hand-written and version-controlled
- Simpler CI — no self-mutation, no projen upgrade workflows
- Smaller dependency footprint (84 packages installed vs 300+)

### Negative

- **No polyglot support** — Python/Java/.NET/Go consumers cannot use this package via Construct Hub. They must use TypeScript or write their own CDK constructs wrapping the published layer zip.
- **ESM-only** — consumers using CommonJS `require()` must switch to `import()` or ESM. In practice, all CDK apps using this package already use `import` syntax.

### Neutral

- The Lambda layer zip is still published as a GitHub Release asset, so non-CDK consumers (Terraform, SAM, raw CloudFormation) are unaffected.
- Construct Hub listing will stop updating (last version shown will be v2.x).

## Alternatives Considered

1. **Keep jsii, drop projen** — jsii can be used without projen, but still imposes the TypeScript subset restrictions. The source code quality cost wasn't worth zero polyglot consumers.
2. **Publish both jsii and ESM** — dual publishing adds complexity for no demonstrated demand.
