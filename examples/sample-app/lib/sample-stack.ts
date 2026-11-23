import * as path from "node:path";
import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { BunFunction, BunFunctionWithLayer, BunLambdaLayer } from "@beesolve/lambda-bun-runtime";
import { Construct } from "constructs";

const src = (file: string) => path.join(__dirname, "../src", file);

export class SampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Published layer by default. Set BUN_LAYER_ZIP to deploy a locally built layer zip
    // (PR integration runs, where no layer is published yet).
    const layerZip = process.env.BUN_LAYER_ZIP;
    const bunLayer = new BunLambdaLayer(this, "BunLayer", {
      ...(layerZip == null ? {} : { assetZipPath: layerZip }),
    });

    // HTTP v2 — Function URL
    const httpV2Fn = new BunFunctionWithLayer(this, "HttpV2Fn", {
      entrypoint: src("http-v2.ts"),
      bunLayer,
    });
    const fnUrl = httpV2Fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // HTTP v2 plain (raw event, no adapter) — Function URL
    const httpV2PlainFn = new BunFunctionWithLayer(this, "HttpV2PlainFn", {
      entrypoint: src("http-v2-plain.ts"),
      bunLayer,
    });
    const plainFnUrl = httpV2PlainFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // HTTP v1 — REST API
    const httpV1Fn = new BunFunctionWithLayer(this, "HttpV1Fn", {
      entrypoint: src("http-v1.ts"),
      bunLayer,
    });
    const restApi = new apigw.LambdaRestApi(this, "HttpV1Api", {
      handler: httpV1Fn,
      proxy: true,
    });

    // Echo — direct invoke
    const echoFn = new BunFunctionWithLayer(this, "EchoFn", {
      entrypoint: src("echo.ts"),
      bunLayer,
    });

    // Echo on the customer-managed runtime. Needs the published runtime for the stack's region,
    // so it is only deployed when BUN_CMR=1 (release runs).
    const cmrEchoFn =
      process.env.BUN_CMR === "1"
        ? new BunFunction(this, "CmrEchoFn", { entrypoint: src("echo.ts") })
        : undefined;

    // Streaming — async generator handler, invoked via InvokeWithResponseStream
    const streamingFn = new BunFunctionWithLayer(this, "StreamingFn", {
      entrypoint: src("streaming.ts"),
      bunLayer,
    });

    // S3 writer — direct invoke, Bun-native S3
    const testBucket = new s3.Bucket(this, "TestBucket", {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const s3WriterFn = new BunFunctionWithLayer(this, "S3WriterFn", {
      entrypoint: src("s3-writer.ts"),
      bunLayer,
      environment: { BUCKET_NAME: testBucket.bucketName },
    });
    testBucket.grantPut(s3WriterFn);
    // Bun S3Client also needs GetObject to verify writes in some implementations
    s3WriterFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [testBucket.arnForObjects("*")],
      }),
    );

    new CfnOutput(this, "HttpV2FunctionUrl", { value: fnUrl.url });
    new CfnOutput(this, "HttpV2PlainFunctionUrl", { value: plainFnUrl.url });
    new CfnOutput(this, "HttpV1RestApiUrl", { value: restApi.url });
    new CfnOutput(this, "EchoFnArn", { value: echoFn.functionArn });
    if (cmrEchoFn != null) {
      new CfnOutput(this, "CmrEchoFnArn", { value: cmrEchoFn.functionArn });
    }
    new CfnOutput(this, "S3WriterFnArn", { value: s3WriterFn.functionArn });
    new CfnOutput(this, "TestBucketName", { value: testBucket.bucketName });
    new CfnOutput(this, "StreamingFnArn", { value: streamingFn.functionArn });
  }
}
