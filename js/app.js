import { TASK_PROFILES, getTaskProfile } from "./task-profiles.js";
import { createSession, buildScoringPayload, countWords, touchSession } from "./session.js";
import { saveCurrent, loadCurrent, saveToHistory, loadHistory, removeHistory, clearAllData, saveTheme, loadTheme } from "./storage.js";
import { gradeWriting } from "./api.js";

const $ = (id) => document.getElementById(id);
const els = {
  dashboard: $("dashboard"), workspace: $("workspace"), report: $("report"),
  profileGrid: $("profileGrid"), profileBadge: $("profileBadge"), workspaceTitle: $("workspaceTitle"),
  promptTitle: $("promptTitle"), promptText: $("promptText"), questionType: $("questionType"),
  letterStyleWrap: $("letterStyleWrap"), letterStyle: $("letterStyle"), visualPanel: $("visualPanel"),
  visualType: $("visualType"), visualDescription: $("visualDescription"), visualFeatures: $("visualFeatures"),
  visualVerified: $("visualVerified"), imageInput: $("imageInput"), imagePreview: $("imagePreview"),
  imageEmpty: $("imageEmpty"), essay: $("essay"), plan: $("plan"), wordCount: $("wordCount"), wordTarget: $("wordTarget"),
  timer: $("timer"), timerButton: $("timerButton"), resetTimer: $("resetTimer"), saveStatus: $("saveStatus"),
  gradeButton: $("gradeButton"), gradingState: $("gradingState"), historyList: $("historyList"),
  overallBand: $("overallBand"), reportMeta: $("reportMeta"), criteriaGrid: $("criteriaGrid"),
  assessment: $("assessment"), warningList: $("warningList"), reportDetails: $("reportDetails"), themeToggle: $("themeToggle")
};

let session = loadCurrent();
let timerHandle = null;
let saveHandle = null;
let gradingController = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function setView(view) {
  [els.dashboard, els.workspace, els.report].forEach((node) => node.classList.add("hidden"));
  view.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderProfiles() {
  els.profileGrid.innerHTML = Object.values(TASK_PROFILES).map((profile) => `
    <button class="profile-card" data-profile="${profile.id}" type="button">
      <span class="profile-code">${profile.accent}</span>
      <strong>${escapeHtml(profile.title)}</strong>
      <small>${escapeHtml(profile.label)}</small>
      <p>${escapeHtml(profile.description)}</p>
      <em>${profile.minutes} 分钟 · 至少 ${profile.minimumWords} 词</em>
    </button>`).join("");
  els.profileGrid.querySelectorAll("[data-profile]").forEach((button) => {
    button.addEventListener("click", () => startSession(button.dataset.profile));
  });
}

function startSession(profileId) {
  stopTimer();
  session = createSession(profileId);
  saveCurrent(session);
  renderWorkspace();
  setView(els.workspace);
}

function restoreSession(saved) {
  stopTimer();
  session = saved;
  session.timer.running = false;
  saveCurrent(session);
  renderWorkspace();
  setView(els.workspace);
}

function renderWorkspace() {
  if (!session) return setView(els.dashboard);
  const profile = getTaskProfile(session.profileId);
  els.profileBadge.textContent = profile.label;
  els.workspaceTitle.textContent = profile.title;
  els.promptTitle.value = session.prompt.title || "";
  els.promptText.value = session.prompt.text || "";
  els.questionType.value = session.prompt.questionType || "";
  els.letterStyle.value = session.prompt.letterStyle || "";
  els.letterStyleWrap.classList.toggle("hidden", profile.taskKind !== "gt_letter");
  els.visualPanel.classList.toggle("hidden", profile.taskKind !== "academic_visual_report");
  els.visualType.value = session.prompt.visualFacts?.visualType || "unknown";
  els.visualDescription.value = session.prompt.visualFacts?.referenceDescription || "";
  els.visualFeatures.value = (session.prompt.visualFacts?.keyFeatures || []).join("\n");
  els.visualVerified.checked = session.prompt.visualFacts?.sourceVerified === true;
  els.essay.value = session.writing.essay || "";
  els.plan.value = session.writing.plan || "";
  els.wordTarget.textContent = ` / ${profile.minimumWords} words`;
  renderWordCount();
  renderTimer();
  renderImage();
}

function updateSessionFromInputs() {
  if (!session) return;
  session.prompt.title = els.promptTitle.value;
  session.prompt.text = els.promptText.value;
  session.prompt.questionType = els.questionType.value;
  session.prompt.letterStyle = els.letterStyle.value;
  session.writing.essay = els.essay.value;
  session.writing.plan = els.plan.value;
  session.prompt.visualFacts = {
    ...(session.prompt.visualFacts || {}),
    visualType: els.visualType.value,
    referenceDescription: els.visualDescription.value,
    keyFeatures: els.visualFeatures.value.split(/\n+/).map((item) => item.trim()).filter(Boolean),
    sourceVerified: els.visualVerified.checked,
    verificationNote: els.visualVerified.checked ? "Confirmed by the user in the writing workspace." : ""
  };
  touchSession(session);
  scheduleSave();
  renderWordCount();
}

function scheduleSave() {
  clearTimeout(saveHandle);
  els.saveStatus.textContent = "正在保存…";
  saveHandle = setTimeout(() => {
    saveCurrent(session);
    els.saveStatus.textContent = "已保存到本机";
  }, 300);
}

function renderWordCount() {
  const value = countWords(els.essay.value);
  els.wordCount.textContent = value;
  if (session) session.writing.wordCount = value;
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(safe / 60).toString().padStart(2, "0");
  const s = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function renderTimer() {
  els.timer.textContent = formatTime(session?.timer?.remainingSeconds || 0);
  els.timerButton.textContent = timerHandle ? "暂停" : "开始";
}

function toggleTimer() {
  if (!session) return;
  if (timerHandle) return stopTimer();
  session.timer.running = true;
  timerHandle = setInterval(() => {
    session.timer.remainingSeconds = Math.max(0, session.timer.remainingSeconds - 1);
    renderTimer();
    if (session.timer.remainingSeconds === 0) stopTimer();
  }, 1000);
  renderTimer();
}

function stopTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
  if (session?.timer) session.timer.running = false;
  if (session) saveCurrent(session);
  if (els.timerButton) renderTimer();
}

function resetTimer() {
  if (!session) return;
  stopTimer();
  const profile = getTaskProfile(session.profileId);
  session.timer.remainingSeconds = profile.minutes * 60;
  saveCurrent(session);
  renderTimer();
}

function renderImage() {
  const url = session?.prompt?.imageDataUrl || "";
  els.imagePreview.src = url;
  els.imagePreview.classList.toggle("hidden", !url);
  els.imageEmpty.classList.toggle("hidden", Boolean(url));
}

function onImageSelected(event) {
  const file = event.target.files?.[0];
  if (!file || !session) return;
  if (!file.type.startsWith("image/")) return alert("请选择图片文件。");
  if (file.size > 5 * 1024 * 1024) return alert("第一版限制图片不超过 5MB。");
  const reader = new FileReader();
  reader.onload = () => {
    session.prompt.imageName = file.name;
    session.prompt.imageDataUrl = String(reader.result || "");
    saveCurrent(session);
    renderImage();
  };
  reader.readAsDataURL(file);
}

async function submitGrading() {
  if (!session) return;
  updateSessionFromInputs();
  let payload;
  try { payload = buildScoringPayload(session); }
  catch (error) { return alert(error.message); }

  gradingController?.abort();
  gradingController = new AbortController();
  els.gradeButton.disabled = true;
  els.gradingState.classList.remove("hidden");
  els.gradingState.innerHTML = `<span class="spinner"></span><div><strong>正在调用统一评分核心</strong><p>双评分官、边界复核和四项分冻结可能需要一些时间。</p></div>`;
  session.grading.status = "running";
  session.grading.error = "";
  saveCurrent(session);

  try {
    const result = await gradeWriting(payload, gradingController.signal);
    session.grading = { status: "completed", result, error: "" };
    touchSession(session);
    saveCurrent(session);
    saveToHistory(session);
    renderHistory();
    renderReport(result);
    setView(els.report);
  } catch (error) {
    session.grading = { status: "error", result: null, error: error.message };
    saveCurrent(session);
    els.gradingState.innerHTML = `<div class="error-box"><strong>评分失败</strong><p>${escapeHtml(error.message)}</p></div>`;
  } finally {
    els.gradeButton.disabled = false;
    gradingController = null;
  }
}

function criterionLabel(name) {
  const map = {
    "Task Achievement": "任务完成度",
    "Task Response": "任务回应",
    "Coherence and Cohesion": "连贯与衔接",
    "Lexical Resource": "词汇资源",
    "Grammatical Range and Accuracy": "语法多样性与准确性"
  };
  return map[name] || name;
}

function renderReport(result) {
  els.overallBand.textContent = Number(result.overallBand ?? 0).toFixed(1);
  els.reportMeta.textContent = `${result.module || result.examModule || "IELTS"} · ${result.task || `Task ${result.taskNumber || ""}`} · ${result.scoreSystemVersion || "AI estimated score"}`;
  const criteria = result.finalCriteria || result.criteria || {};
  els.criteriaGrid.innerHTML = Object.entries(criteria).map(([name, score]) => `
    <article class="criterion-card"><span>${escapeHtml(criterionLabel(name))}</span><small>${escapeHtml(name)}</small><strong>${Number(score).toFixed(1)}</strong></article>`).join("");
  els.assessment.textContent = result.overallAssessmentZh || result.overallAssessment || "评分已完成。";

  const warnings = [...(result.humanReviewReasons || [])];
  if (result.visualFactsAudit?.humanReviewRequiredForDataAccuracy) warnings.unshift("A类题图事实层尚未经过可靠核对，数据准确性需要人工确认。");
  els.warningList.innerHTML = warnings.length ? warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>没有额外人工复核警告。</li>";

  const details = result.criterionCalibration || result.criteriaDetails || {};
  els.reportDetails.innerHTML = Object.entries(details).map(([name, item]) => {
    const evidence = (item.essayEvidence || item.evidence || []).slice(0, 3).map((entry) => {
      const quote = typeof entry === "string" ? entry : entry.quote || entry.text || "";
      const meaning = typeof entry === "string" ? "" : entry.meaningZh || entry.explanationZh || entry.meaning || "";
      return `<blockquote><p>${escapeHtml(quote)}</p>${meaning ? `<small>${escapeHtml(meaning)}</small>` : ""}</blockquote>`;
    }).join("");
    return `<details class="detail-card" open><summary><span>${escapeHtml(criterionLabel(name))}</span><strong>${Number(item.band ?? criteria[name] ?? 0).toFixed(1)}</strong></summary>
      <div><p>${escapeHtml(item.whyThisBandZh || item.summaryZh || item.whyThisBand || item.summary || "")}</p>
      ${evidence}
      <h4>下一步修改</h4><p>${escapeHtml(item.nextRevision?.actionZh || item.howToImproveZh || item.nextRevision?.action || item.howToImprove || "根据原文证据完成一次最优先修改。")}</p></div></details>`;
  }).join("") || `<div class="empty-report">评分接口没有返回展开后的四项详情。</div>`;
  els.gradingState.classList.add("hidden");
}

function renderHistory() {
  const history = loadHistory();
  els.historyList.innerHTML = history.length ? history.map((item) => {
    const profile = TASK_PROFILES[item.profileId] || { title: item.profileId };
    const score = item.grading?.result?.overallBand;
    return `<article class="history-item"><button class="history-open" data-open-session="${item.id}" type="button"><strong>${escapeHtml(item.prompt?.title || profile.title)}</strong><span>${escapeHtml(profile.label || "")}</span><small>${score != null ? `Band ${Number(score).toFixed(1)}` : `${item.writing?.wordCount || 0} words`}</small></button><button class="history-remove" data-remove-session="${item.id}" title="删除" type="button">×</button></article>`;
  }).join("") : `<p class="muted">还没有已完成的练习。</p>`;
  els.historyList.querySelectorAll("[data-open-session]").forEach((button) => button.addEventListener("click", () => {
    const saved = loadHistory().find((item) => item.id === button.dataset.openSession);
    if (!saved) return;
    restoreSession(saved);
  }));
  els.historyList.querySelectorAll("[data-remove-session]").forEach((button) => button.addEventListener("click", () => {
    removeHistory(button.dataset.removeSession);
    renderHistory();
  }));
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeToggle.textContent = theme === "dark" ? "浅色" : "深色";
  saveTheme(theme);
}

function bindEvents() {
  [els.promptTitle, els.promptText, els.questionType, els.letterStyle, els.visualType, els.visualDescription, els.visualFeatures, els.visualVerified, els.essay, els.plan]
    .forEach((node) => node.addEventListener(node.type === "checkbox" ? "change" : "input", updateSessionFromInputs));
  els.imageInput.addEventListener("change", onImageSelected);
  els.timerButton.addEventListener("click", toggleTimer);
  els.resetTimer.addEventListener("click", resetTimer);
  els.gradeButton.addEventListener("click", submitGrading);
  $("newSessionButton").addEventListener("click", () => setView(els.dashboard));
  $("backDashboard").addEventListener("click", () => setView(els.dashboard));
  $("continueButton").addEventListener("click", () => session ? (renderWorkspace(), setView(els.workspace)) : setView(els.dashboard));
  $("editAgain").addEventListener("click", () => (renderWorkspace(), setView(els.workspace)));
  $("newFromReport").addEventListener("click", () => setView(els.dashboard));
  $("clearDataButton").addEventListener("click", () => {
    if (!confirm("确定删除本浏览器中的全部练习和草稿吗？")) return;
    stopTimer(); clearAllData(); session = null; renderHistory(); setView(els.dashboard);
  });
  els.themeToggle.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
}

renderProfiles();
renderHistory();
bindEvents();
applyTheme(loadTheme());
if (session?.profileId) {
  session.timer.running = false;
  renderWorkspace();
}
