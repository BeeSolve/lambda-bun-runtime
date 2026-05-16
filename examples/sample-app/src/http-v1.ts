import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

function parseCookies(header: string): Record<string, string> {
  return Object.fromEntries(
    header
      .split(";")
      .map((c) => c.trim().split(/=(.*)/).slice(0, 2))
      .filter((p) => p.length === 2 && p[0])
      .map(([k, v]) => [k.trim(), (v ?? "").trim()]),
  );
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const cookies = parseCookies(event.headers["Cookie"] ?? event.headers["cookie"] ?? "");
  return {
    statusCode: 200,
    headers: { "Set-Cookie": "it_cookie=server-set; Path=/" },
    body: JSON.stringify({ ok: true, eventVersion: "v1", requestCookie: cookies["it_cookie"] }),
  };
};
