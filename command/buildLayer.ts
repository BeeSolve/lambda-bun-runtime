#!/usr/bin/env bun
import { buildLayerCommand } from "./layer";

await buildLayerCommand(process.argv.slice(2));
