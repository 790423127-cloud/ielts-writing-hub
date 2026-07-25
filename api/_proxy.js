"use strict";

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 })); }
    });
    req.on("error", reject);
  });
}

async function proxyJson(req, res, defaultPath) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = await readBody(req);
    const configured = String(process.env.SCORING_UPSTREAM_URL || "https://ielts-gt-writing-hub.vercel.app/api/grade-writing");
    const base = new URL(configured);
    if (defaultPath && defaultPath !== "/api/grade-writing") base.pathname = defaultPath;

    const headers = { "Content-Type": "application/json", "Accept": "application/json" };
    if (process.env.UPSTREAM_BEARER_TOKEN) headers.Authorization = `Bearer ${process.env.UPSTREAM_BEARER_TOKEN}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 175_000);
    const response = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const text = await response.text();
    res.status(response.status);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
    return res.send(text);
  } catch (error) {
    const status = Number(error.statusCode) || (error.name === "AbortError" ? 504 : 502);
    return res.status(status).json({
      ok: false,
      error: error.name === "AbortError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_PROXY_FAILED",
      detail: error.message || String(error)
    });
  }
}

module.exports = { proxyJson };
