async function postJson<T>(
  path: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload),
    signal
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || `接口返回了无效内容（HTTP ${response.status}）。`);
  }

  if (!response.ok || (data && typeof data === "object" && "ok" in data && data.ok === false)) {
    const errorData = data as { detail?: string; error?: string };
    throw new Error(errorData.detail || errorData.error || `请求失败（HTTP ${response.status}）。`);
  }

  return data as T;
}

export const apiClient = {
  grade: <T>(payload: Record<string, unknown>, signal?: AbortSignal) =>
    postJson<T>("/api/grade-writing", payload, signal),
  criterionFeedback: <T>(payload: Record<string, unknown>, signal?: AbortSignal) =>
    postJson<T>("/api/criterion-feedback", payload, signal),
  learningFeedback: <T>(payload: Record<string, unknown>, signal?: AbortSignal) =>
    postJson<T>("/api/writing-feedback", payload, signal),
  generateEssay: <T>(payload: Record<string, unknown>, signal?: AbortSignal) =>
    postJson<T>("/api/essay-generator", payload, signal),
  liveCheck: <T>(payload: Record<string, unknown>, signal?: AbortSignal) =>
    postJson<T>("/api/live-check", payload, signal),
  analyseVisual: <T>(payload: Record<string, unknown>, signal?: AbortSignal) =>
    postJson<T>("/api/analyse-visual", payload, signal)
};
