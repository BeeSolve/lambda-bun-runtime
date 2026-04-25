import { Duration, CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  FunctionUrlAuthType,
  HttpMethod,
} from "aws-cdk-lib/aws-lambda";
import { LambdaIntegration, LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import { BunFunction, BunLambdaLayer } from "../../..";

export class SampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bunLayer = new BunLambdaLayer(this, "BunLayer");
    const handler = new BunFunction(this, "BunHandler", {
      entrypoint: `${__dirname}/../dist/handler.js`,
      timeout: Duration.seconds(20),
      memorySize: 512,
      bunLayer,
    });

    const restApi = new LambdaRestApi(this, "RestV1Api", {
      handler,
      proxy: true,
      defaultMethodOptions: {
        apiKeyRequired: false,
      },
    });

    const functionUrl = handler.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      cors: {
        allowedMethods: [HttpMethod.ALL],
        allowedOrigins: ["*"],
      },
    });

    new CfnOutput(this, "RestApiUrl", { value: restApi.url });
    new CfnOutput(this, "FunctionUrl", { value: functionUrl.url });
  }
}
