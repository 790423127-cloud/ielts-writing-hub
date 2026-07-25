import { els, runtime, escapeHtml, criterionLabel, getTaskProfile } from "./runtime.js";

export function renderReport(result, renderLearningState = () => {}) {
  if (!result) return;
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
      <div><p>${escapeHtml(item.whyThisBandZh || item.summaryZh || item.whyThisBand || item.summary || "")}</p>${evidence}
      <h4>下一步修改</h4><p>${escapeHtml(item.nextRevision?.actionZh || item.howToImproveZh || item.nextRevision?.action || item.howToImprove || "根据原文证据完成一次最优先修改。")}</p></div></details>`;
  }).join("") || `<div class="empty-report">评分接口没有返回展开后的四项详情。</div>`;
  els.gradingState.classList.add("hidden");
  renderLearningState();
}

export function exportCurrentReport() {
  const session = runtime.session;
  if (!session?.grading?.result) return;
  const result = session.grading.result;
  const criteria = result.finalCriteria || result.criteria || {};
  const lines = [
    "# IELTS Writing Studio Report", "",
    `- Task: ${getTaskProfile(session.profileId).label}`,
    `- Overall: ${Number(result.overallBand || 0).toFixed(1)}`,
    `- Words: ${session.writing.wordCount}`, "",
    "## Criteria",
    ...Object.entries(criteria).map(([name, value]) => `- ${name}: ${Number(value).toFixed(1)}`), "",
    "## Overall assessment", result.overallAssessmentZh || result.overallAssessment || "", "",
    "## Prompt", session.prompt.text, "", "## Essay", session.writing.essay, "",
    "> AI generated estimated score; not an official IELTS result."
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ielts-writing-report-${new Date().toISOString().slice(0, 10)}.md`;
  link.click();
  URL.revokeObjectURL(url);
}
