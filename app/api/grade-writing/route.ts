import { runUnifiedScoring } from "@/server/scoring/engine.ts";
import { errorResponse, jsonResponse, readJsonRequest } from "@/server/http.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonRequest(request);
    const result = await runUnifiedScoring(body, { signal: request.signal });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
