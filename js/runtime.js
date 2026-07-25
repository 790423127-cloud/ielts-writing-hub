import { TASK_PROFILES, getTaskProfile } from "./task-profiles.js";
import { createSession, ensureSessionShape, countWords, touchSession } from "./session.js";
import { saveCurrent, loadCurrent, loadHistory, removeHistory, saveTheme, loadTheme, calculateHistoryStats } from "./storage.js";
import { classifyPrompt, detectConflict } from "./prompt-classifier.js";

export const $ = (id) => document.getElementById(id);
export const els = {
  dashboard: $("dashboard"), workspace: $("workspace"), report: $("report"),
  profileGrid: $("profileGrid"), profileBadge: $("profileBadge"), workspaceTitle: $("workspaceTitle"),
  promptTitle: $("promptTitle"), promptText: $("promptText"), promptDetection: $("promptDetection"), questionType: $("questionType"),
  letterStyleWrap: $("letterStyleWrap"), letterStyle: $("letterStyle"), visualPanel: $("visualPanel"),
  visualType: $("visualType"), visualDescription: $("visualDescription"), visualFeatures: $("visualFeatures"),
  visualVerified: $("visualVerified"), imageInput: $("imageInput"), imagePreview: $("imagePreview"), imageEmpty: $("imageEmpty"),
  essay: $("essay"), plan: $("plan"), wordCount: $("wordCount"), wordTarget: $("wordTarget"),
  timer: $("timer"), timerButton: $("timerButton"), resetTimer: $("resetTimer"), saveStatus: $("saveStatus"),
  gradeButton: $("gradeButton"), gradingState: $("gradingState"), historyList: $("historyList"),
  overallBand: $("overallBand"), reportMeta: $("reportMeta"), criteriaGrid: $("criteriaGrid"),
  assessment: $("assessment"), warningList: $("warningList"), reportDetails: $("reportDetails"), themeToggle: $("themeToggle"),
  liveCheckPanel: $("liveCheckPanel"), liveCheckContent: $("liveCheckContent"), quickCheckButton: $("quickCheckButton"),
  feedbackResult: $("feedbackResult"), revisionResult: $("revisionResult"), teacherResult: $("teacherResult"), memoryStats: $("memoryStats")
};

export const runtime = {
  session: ensureSessionShape(loadCurrent()),
  timerHandle: null,
  saveHandle: null,
  activeController: null
};

export function setSession(value) {
  runtime.session = ensureSessionShape(value);
  if (runtime.session) saveCurrent(runtime.session);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

export function multiline(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export function criterionLabel(name) {
  const map = {
    "Task Achievement": "任务完成度",
    "Task Response": "任务回应",
    "Coherence and Cohesion": "连贯与衔接",
    "Lexical Resource": "词汇资源",
    "Grammatical Range and Accuracy": "语法多样性与准确性"
  };
  return map[name] || name;
}

export function setView(view) {
  [els.dashboard, els.workspace, els.report].forEach((node) => node.classList.add("hidden"));
  view.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function renderDashboardStats() {
  const stats = calculateHistoryStats();
  $("statTotal").textContent = stats.total;
  $("statAverage").textContent = stats.average == null ? "—" : stats.average.toFixed(1);
  $("statBest").textContent = stats.best == null ? "—" : stats.best.toFixed(1);
  $("statWeakest").textContent = criterionLabel(stats.weakestCriterion);
}

export function renderProfiles(onStart) {
  els.profileGrid.innerHTML = Object.values(TASK_PROFILES).map((profile) => `
    <button class="profile-card" data-profile="${profile.id}" type="button">
      <span class="profile-code">${profile.accent}</span><strong>${escapeHtml(profile.title)}</strong>
      <small>${escapeHtml(profile.label)}</small><p>${escapeHtml(profile.description)}</p>
      <em>${profile.minutes} 分钟 · 至少 ${profile.minimumWords} 词</em>
    </button>`).join("");
  els.profileGrid.querySelectorAll("[data-profile]").forEach((button) => button.addEventListener("click", () => onStart(button.dataset.profile)));
}

export function startSession(profileId) {
  stopTimer();
  setSession(createSession(profileId));
  renderWorkspace();
  setView(els.workspace);
}

export function restoreSession(saved) {
  stopTimer();
  setSession(saved);
}

export function switchProfile(profileId) {
  const session = runtime.session;
  if (!session || !TASK_PROFILES[profileId]) return;
  const next = createSession(profileId);
  next.prompt = { ...next.prompt, ...session.prompt, detection: session.prompt.detection };
  next.writing = { ...next.writing, ...session.writing };
  setSession(next);
  renderWorkspace();
}

export function syncInputs() {
  const session = runtime.session;
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
  session.prompt.detection = classifyPrompt(session.prompt.text);
  touchSession(session);
  scheduleSave();
  renderWordCount();
  renderPromptDetection();
}

export function renderPromptDetection() {
  const session = runtime.session;
  if (!session) return;
  const detection = session.prompt.detection || classifyPrompt(session.prompt.text);
  session.prompt.detection = detection;
  const conflict = detectConflict(session.profileId, detection);
  if (!session.prompt.text.trim() || detection.confidence < 0.5) {
    els.promptDetection.classList.add("hidden");
    return;
  }
  const confidence = `${Math.round(detection.confidence * 100)}%`;
  if (conflict.conflict) {
    els.promptDetection.className = "detection-box warning";
    els.promptDetection.innerHTML = `<div><strong>任务类型可能不一致</strong><p>${escapeHtml(conflict.message)} 识别置信度 ${confidence}。</p></div>${conflict.suggestedProfileId ? `<button data-switch-profile="${conflict.suggestedProfileId}" type="button">切换到建议任务</button>` : ""}`;
    els.promptDetection.querySelector("[data-switch-profile]")?.addEventListener("click", (event) => switchProfile(event.currentTarget.dataset.switchProfile));
  } else {
    els.promptDetection.className = "detection-box success";
    const note = detection.taskNumber === 2 ? "已识别为 Task 2；A/G 继续以你的选择为准。" : "系统识别与当前选择一致。";
    els.promptDetection.innerHTML = `<div><strong>任务检查通过</strong><p>${escapeHtml(note)} 识别置信度 ${confidence}。</p></div>`;
  }
}

export function conflictMessage() {
  const session = runtime.session;
  const detection = session?.prompt?.detection || classifyPrompt(session?.prompt?.text || "");
  const conflict = detectConflict(session?.profileId, detection);
  return conflict.conflict ? conflict.message : "";
}

function scheduleSave() {
  clearTimeout(runtime.saveHandle);
  els.saveStatus.textContent = "正在保存…";
  runtime.saveHandle = setTimeout(() => {
    saveCurrent(runtime.session);
    els.saveStatus.textContent = "已保存到本机";
  }, 300);
}

export function renderWordCount() {
  const value = countWords(els.essay.value);
  els.wordCount.textContent = value;
  if (runtime.session) runtime.session.writing.wordCount = value;
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${Math.floor(safe % 60).toString().padStart(2, "0")}`;
}

export function renderTimer() {
  els.timer.textContent = formatTime(runtime.session?.timer?.remainingSeconds || 0);
  els.timerButton.textContent = runtime.timerHandle ? "暂停" : "开始";
}

export function toggleTimer() {
  const session = runtime.session;
  if (!session) return;
  if (runtime.timerHandle) return stopTimer();
  session.timer.running = true;
  runtime.timerHandle = setInterval(() => {
    session.timer.remainingSeconds = Math.max(0, session.timer.remainingSeconds - 1);
    renderTimer();
    if (session.timer.remainingSeconds === 0) stopTimer();
  }, 1000);
  renderTimer();
}

export function stopTimer() {
  if (runtime.timerHandle) clearInterval(runtime.timerHandle);
  runtime.timerHandle = null;
  if (runtime.session?.timer) runtime.session.timer.running = false;
  if (runtime.session) saveCurrent(runtime.session);
  if (els.timerButton) renderTimer();
}

export function resetTimer() {
  const session = runtime.session;
  if (!session) return;
  stopTimer();
  const profile = getTaskProfile(session.profileId);
  session.timer.remainingSeconds = profile.minutes * 60;
  saveCurrent(session);
  renderTimer();
}

export function renderImage() {
  const url = runtime.session?.prompt?.imageDataUrl || "";
  els.imagePreview.src = url;
  els.imagePreview.classList.toggle("hidden", !url);
  els.imageEmpty.classList.toggle("hidden", Boolean(url));
}

export function onImageSelected(event) {
  const file = event.target.files?.[0];
  const session = runtime.session;
  if (!file || !session) return;
  if (!file.type.startsWith("image/")) return alert("请选择图片文件。");
  if (file.size > 2.5 * 1024 * 1024) return alert("为了避免浏览器存储超限，图片请控制在 2.5MB 以内。");
  const reader = new FileReader();
  reader.onload = () => {
    session.prompt.imageName = file.name;
    session.prompt.imageDataUrl = String(reader.result || "");
    saveCurrent(session);
    renderImage();
  };
  reader.readAsDataURL(file);
}

export function renderWorkspace() {
  const session = runtime.session;
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
  renderWordCount(); renderTimer(); renderImage(); renderPromptDetection();
}

export function renderHistory(onOpen) {
  const history = loadHistory();
  els.historyList.innerHTML = history.length ? history.map((item) => {
    const profile = TASK_PROFILES[item.profileId] || { title: item.profileId };
    const score = item.grading?.result?.overallBand;
    return `<article class="history-item"><button class="history-open" data-open-session="${item.id}" type="button"><strong>${escapeHtml(item.prompt?.title || profile.title)}</strong><span>${escapeHtml(profile.label || "")}</span><small>${score != null ? `Band ${Number(score).toFixed(1)}` : `${item.writing?.wordCount || 0} words`}</small></button><button class="history-remove" data-remove-session="${item.id}" title="删除" type="button">×</button></article>`;
  }).join("") : `<p class="muted">还没有已完成的练习。</p>`;
  els.historyList.querySelectorAll("[data-open-session]").forEach((button) => button.addEventListener("click", () => {
    const saved = loadHistory().find((item) => item.id === button.dataset.openSession);
    if (saved) onOpen(saved);
  }));
  els.historyList.querySelectorAll("[data-remove-session]").forEach((button) => button.addEventListener("click", () => {
    removeHistory(button.dataset.removeSession); renderHistory(onOpen); renderDashboardStats();
  }));
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeToggle.textContent = theme === "dark" ? "浅色" : "深色";
  saveTheme(theme);
}

export { TASK_PROFILES, getTaskProfile, loadHistory, loadTheme };
