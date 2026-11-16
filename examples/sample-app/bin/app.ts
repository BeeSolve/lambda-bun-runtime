import { App } from "aws-cdk-lib";

import { SampleStack } from "../lib/sample-stack";

const app = new App();
new SampleStack(app, process.env.INTEG_STACK_NAME ?? "BunLayerInteg-local", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
