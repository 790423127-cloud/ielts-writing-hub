import { $, els, runtime, setSession, setView, renderProfiles, startSession, restoreSession, syncInputs, renderWorkspace, renderHistory, renderDashboardStats, applyTheme, loadTheme, loadHistory, toggleTimer, resetTimer, stopTimer, onImageSelected } from "./runtime.js";
import { clearAllData } from "./storage.js";
import { submitGrading } from "./grading-ui.js";
import { renderReport, exportCurrentReport } from "./report-ui.js";
import { quickCheckLastSentence, renderLiveSuggestions } from "./live-check-ui.js";
import { generateFeedbackModule, generateRevision, generateTeacherClinic, renderLearningState, renderMemoryStats, switchLearningTab } from "./learning-ui.js";

function openSaved(saved, report = false) {
  restoreSession(saved);
  if (report && runtime.session?.grading?.result) {
    renderReport(runtime.session.grading.result, renderLearningState);
    setView(els.report);
  } else {
    renderWorkspace(); renderLiveSuggestions(); setView(els.workspace);
  }
}

function refreshHistory() {
  renderHistory((saved) => openSaved(saved, Boolean(saved.grading?.result)));
}

function bindEvents() {
  [els.promptTitle, els.promptText, els.questionType, els.letterStyle, els.visualType, els.visualDescription, els.visualFeatures, els.visualVerified, els.essay, els.plan]
    .forEach((node) => node.addEventListener(node.type === "checkbox" ? "change" : "input", syncInputs));
  els.imageInput.addEventListener("change", onImageSelected);
  els.timerButton.addEventListener("click", toggleTimer);
  els.resetTimer.addEventListener("click", resetTimer);
  els.gradeButton.addEventListener("click", () => submitGrading({ renderHistory: refreshHistory, renderReport: (result) => renderReport(result, renderLearningState) }));
  els.quickCheckButton.addEventListener("click", quickCheckLastSentence);
  $("closeLiveCheck").addEventListener("click", () => els.liveCheckPanel.classList.add("hidden"));
  $("copyEssayButton").addEventListener("click", async () => {
    await navigator.clipboard.writeText(els.essay.value); $("copyEssayButton").textContent = "已复制"; setTimeout(() => $("copyEssayButton").textContent = "复制作文", 1200);
  });
  ["newSessionButton", "backDashboard", "changeTaskButton", "newFromReport"].forEach((id) => $(id).addEventListener("click", () => setView(els.dashboard)));
  $("continueButton").addEventListener("click", () => runtime.session ? (renderWorkspace(), renderLiveSuggestions(), setView(els.workspace)) : setView(els.dashboard));
  $("openLatestReport").addEventListener("click", () => {
    const latest = runtime.session?.grading?.result ? runtime.session : loadHistory().find((item) => item.grading?.result);
    if (!latest) return alert("还没有评分报告。");
    openSaved(latest, true);
  });
  $("editAgain").addEventListener("click", () => (renderWorkspace(), renderLiveSuggestions(), setView(els.workspace)));
  $("clearDataButton").addEventListener("click", () => {
    if (!confirm("确定删除本浏览器中的全部练习、草稿和教师记忆吗？")) return;
    stopTimer(); clearAllData(); localStorage.removeItem("ielts-writing-studio:v2:teacherMemory"); setSession(null); refreshHistory(); renderDashboardStats(); renderMemoryStats(); setView(els.dashboard);
  });
  els.themeToggle.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  document.querySelectorAll("[data-feedback-module]").forEach((button) => button.addEventListener("click", () => generateFeedbackModule(button.dataset.feedbackModule)));
  document.querySelectorAll("[data-learning-tab]").forEach((button) => button.addEventListener("click", () => switchLearningTab(button.dataset.learningTab)));
  $("generateRevision").addEventListener("click", generateRevision);
  $("generateTeacherClinic").addEventListener("click", generateTeacherClinic);
  $("exportReport").addEventListener("click", exportCurrentReport);
}

renderProfiles(startSession);
refreshHistory(); renderDashboardStats(); bindEvents(); applyTheme(loadTheme()); renderMemoryStats();
if (runtime.session?.profileId) { runtime.session.timer.running = false; renderWorkspace(); renderLiveSuggestions(); }
