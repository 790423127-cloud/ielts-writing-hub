import { proxyJson } from "../_shared/proxy";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  return proxyJson(request, "grade-writing");
}
