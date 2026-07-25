export async function gradeWriting(payload, signal) {
  const response = await fetch("/api/grade-writing", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload),
    signal
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(text || `评分接口返回了无效内容（HTTP ${response.status}）。`); }
  if (!response.ok || data.ok === false) throw new Error(data.detail || data.error || `评分失败（HTTP ${response.status}）。`);
  return data;
}
