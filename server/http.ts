export async function readJsonRequest(request: Request, maxBytes = 2_000_000): Promise<Record<string, any>> {
  const text = await request.text();
  if (text.length > maxBytes) throw Object.assign(new Error("Request body is too large."), { code: "REQUEST_TOO_LARGE", httpStatus: 413 });
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { code: "INVALID_JSON", httpStatus: 400 });
  }
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function errorResponse(error: unknown): Response {
  const item = error as { message?: string; code?: string; httpStatus?: number; statusCode?: number };
  const status = Number(item?.httpStatus || item?.statusCode) || 500;
  return jsonResponse({
    ok: false,
    error: item?.code || (status >= 500 ? "SERVER_ERROR" : "INVALID_REQUEST"),
    detail: item?.message || String(error || "Unknown error")
  }, status);
}
