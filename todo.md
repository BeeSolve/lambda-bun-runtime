# Integration Tests Implementation

## Checklist

### Phase 1 — Sample app

- [x] `examples/sample-app/cdk.json`
- [x] `examples/sample-app/package.json`
- [x] `examples/sample-app/bin/app.ts`
- [x] `examples/sample-app/lib/sample-stack.ts`
- [x] `examples/sample-app/src/http-v2.ts`
- [x] `examples/sample-app/src/http-v1.ts`
- [x] `examples/sample-app/src/echo.ts`
- [x] `examples/sample-app/src/s3-writer.ts`

### Phase 2 — Integration test

- [x] `test/integration/deploy-destroy.test.ts`

### Phase 3 — Projen tasks

- [x] Add `integ:deploy-test-destroy` task to `.projenrc.ts`
- [x] Add `integ:cleanup` task to `.projenrc.ts`
- [x] Run `bunx projen` to regenerate managed files

### Phase 4 — GitHub Actions

- [x] `.github/workflows/integration.yml`
- [x] Wire `integration_test` job into `release.yml` as prerequisite for publish
