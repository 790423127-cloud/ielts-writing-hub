export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

export interface AiCallOptions {
  role?: string;
  model?: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  baseUrl?: string;
  apiKey?: string;
  thinking?: "enabled" | "disabled";
  reasoningEffort?: "low" | "medium" | "high";
}

export interface AiCallResult<T> {
  data: T;
  audit: {
    role: string;
    model: string;
    attempt: number;
    finishReason: string;
    usage: unknown;
    requestId: string;
    elapsedMs: number;
  };
}

export class AiProviderError extends Error {
  code: string;
  httpStatus: number;

  constructor(message: string, code = "AI_PROVIDER_ERROR", httpStatus = 502) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function stripFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export function parseJsonContent<T = Record<string, unknown>>(content: string): T {
  const raw = stripFence(String(content || ""));
  if (!raw) throw new AiProviderError("AI returned empty content.", "EMPTY_AI_RESPONSE", 502);
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as T;
      } catch {
        // Continue to the structured error below.
      }
    }
  }
  throw new AiProviderError("AI did not return valid JSON.", "INVALID_AI_JSON", 502);
}

export function modelForRole(role = "examiner"): string {
  if (role === "high_specialist") {
    return env("SCORE_HIGH_SPECIALIST_MODEL") || env("SCORE_TEACHER_MODEL") || "deepseek-v4-pro";
  }
  if (["adjudicator", "criterion_profile_adjudicator", "generated_verifier"].includes(role)) {
    return env("SCORE_ADJUDICATOR_MODEL") || "deepseek-v4-flash";
  }
  if (["teacher", "feedback", "generator"].includes(role)) {
    return env("SCORE_TEACHER_MODEL") || env("SCORE_FEEDBACK_MODEL") || "deepseek-v4-pro";
  }
  return env("SCORE_EXAMINER_MODEL") || env("DEEPSEEK_MODEL") || "deepseek-v4-flash";
}

export async function callJson<T = Record<string, unknown>>(options: AiCallOptions): Promise<AiCallResult<T>> {
  const role = options.role || "examiner";
  const apiKey = options.apiKey || env("DEEPSEEK_API_KEY") || env("DEEPSEEK_KEY") || env("AI_API_KEY");
  if (!apiKey) {
    throw new AiProviderError(
      "Missing DEEPSEEK_API_KEY in the new Vercel project.",
      "MISSING_API_KEY",
      503
    );
  }

  const model = options.model || modelForRole(role);
  const baseUrl = options.baseUrl || env("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/chat/completions";
  const timeoutMs = Math.max(20_000, Math.min(options.timeoutMs || numberEnv("AI_REQUEST_TIMEOUT_MS", 120_000), 240_000));
  const maxTokens = Math.max(500, Math.min(options.maxTokens || 6_000, 16_000));
  const startedAt = Date.now();
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    let callerAborted = false;
    const forwardAbort = () => {
      callerAborted = true;
      controller.abort();
    };
    if (options.signal?.aborted) {
      throw new AiProviderError("The request was cancelled.", "REQUEST_CANCELLED", 499);
    }
    options.signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const thinking = options.thinking || (env("DEEPSEEK_THINKING") === "enabled" ? "enabled" : "disabled");
      const body: Record<string, unknown> = {
        model,
        messages: options.messages,
        response_format: { type: "json_object" },
        max_tokens: attempt === 1 ? maxTokens : Math.ceil(maxTokens * 1.2),
        temperature: options.temperature ?? 0.15,
        thinking: { type: thinking }
      };
      if (thinking === "enabled") {
        body.reasoning_effort = options.reasoningEffort || "medium";
      }

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store"
      });

      const raw = await response.text();
      let payload: Record<string, any> = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { raw };
      }

      if (!response.ok) {
        const message = String(payload?.error?.message || payload?.message || raw.slice(0, 500) || `HTTP ${response.status}`);
        const retryable = response.status === 429 || response.status >= 500;
        const error = new AiProviderError(message, "AI_HTTP_ERROR", response.status);
        if (!retryable || attempt === 2) throw error;
        lastError = error;
        continue;
      }

      const choice = payload?.choices?.[0] || {};
      if (choice.finish_reason === "length") {
        const error = new AiProviderError("AI JSON was truncated at max_tokens.", "AI_OUTPUT_TRUNCATED", 502);
        if (attempt === 2) throw error;
        lastError = error;
        continue;
      }

      const content = String(choice?.message?.content || payload?.output_text || payload?.content || "");
      return {
        data: parseJsonContent<T>(content),
        audit: {
          role,
          model: String(payload.model || model),
          attempt,
          finishReason: String(choice.finish_reason || ""),
          usage: payload.usage || null,
          requestId: response.headers.get("x-request-id") || "",
          elapsedMs: Date.now() - startedAt
        }
      };
    } catch (error) {
      if (callerAborted || options.signal?.aborted) {
        throw new AiProviderError("The request was cancelled.", "REQUEST_CANCELLED", 499);
      }
      if (error instanceof AiProviderError) {
        lastError = error;
        if (attempt === 2 || (error.httpStatus >= 400 && error.httpStatus < 500 && error.httpStatus !== 429)) throw error;
      } else if ((error as Error)?.name === "AbortError") {
        throw new AiProviderError(`AI request timed out after ${timeoutMs} ms.`, "AI_TIMEOUT", 504);
      } else {
        lastError = error;
        if (attempt === 2) throw new AiProviderError(String((error as Error)?.message || error), "AI_REQUEST_FAILED", 502);
      }
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", forwardAbort);
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new AiProviderError("AI request failed.", "AI_REQUEST_FAILED", 502);
}
