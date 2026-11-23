#!/usr/bin/env bun
import { buildLayerCommand } from "./layer";
import { publishRuntimeCommand } from "./publishRuntime";

const usage = `Usage: bun-lambda-runtime <command>

Commands:
  build-layer [version] [--out <dir>]   Build the Bun Lambda layer zip (arm64, provided.al2023)
  publish-runtime --region <region> [version] [--name <runtime>] [--alias <name>]...
                                        Build the Bun runtime image and publish it as a Lambda
                                        customer-managed runtime in your account (needs the AWS
                                        CLI and Docker with buildx)`;

const [command, ...rest] = process.argv.slice(2);

if (command === "build-layer") {
  await buildLayerCommand(rest);
} else if (command === "publish-runtime") {
  await publishRuntimeCommand(rest);
} else {
  console.error(usage);
  process.exit(command == null || command === "--help" ? 0 : 1);
}
