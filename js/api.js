async function postJson(path, payload, signal) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload),
    signal
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(text || `接口返回了无效内容（HTTP ${response.status}）。`); }
  if (!response.ok || data.ok === false) throw new Error(data.detail || data.error || `请求失败（HTTP ${response.status}）。`);
  return data;
}

export function gradeWriting(payload, signal) {
  return postJson("/api/grade-writing", payload, signal);
}

export function requestLearningFeedback(payload, signal) {
  return postJson("/api/writing-feedback", payload, signal);
}

export function requestEssayGeneration(payload, signal) {
  return postJson("/api/essay-generator", payload, signal);
}

export function requestLiveCheck(payload, signal) {
  return postJson("/api/live-check", payload, signal);
}

export function requestCriterionFeedback(payload, signal) {
  return postJson("/api/criterion-feedback", payload, signal);
}
