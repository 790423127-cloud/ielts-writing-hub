import { NextResponse } from "next/server";

const DEFAULT_UPSTREAM_BASE = "https://ielts-gt-writing-hub.vercel.app/api";

function scoringEndpoint(): string {
  return (
    process.env.SCORING_UPSTREAM_URL?.trim() ||
    `${process.env.UPSTREAM_BASE_URL?.replace(/\/$/, "") || DEFAULT_UPSTREAM_BASE}/grade-writing`
  );
}

function endpointFor(service: string): string {
  if (service === "grade-writing") return scoringEndpoint();

  const explicit = process.env.UPSTREAM_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return `${explicit}/${service}`;

  const scoring = scoringEndpoint();
  const apiIndex = scoring.lastIndexOf("/api/");
  const base = apiIndex >= 0 ? scoring.slice(0, apiIndex + 4) : DEFAULT_UPSTREAM_BASE;
  return `${base.replace(/\/$/, "")}/${service}`;
}

export async function proxyJson(request: Request, service: string): Promise<Response> {
  try {
    const body = await request.text();
    if (body.length > 2_000_000) {
      return NextResponse.json({ ok: false, error: "Request body is too large." }, { status: 413 });
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    const token = process.env.UPSTREAM_BEARER_TOKEN?.trim();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(endpointFor(service), {
      method: "POST",
      headers,
      body,
      cache: "no-store"
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Upstream request failed.",
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}
