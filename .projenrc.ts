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
    "@aws-sdk/client-lambda",
    "@aws-sdk/client-s3",
    "@types/bun",
    "aws-cdk-lib@2.238.0",
    "constructs@10.4.5",
    "yaml@^2.8.1",
    "fast-check",
  ],
  jest: false,
  jsiiVersion: "^5.9.0",
  keywords: ["awscdk", "bun", "aws", "lambda", "runtime"],
  license: "MIT",
  majorVersion: 2,
  name: "@beesolve/lambda-bun-runtime",
  npmAccess: javascript.NpmAccess.PUBLIC,
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

// Override the self-mutation job to use GitHub App token instead of PAT
const workflowFile = project.tryFindObjectFile(".github/workflows/build.yml");
if (workflowFile != null) {
  // Remove the original self-mutation steps and replace with GitHub App flow
  workflowFile.addDeletionOverride("jobs.self-mutation.steps");
  workflowFile.addOverride("jobs.self-mutation.steps", [
    {
      name: "Generate token",
      id: "app-token",
      uses: "actions/create-github-app-token@v3",
      with: {
        "app-id": "${{ secrets.APP_ID }}",
        "private-key": "${{ secrets.APP_PRIVATE_KEY }}",
      },
    },
    {
      name: "Checkout",
      uses: "actions/checkout@v6",
      with: {
        token: "${{ steps.app-token.outputs.token }}",
        ref: "${{ github.event.pull_request.head.ref }}",
        repository: "${{ github.event.pull_request.head.repo.full_name }}",
      },
    },
    {
      name: "Download patch",
      uses: "actions/download-artifact@v8",
      with: {
        name: "repo.patch",
        path: "${{ runner.temp }}",
      },
    },
    {
      name: "Apply patch",
      run: '[ -s ${{ runner.temp }}/repo.patch ] && git apply ${{ runner.temp }}/repo.patch || echo "Empty patch. Skipping."',
    },
    {
      name: "Set git identity",
      run: 'git config user.name "github-actions[bot]"\ngit config user.email "41898282+github-actions[bot]@users.noreply.github.com"',
    },
    {
      name: "Push changes",
      env: { PULL_REQUEST_REF: "${{ github.event.pull_request.head.ref }}" },
      run: 'git add .\ngit commit -s -m "chore: self mutation"\ngit push origin "HEAD:$PULL_REQUEST_REF"',
    },
  ]);
}

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

// Override upgrade-main workflow to use GitHub App token
const upgradeWorkflowFile = project.tryFindObjectFile(
  ".github/workflows/upgrade-main.yml",
);
if (upgradeWorkflowFile != null) {
  upgradeWorkflowFile.addDeletionOverride("jobs.pr.steps");
  upgradeWorkflowFile.addOverride("jobs.pr.steps", [
    {
      name: "Generate token",
      id: "app-token",
      uses: "actions/create-github-app-token@v3",
      with: {
        "app-id": "${{ secrets.APP_ID }}",
        "private-key": "${{ secrets.APP_PRIVATE_KEY }}",
      },
    },
    {
      name: "Checkout",
      uses: "actions/checkout@v6",
      with: { ref: "main" },
    },
    {
      name: "Download patch",
      uses: "actions/download-artifact@v8",
      with: {
        name: "repo.patch",
        path: "${{ runner.temp }}",
      },
    },
    {
      name: "Apply patch",
      run: '[ -s ${{ runner.temp }}/repo.patch ] && git apply ${{ runner.temp }}/repo.patch || echo "Empty patch. Skipping."',
    },
    {
      name: "Set git identity",
      run: 'git config user.name "github-actions[bot]"\ngit config user.email "41898282+github-actions[bot]@users.noreply.github.com"',
    },
    {
      name: "Create Pull Request",
      id: "create-pr",
      uses: "peter-evans/create-pull-request@v8",
      with: {
        token: "${{ steps.app-token.outputs.token }}",
        "commit-message":
          'chore(deps): upgrade dependencies\n\nUpgrades project dependencies. See details in [workflow run].\n\n[Workflow Run]: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\n\n------\n\n*Automatically created by projen via the "upgrade-main" workflow*',
        branch: "github-actions/upgrade-main",
        title: "chore(deps): upgrade dependencies",
        body: 'Upgrades project dependencies. See details in [workflow run].\n\n[Workflow Run]: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\n\n------\n\n*Automatically created by projen via the "upgrade-main" workflow*',
        author:
          "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
        committer:
          "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
        signoff: true,
      },
    },
  ]);
}

project.synth();
