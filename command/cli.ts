#!/usr/bin/env bun
import { buildLayerCommand } from "./layer";

const usage = `Usage: bun-lambda-runtime <command>

Commands:
  build-layer [version] [--out <dir>]   Build the Bun Lambda layer zip (arm64, provided.al2023)`;

const [command, ...rest] = process.argv.slice(2);

if (command === "build-layer") {
  await buildLayerCommand(rest);
} else {
  console.error(usage);
  process.exit(command == null || command === "--help" ? 0 : 1);
}
