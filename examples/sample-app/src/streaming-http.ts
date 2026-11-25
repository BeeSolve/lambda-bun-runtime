import { asResponseStreamHandler } from "@beesolve/lambda-fetch-api";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const handler = asResponseStreamHandler(async (): Promise<Response> => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const index of [1, 2, 3, 4, 5]) {
        controller.enqueue(encoder.encode(`chunk ${index}\n`));
        await delay(300);
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 201,
    headers: { "content-type": "text/plain", "x-custom": "prelude" },
  });
});
