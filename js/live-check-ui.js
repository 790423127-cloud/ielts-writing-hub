import { els, runtime, syncInputs, escapeHtml } from "./runtime.js";
import { saveCurrent } from "./storage.js";
import { requestLiveCheck } from "./api.js";

function lastSentenceSegment(text) {
  const value = String(text || "");
  const trimmedEnd = value.trimEnd().length;
  const prefix = value.slice(0, trimmedEnd);
  const matches = [...prefix.matchAll(/(?:^|[.!?]\s+)([^.!?]+[.!?]?)(?=\s*$)/g)];
  if (matches.length) {
    const sentence = matches.at(-1)[1].trim();
    return { text: sentence, offsetStart: Math.max(0, prefix.lastIndexOf(sentence)) };
  }
  const sentence = (prefix.split(/\n+/).at(-1) || "").trim().slice(-650);
  return { text: sentence, offsetStart: Math.max(0, prefix.lastIndexOf(sentence)) };
}

export async function quickCheckLastSentence() {
  const session = runtime.session;
  if (!session) return;
  syncInputs();
  const segment = lastSentenceSegment(session.writing.essay);
  if (segment.text.length < 8) return alert("请先输入一个完整句子。");
  els.liveCheckPanel.classList.remove("hidden");
  els.liveCheckContent.innerHTML = `<div class="loading-row"><span class="spinner"></span><p>正在检查最后一句，只返回高置信度问题…</p></div>`;
  els.quickCheckButton.disabled = true;
  try {
    const result = await requestLiveCheck({ text: segment.text.slice(0, 650), offsetStart: segment.offsetStart, task: `Task ${session.taskNumber}`, prompt: session.prompt.text, mode: "help" });
    session.learning.liveSuggestions = result.suggestions || [];
    saveCurrent(session);
    renderLiveSuggestions();
  } catch (error) {
    els.liveCheckContent.innerHTML = `<div class="error-box"><strong>快速检查失败</strong><p>${escapeHtml(error.message)}</p></div>`;
  } finally {
    els.quickCheckButton.disabled = false;
  }
}

export function renderLiveSuggestions() {
  const suggestions = runtime.session?.learning?.liveSuggestions || [];
  if (!suggestions.length) {
    if (!els.liveCheckPanel.classList.contains("hidden")) els.liveCheckContent.innerHTML = `<p class="success-note">没有发现达到置信度门槛的明确错误。系统不会为了显得有用而强行改写。</p>`;
    return;
  }
  els.liveCheckPanel.classList.remove("hidden");
  els.liveCheckContent.innerHTML = suggestions.map((item, index) => `
    <article class="suggestion-card"><div><span class="issue-tag">${escapeHtml(item.type || "language")}</span><strong>${escapeHtml(item.original)}</strong><p>${escapeHtml(item.messageZh || item.message || "")}</p><code>${escapeHtml(item.replacement)}</code></div><button data-apply-suggestion="${index}" type="button">应用</button></article>`).join("");
  els.liveCheckContent.querySelectorAll("[data-apply-suggestion]").forEach((button) => button.addEventListener("click", () => applySuggestion(Number(button.dataset.applySuggestion))));
}

function applySuggestion(index) {
  const session = runtime.session;
  const item = session?.learning?.liveSuggestions?.[index];
  if (!item) return;
  const essay = els.essay.value;
  const start = Number(item.globalStart), end = Number(item.globalEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || essay.slice(start, end) !== item.original) return alert("作文已经变化，请重新运行快速检查。");
  els.essay.value = `${essay.slice(0, start)}${item.replacement}${essay.slice(end)}`;
  session.learning.liveSuggestions = [];
  syncInputs();
  els.liveCheckPanel.classList.add("hidden");
}
