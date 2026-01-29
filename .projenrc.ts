import { awscdk, javascript, release } from "projen";

const project = new awscdk.AwsCdkConstructLibrary({
  author: "BeeSolve s.r.o.",
  authorAddress: "support@beesolve.com",
  authorOrganization: true,
  cdkVersion: "2.236.0",
  clobber: false,
  constructsVersion: "10.4.5",
  defaultReleaseBranch: "main",
  description: "AWS Lambda bun runtime layer and construct",
  devDeps: ["aws-cdk-lib@2.236.0", "constructs@10.4.5", "yaml@^2.8.1"],
  jest: false,
  jsiiVersion: "^5.9.0",
  keywords: ["bun", "aws", "lambda", "runtime"],
  license: "MIT",
  majorVersion: 1,
  name: "@beesolve/lambda-bun-runtime",
  npmAccess: javascript.NpmAccess.PUBLIC,
  packageManager: javascript.NodePackageManager.BUN,
  peerDeps: ["aws-cdk-lib@^2.235.1", "constructs@^10.4.5"],
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

project.addPackageIgnore("command");

project.synth();
