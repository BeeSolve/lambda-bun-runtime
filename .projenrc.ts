import { awscdk, github, javascript, release } from "projen";

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
    "@aws-sdk/client-lambda",
    "@aws-sdk/client-s3",
    "@types/bun",
    "aws-cdk-lib@2.238.0",
    "constructs@10.4.5",
    "yaml@^2.8.1",
    "fast-check",
  ],
  githubOptions: {
    projenCredentials: github.GithubCredentials.fromApp({
      appIdSecret: "APP_ID",
      privateKeySecret: "APP_PRIVATE_KEY",
    }),
  },
  jest: false,
  jsiiVersion: "^5.9.0",
  keywords: ["awscdk", "bun", "aws", "lambda", "runtime"],
  license: "MIT",
  majorVersion: 2,
  name: "@beesolve/lambda-bun-runtime",
  npmAccess: javascript.NpmAccess.PUBLIC,
  npmTrustedPublishing: true,
  packageManager: javascript.NodePackageManager.BUN,
  peerDeps: ["aws-cdk-lib@^2.238.0", "constructs@^10.4.5"],
  prettier: true,
  projenrcTs: true,
  repositoryUrl: "git+https://github.com/BeeSolve/lambda-bun-runtime",
  releaseToNpm: true,
  releaseTrigger: release.ReleaseTrigger.manual(),
  vscode: false,
});

project.addTask("build-layer", {
  description: "Build bun layer.",
  exec: "bun command/buildLayer.ts",
});

project.package.addField("workspaces", ["examples/sample-app"]);

project.addPackageIgnore("command");
project.addPackageIgnore("/.claude");
project.addPackageIgnore("/.kiro");
project.addPackageIgnore("/.bun-version");
project.addPackageIgnore("/docs");
project.addPackageIgnore("/examples");
project.addPackageIgnore("/test/integration");

project.addTask("integ:deploy-test-destroy", {
  description: "Deploy sample app, run integration tests, then destroy stack.",
  exec: "RUN_AWS_INTEG=1 bun test test/integration/deploy-destroy.test.ts",
});

project.addTask("integ:cleanup", {
  description: "Best-effort cleanup of leftover BunLayerInteg-* stacks.",
  exec: `bash -lc "set -euo pipefail; stacks=\\$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE ROLLBACK_COMPLETE --query 'StackSummaries[].StackName' --output text); for stack in \\$stacks; do case \\"\\$stack\\" in BunLayerInteg-*) echo \\"Destroying \\$stack\\"; (cd examples/sample-app && INTEG_STACK_NAME=\\"\\$stack\\" bunx cdk destroy \\"\\$stack\\" --force);; esac; done"`,
});

project.tsconfigDev.addInclude("command/**/*.ts");
project.tsconfigDev.addInclude("command/**/*.mts");

project.eslint?.addOverride({
  files: ["test/**/*.ts"],
  rules: {
    "import/no-unresolved": ["error", { ignore: ["^bun$", "^bun:test$"] }],
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-floating-promises": "off",
  },
});

project.gitignore.addPatterns("/lib/*");
project.gitignore.removePatterns("/lib");
project.gitignore.include(".bun-version");

project.synth();
