import { awscdk, javascript, release } from "projen";

const project = new awscdk.AwsCdkConstructLibrary({
  author: "BeeSolve s.r.o.",
  authorAddress: "support@beesolve.com",
  authorOrganization: true,
  cdkVersion: "2.238.0",
  clobber: false,
  constructsVersion: "10.4.5",
  defaultReleaseBranch: "main",
  description: "AWS Lambda bun runtime layer and construct",
  devDeps: [
    "@types/bun",
    "aws-cdk-lib@2.238.0",
    "constructs@10.4.5",
    "yaml@^2.8.1",
  ],
  jest: false,
  jsiiVersion: "^5.9.0",
  keywords: ["bun", "aws", "lambda", "runtime"],
  license: "MIT",
  majorVersion: 1,
  name: "@beesolve/lambda-bun-runtime",
  npmAccess: javascript.NpmAccess.PUBLIC,
  packageManager: javascript.NodePackageManager.BUN,
  peerDeps: ["aws-cdk-lib@^2.238.0", "constructs@^10.4.5"],
  prettier: true,
  projenrcTs: true,
  repositoryUrl: "https://github.com/beesolve/lambda-bun-runtime",
  releaseToNpm: true,
  releaseTrigger: release.ReleaseTrigger.manual(),
  vscode: false,
});

project.addTask("build-layer", {
  description: "Build bun layer.",
  exec: "./command/buildLayer.sh",
});

project.tasks.tryFind("test")?.reset("bun test");

project.addTask("integ:deploy-test-destroy", {
  description: "Deploy sample app, run e2e checks, then destroy stack.",
  exec: "RUN_AWS_INTEG=1 bun test test/integration/deploy-destroy.test.ts",
});

project.addTask("integ:cleanup", {
  description: "Best-effort cleanup of integration stacks by prefix.",
  exec: "bash -lc \"set -euo pipefail; stacks=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE ROLLBACK_COMPLETE --query 'StackSummaries[].StackName' --output text); for stack in $stacks; do case \\\"$stack\\\" in BunLayerInteg-*) echo \\\"Destroying $stack\\\"; (cd examples/sample-app && INTEG_STACK_NAME=\\\"$stack\\\" bunx cdk destroy \\\"$stack\\\" --force);; esac; done\"",
});

project.addPackageIgnore("command");

project.synth();
