#!/bin/bash

set -e

VERSION="1.3.8"
TAG="bun-v$VERSION"

TMPDIR=${TMPDIR:-/tmp}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd "$TMPDIR" && \
mkdir bun-layer && \
cd bun-layer && \
git clone --filter=blob:none --sparse https://github.com/oven-sh/bun.git && \
cd bun && \
git checkout "$TAG" && \
git sparse-checkout set packages/bun-lambda && \
cd packages/bun-lambda && \
cp "$SCRIPT_DIR/runtime.ts" . && \
bun install && \
bun run build-layer && \
mv ./bun-lambda-layer.zip "$SCRIPT_DIR/../lib/bun-lambda-layer-$VERSION.zip" && \
cd - && \
cd ../.. && \
rm -rf bun-layer
