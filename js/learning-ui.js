import { $, els, runtime, syncInputs, escapeHtml, multiline } from "./runtime.js";
import { buildLearningPayload } from "./session.js";
import { saveCurrent, saveToHistory } from "./storage.js";
import { requestLearningFeedback, requestEssayGeneration } from "./api.js";
import { teacherMemoryContext, mergeTeacherMemory, teacherMemoryStats } from "./teacher-memory.js";

function loading(container, title) {
  container.innerHTML = `<div class="loading-card"><span class="spinner"></span><div><strong>${escapeHtml(title)}</strong><p>这一步不会改变已冻结分数，可能需要几十秒。</p></div></div>`;
}

function bilingual(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.zh || value.chinese || value.en || value.english || value.text || "";
}

export async function generateFeedbackModule(moduleName) {
  const session = runtime.session;
  if (!session?.grading?.result) return alert("请先完成评分。");
  if (session.profileId === "academic_task1" && moduleName === "structureCohesionTask") return alert("Academic Task 1 的结构与任务回应模块需要独立图表规则，当前版本不会调用旧的书信规则。评分报告中的 Task Achievement 详情仍可正常使用。");
  syncInputs(); loading(els.feedbackResult, "正在生成详细学习反馈");
  try {
    const result = await requestLearningFeedback(buildLearningPayload(session, { module: moduleName }));
    session.learning.modules[moduleName] = result;
    saveCurrent(session); saveToHistory(session); renderFeedbackModule(result);
  } catch (error) {
    els.feedbackResult.innerHTML = `<div class="error-box"><strong>生成失败</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

export function renderFeedbackModule(payload) {
  const data = payload?.moduleResult || payload?.result || payload || {};
  const moduleName = payload?.module || "";
  const summary = bilingual(data.summary) || data.summaryZh || data.priorityAdvice?.zh || "反馈已生成。";
  let body = `<article class="result-summary"><span class="eyebrow">${escapeHtml(payload?.moduleTitle || moduleName)}</span><p>${multiline(summary)}</p></article>`;

  if (moduleName === "overview") {
    body += `<div class="result-list">${(data.topProblems || []).map((item, index) => `<article><span>${index + 1}</span><div><strong>${escapeHtml(bilingual(item.problem))}</strong><blockquote>${escapeHtml(item.evidence || item.evidenceZh || "")}</blockquote><p>${escapeHtml(bilingual(item.whyMatters))}</p><small>下一步：${escapeHtml(bilingual(item.nextPractice))}</small></div></article>`).join("")}</div>`;
    if (data.nextPracticeFocus?.length) body += `<h3>下次练习重点</h3><div class="mini-cards">${data.nextPracticeFocus.map((item) => `<article><strong>${escapeHtml(bilingual(item.focus))}</strong><p>${escapeHtml(bilingual(item.action))}</p></article>`).join("")}</div>`;
  } else if (moduleName === "sentenceUpgrade") {
    body += `<div class="sentence-cards">${(data.sentenceCards || []).map((item) => `<article><span class="issue-tag">${escapeHtml((item.issueTags || []).join(" · "))}</span><h4>${escapeHtml(item.original || "")}</h4><p><b>最小修正：</b>${escapeHtml(item.minimalCorrection || "")}</p><p><b>升级表达：</b>${escapeHtml(item.upgradedVersion || "")}</p><small>${escapeHtml(bilingual(item.whyBetter))}</small></article>`).join("")}</div>`;
  } else if (moduleName === "grammarWordFormSpelling") {
    const rows = [
      ...(data.grammarErrors || []).map((item) => ({ type: item.errorType || "grammar", original: item.original, corrected: item.corrected, explanation: bilingual(item.explanation) })),
      ...(data.wordFormErrors || []).map((item) => ({ type: item.errorType || "word form", original: item.original, corrected: item.corrected, explanation: bilingual(item.explanation) })),
      ...(data.spellingQuickFix || []).map((item) => ({ type: "spelling", original: item.wrong, corrected: item.correct, explanation: item.note }))
    ];
    body += `<div class="correction-table">${rows.map((item) => `<article><span>${escapeHtml(item.type)}</span><del>${escapeHtml(item.original || "")}</del><ins>${escapeHtml(item.corrected || "")}</ins><p>${escapeHtml(item.explanation || "")}</p></article>`).join("") || "<p>没有返回明确错误列表。</p>"}</div>`;
  } else if (moduleName === "structureCohesionTask") {
    body += `<div class="checklist">${(data.taskChecklist || data.taskResponse?.coverage || []).map((item) => `<article class="status-${escapeHtml(item.status || "unknown")}"><strong>${escapeHtml(item.requirementZh || item.requirement || "任务要求")}</strong><span>${escapeHtml(item.statusZh || item.status || "")}</span><p>${escapeHtml(item.evidenceZh || item.evidence || "")}</p><small>${escapeHtml(bilingual(item.advice))}</small></article>`).join("")}</div>`;
    const areas = [["开头", data.opening], ["段落组织", data.paragraphOrganisation], ["结尾", data.ending], ["任务回应", data.taskResponse]];
    body += `<div class="mini-cards">${areas.filter(([, item]) => item && (item.currentIssueZh || item.currentIssue || item.suggestedVersion)).map(([title, item]) => `<article><strong>${title}</strong><p>${escapeHtml(item.currentIssueZh || item.currentIssue || "")}</p><code>${escapeHtml(item.suggestedVersion || "")}</code></article>`).join("")}</div>`;
  }
  els.feedbackResult.innerHTML = body;
}

export async function generateRevision() {
  const session = runtime.session;
  if (!session?.grading?.result) return alert("请先完成评分。");
  if (session.profileId === "academic_task1") return alert("当前上游范文接口的 Task 1 改写规则以 G 类书信为主。为了避免给图表作文错误建议，本版本暂不开放三步改写。");
  syncInputs(); loading(els.revisionResult, "正在生成范文与两档改写");
  $("generateRevision").disabled = true;
  try {
    const result = await requestEssayGeneration(buildLearningPayload(session, { generationTask: `Task ${session.taskNumber}`, verifyGenerated: false }));
    session.learning.generation = result;
    saveCurrent(session); saveToHistory(session); renderRevision(result);
  } catch (error) {
    els.revisionResult.innerHTML = `<div class="error-box"><strong>生成失败</strong><p>${escapeHtml(error.message)}</p></div>`;
  } finally { $("generateRevision").disabled = false; }
}

function generatedCard(title, item, fallbackTarget) {
  if (!item) return "";
  const essay = item.essay || item.text || item.answer || "";
  const target = item.targetBand ?? fallbackTarget;
  const verified = item.verification?.verifiedBand ?? item.verifiedBand;
  const points = item.studyPoints || item.whatChanged || item.whatChangedFromPlus05 || [];
  return `<article class="generated-card"><header><div><span class="eyebrow">${escapeHtml(title)}</span><h3>目标 Band ${Number(target || 0).toFixed(1)}</h3></div>${verified != null ? `<span class="verified-badge">验证 ${Number(verified).toFixed(1)}</span>` : ""}</header><div class="generated-essay">${multiline(essay)}</div>${points.length ? `<ul>${points.map((point) => `<li>${escapeHtml(typeof point === "string" ? point : bilingual(point))}</li>`).join("")}</ul>` : ""}<button class="copy-generated" data-copy-text="${encodeURIComponent(essay)}" type="button">复制文本</button></article>`;
}

export function renderRevision(result) {
  els.revisionResult.innerHTML = `<div class="generated-grid">${generatedCard("题目范文", result.modelAnswer, result.targetBandModel)}${generatedCard("基于原文 +0.5", result.revisionPlus05, result.targetBandPlus05)}${generatedCard("基于原文 +1.0", result.revisionPlus10, result.targetBandPlus10)}</div>`;
  els.revisionResult.querySelectorAll("[data-copy-text]").forEach((button) => button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(decodeURIComponent(button.dataset.copyText)); button.textContent = "已复制";
  }));
}

export async function generateTeacherClinic() {
  const session = runtime.session;
  if (!session?.grading?.result) return alert("请先完成评分。");
  if (session.profileId === "academic_task1") return alert("Academic Task 1 的教师精讲需要独立 overview、比较和数据准确性规则。当前版本不会套用 G 类书信教师规则。");
  syncInputs(); loading(els.teacherResult, "正在生成教师精讲并读取错误记忆");
  $("generateTeacherClinic").disabled = true;
  try {
    const result = await requestLearningFeedback(buildLearningPayload(session, { module: "expressionBank", errorMemoryContext: teacherMemoryContext(session.profileId) }));
    session.learning.teacherClinic = result;
    mergeTeacherMemory(session.profileId, result.moduleResult?.memoryUpdate);
    saveCurrent(session); saveToHistory(session); renderTeacherClinic(result); renderMemoryStats();
  } catch (error) {
    els.teacherResult.innerHTML = `<div class="error-box"><strong>生成失败</strong><p>${escapeHtml(error.message)}</p></div>`;
  } finally { $("generateTeacherClinic").disabled = false; }
}

export function renderTeacherClinic(payload) {
  const data = payload?.moduleResult || payload || {};
  const opening = data.teacherOpening || {};
  let html = `<article class="teacher-opening"><span class="eyebrow">AI TEACHER</span><h3>${escapeHtml(opening.todayMainGoalZh || "本次教师精讲")}</h3><p>${escapeHtml(opening.diagnosisZh || bilingual(data.summary) || "")}</p>${opening.whatYouDidWellZh ? `<div class="praise-box">${escapeHtml(opening.whatYouDidWellZh)}</div>` : ""}</article>`;
  html += `<div class="teacher-issues">${(data.teachingIssues || []).map((issue, index) => `<details open><summary><span>${index + 1}</span><strong>${escapeHtml(issue.issueTitleZh || issue.issueTitleEn || "语言问题")}</strong><em>${escapeHtml(issue.severity || "")}</em></summary><div><p>${escapeHtml(issue.slowLearnerExplanationZh || issue.whyTeacherPickedThisZh || "")}</p>${(issue.examplesFromYourEssay || []).map((example) => `<article class="teacher-example"><del>${escapeHtml(example.original || "")}</del><p><b>保底修正：</b>${escapeHtml(example.survivalCorrection || "")}</p><p><b>自然升级：</b>${escapeHtml(example.naturalUpgrade || "")}</p><small>${escapeHtml(example.whyWrongZh || example.whatIsWrongZh || "")}</small></article>`).join("")}<div class="rule-box"><strong>${escapeHtml(issue.coreRule?.formula || "记忆规则")}</strong><p>${escapeHtml(issue.coreRule?.ruleZh || "")}</p></div></div></details>`).join("")}</div>`;
  if (data.homeworkTemplate?.tasks?.length) html += `<article class="homework-card"><h3>${escapeHtml(data.homeworkTemplate.titleZh || "本次作业")}</h3><ol>${data.homeworkTemplate.tasks.map((task) => `<li>${escapeHtml(task.instructionZh || "")}</li>`).join("")}</ol></article>`;
  els.teacherResult.innerHTML = html;
}

export function renderMemoryStats() {
  const stats = teacherMemoryStats();
  els.memoryStats.innerHTML = `<span>A1 <strong>${stats.academicTask1}</strong></span><span>G1 <strong>${stats.generalTask1}</strong></span><span>A2 <strong>${stats.academicTask2}</strong></span><span>G2 <strong>${stats.generalTask2}</strong></span><span>通用语言 <strong>${stats.sharedLanguage}</strong></span>`;
}

export function renderLearningState() {
  const session = runtime.session;
  const academicTask1 = session?.profileId === "academic_task1";
  const structureButton = document.querySelector('[data-feedback-module="structureCohesionTask"]');
  if (structureButton) { structureButton.disabled = academicTask1; structureButton.title = academicTask1 ? "Academic Task 1 独立结构模块将在专用规则接入后开放" : ""; }
  $("generateRevision").disabled = academicTask1;
  $("generateTeacherClinic").disabled = academicTask1;
  const modules = session?.learning?.modules || {};
  const latest = Object.keys(modules).at(-1);
  els.feedbackResult.innerHTML = latest ? "" : `<p class="muted">选择一个模块生成反馈。</p>`;
  if (latest) renderFeedbackModule(modules[latest]);
  if (session?.learning?.generation) renderRevision(session.learning.generation);
  else els.revisionResult.innerHTML = academicTask1 ? `<div class="notice"><strong>Academic Task 1 安全限制</strong><p>当前上游 Task 1 范文接口仍含书信规则，因此暂不开放。</p></div>` : `<p class="muted">评分完成后可生成学习版本。</p>`;
  if (session?.learning?.teacherClinic) renderTeacherClinic(session.learning.teacherClinic);
  else els.teacherResult.innerHTML = academicTask1 ? `<div class="notice"><strong>Academic Task 1 安全限制</strong><p>专用图表教师模块接入前，不会调用旧的书信教师规则。</p></div>` : `<p class="muted">教师记忆会按 A类Task 1、G类Task 1、A类Task 2、G类Task 2 分开保存。</p>`;
  renderMemoryStats();
}

export function switchLearningTab(name) {
  document.querySelectorAll("[data-learning-tab]").forEach((button) => button.classList.toggle("active", button.dataset.learningTab === name));
  $("learningFeedback").classList.toggle("hidden", name !== "feedback");
  $("learningRevision").classList.toggle("hidden", name !== "revision");
  $("learningTeacher").classList.toggle("hidden", name !== "teacher");
}
