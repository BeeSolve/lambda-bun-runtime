import * as path from "node:path";
import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { BunFunction, BunLambdaLayer } from "@beesolve/lambda-bun-runtime";
import { Construct } from "constructs";

const src = (file: string) => path.join(__dirname, "../src", file);

export class SampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bunLayer = new BunLambdaLayer(this, "BunLayer");

    // HTTP v2 — Function URL
    const httpV2Fn = new BunFunction(this, "HttpV2Fn", {
      entrypoint: src("http-v2.ts"),
      bunLayer,
    });
    const fnUrl = httpV2Fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // HTTP v2 plain (raw event, no adapter) — Function URL
    const httpV2PlainFn = new BunFunction(this, "HttpV2PlainFn", {
      entrypoint: src("http-v2-plain.ts"),
      bunLayer,
    });
    const plainFnUrl = httpV2PlainFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // HTTP v1 — REST API
    const httpV1Fn = new BunFunction(this, "HttpV1Fn", {
      entrypoint: src("http-v1.ts"),
      bunLayer,
    });
    const restApi = new apigw.LambdaRestApi(this, "HttpV1Api", {
      handler: httpV1Fn,
      proxy: true,
    });

    // Echo — direct invoke
    const echoFn = new BunFunction(this, "EchoFn", {
      entrypoint: src("echo.ts"),
      bunLayer,
    });

    // S3 writer — direct invoke, Bun-native S3
    const testBucket = new s3.Bucket(this, "TestBucket", {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const s3WriterFn = new BunFunction(this, "S3WriterFn", {
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
    new CfnOutput(this, "S3WriterFnArn", { value: s3WriterFn.functionArn });
    new CfnOutput(this, "TestBucketName", { value: testBucket.bucketName });
  }
}
