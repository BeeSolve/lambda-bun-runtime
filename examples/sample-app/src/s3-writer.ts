import { S3Client } from "bun";

export const handler = async (event: { key: string; content: string }) => {
  const client = new S3Client({ bucket: process.env.BUCKET_NAME });
  await client.write(event.key, event.content);
  return { written: true, key: event.key };
};
