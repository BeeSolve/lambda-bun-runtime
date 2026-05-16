import { asHttpV2Handler } from "@beesolve/lambda-fetch-api";

function parseCookies(header: string): Record<string, string> {
  return Object.fromEntries(
    header
      .split(";")
      .map((c) => c.trim().split(/=(.*)/).slice(0, 2))
      .filter((p) => p.length === 2 && p[0])
      .map(([k, v]) => [k.trim(), (v ?? "").trim()]),
  );
}

const fetch = async (request: Request): Promise<Response> => {
  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  return new Response(
    JSON.stringify({ ok: true, eventVersion: "v2", requestCookie: cookies["it_cookie"] }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "it_cookie=server-set; Path=/; HttpOnly",
      },
    },
  );
};

export const handler = asHttpV2Handler(fetch);
export default { fetch };
