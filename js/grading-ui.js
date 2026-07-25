import { els, runtime, syncInputs, conflictMessage, escapeHtml, setView, renderDashboardStats } from "./runtime.js";
import { buildScoringPayload, touchSession } from "./session.js";
import { saveCurrent, saveToHistory } from "./storage.js";
import { gradeWriting } from "./api.js";

export async function submitGrading({ renderHistory, renderReport }) {
  const session = runtime.session;
  if (!session) return;
  syncInputs();
  const message = conflictMessage();
  if (message && !confirm(`${message}\n\n仍然按当前选择评分吗？`)) return;
  let payload;
  try { payload = buildScoringPayload(session); }
  catch (error) { return alert(error.message); }

  runtime.activeController?.abort();
  runtime.activeController = new AbortController();
  els.gradeButton.disabled = true;
  els.gradingState.classList.remove("hidden");
  els.gradingState.innerHTML = `<span class="spinner"></span><div><strong>正在调用统一评分核心</strong><p>双评分官、边界复核和四项分冻结可能需要一些时间。</p></div>`;
  session.grading.status = "running";
  session.grading.error = "";
  saveCurrent(session);

  try {
    const result = await gradeWriting(payload, runtime.activeController.signal);
    session.grading = { status: "completed", result, error: "" };
    touchSession(session); saveCurrent(session); saveToHistory(session);
    renderHistory(); renderDashboardStats(); renderReport(result); setView(els.report);
  } catch (error) {
    session.grading = { status: "error", result: null, error: error.message };
    saveCurrent(session);
    els.gradingState.innerHTML = `<div class="error-box"><strong>评分失败</strong><p>${escapeHtml(error.message)}</p></div>`;
  } finally {
    els.gradeButton.disabled = false;
    runtime.activeController = null;
  }
}
