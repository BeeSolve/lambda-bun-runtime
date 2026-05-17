import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const cookies = Object.fromEntries(
    (event.cookies ?? []).map((c) => {
      const eq = c.indexOf("=");
      return eq === -1 ? ["", ""] : [c.slice(0, eq).trim(), c.slice(eq + 1).trim()];
    }),
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    cookies: ["it_cookie=server-set; Path=/; HttpOnly"],
    body: JSON.stringify({ ok: true, eventVersion: "v2-plain", requestCookie: cookies["it_cookie"] }),
  };
};
