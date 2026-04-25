import {
  getCurrentAwsContext,
  getCurrentAwsEvent,
  type AwsEvent,
} from "./aws-invocation-context";

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }
  const pairs = cookieHeader.split(";");
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.trim().split("=");
    if (!rawName || rest.length === 0) {
      continue;
    }
    result[rawName] = rest.join("=");
  }
  return result;
}

function detectEventVersion(event: AwsEvent | undefined): "v1" | "v2" | "unknown" {
  if (event?.version === "2.0") {
    return "v2";
  }
  if (event?.requestContext) {
    return "v1";
  }
  return "unknown";
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const cookies = parseCookies(request.headers.get("cookie"));
    const awsEvent = getCurrentAwsEvent();
    const awsContext = getCurrentAwsContext();
    const eventVersion = detectEventVersion(awsEvent);
    const requestCookie = cookies.it_cookie ?? null;

    const headers = new Headers({
      "content-type": "application/json",
    });
    headers.append("Set-Cookie", "it_cookie=server-set; Path=/; HttpOnly");
    headers.append("Set-Cookie", "it_mode=integration; Path=/");

    return new Response(
      JSON.stringify({
        ok: true,
        path: url.pathname,
        method: request.method,
        eventVersion,
        requestCookie,
        requestId: awsContext?.awsRequestId ?? awsEvent?.requestContext?.requestId ?? null,
      }),
      {
        status: 200,
        headers,
      },
    );
  },
};
