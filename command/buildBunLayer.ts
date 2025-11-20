import { $ } from "bun";

await $`cd ${process.env.TMPDIR} && \
  mkdir bun-layer && \
  cd bun-layer && \
  git clone --filter=blob:none --sparse https://github.com/oven-sh/bun.git && \
  git -C bun sparse-checkout set packages/bun-lambda && \
  cd bun/packages/bun-lambda && \
  cp ${__dirname}/runtime.ts . && \
  bun install && \
  bun run build-layer && \
  mv ./bun-lambda-layer.zip ${__dirname}/../bun-lambda-layer.zip && \
  cd - && \
  cd .. && \
  rm -rf bun-layer`;
