"use client";

import { getTaskProfile } from "@/lib/task-profiles.ts";
import type { CriterionDetail, LearningModuleName, WritingSession } from "@/types/writing.ts";
import { LearningCenter } from "./learning-center";

const CRITERION_LABELS: Record<string, string> = {
  "Task Achievement": "任务完成度",
  "Task Response": "任务回应",
  "Coherence and Cohesion": "连贯与衔接",
  "Lexical Resource": "词汇资源",
  "Grammatical Range and Accuracy": "语法多样性与准确性"
};

interface ScoreReportProps {
  session: WritingSession;
  busyAction: string;
  onEdit: () => void;
  onNew: () => void;
  onGenerateFeedback: (module: LearningModuleName) => void;
  onGenerateRevision: () => void;
  onGenerateTeacher: () => void;
}

function criterionDetail(
  session: WritingSession,
  name: string
): CriterionDetail | undefined {
  const result = session.grading.result;
  return result?.criteriaDetails?.[name] ?? result?.criterionCalibration?.[name];
}

export function ScoreReport({
  session,
  busyAction,
  onEdit,
  onNew,
  onGenerateFeedback,
  onGenerateRevision,
  onGenerateTeacher
}: ScoreReportProps) {
  const result = session.grading.result;
  if (!result) return null;

  const profile = getTaskProfile(session.profileId);
  const criteria = result.finalCriteria ?? result.criteria ?? {};
  const warnings = [
    ...(result.needsHumanReview ? ["系统建议人工复核本次结果。"] : []),
    ...((result.humanReviewReasons ?? []).map(String))
  ];

  const exportReport = () => {
    const lines = [
      "# IELTS Writing Studio Report",
      "",
      `- Task: ${profile.label}`,
      `- Overall: ${Number(result.overallBand ?? 0).toFixed(1)}`,
      `- Words: ${session.writing.wordCount}`,
      "",
      "## Criteria",
      ...Object.entries(criteria).map(([name, value]) => `- ${name}: ${Number(value).toFixed(1)}`),
      "",
      "## Overall assessment",
      String(result.overallAssessmentZh ?? result.overallAssessment ?? ""),
      "",
      "## Prompt",
      session.prompt.text,
      "",
      "## Essay",
      session.writing.essay,
      "",
      "> AI generated estimated score; not an official IELTS result."
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ielts-writing-report-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page">
      <div className="report-hero">
        <div>
          <span className="eyebrow">SCORE REPORT</span>
          <h2>本次写作评分</h2>
          <p>{profile.label} · {session.writing.wordCount} words · {result.confidence ? `置信度 ${result.confidence}` : "AI estimated score"}</p>
        </div>
        <div className="overall-score">
          <span>Overall</span>
          <strong>{Number(result.overallBand ?? 0).toFixed(1)}</strong>
          <small>AI estimated band</small>
        </div>
      </div>

      <div className="criteria-grid">
        {Object.entries(criteria).map(([name, value]) => (
          <article key={name}>
            <span>{CRITERION_LABELS[name] ?? name}</span>
            <strong>{Number(value).toFixed(1)}</strong>
          </article>
        ))}
      </div>

      <div className="report-layout">
        <section>
          <article className="panel">
            <span className="eyebrow">ASSESSMENT</span>
            <h3>总体判断</h3>
            <p>{String(result.overallAssessmentZh ?? result.overallAssessment ?? "暂无总体说明。")}</p>
          </article>

          <div className="criterion-details">
            {Object.keys(criteria).map((name) => {
              const detail = criterionDetail(session, name);
              if (!detail) return null;
              return (
                <details key={name} open>
                  <summary>{CRITERION_LABELS[name] ?? name}</summary>
                  <p>{detail.whyThisBandZh || detail.summaryZh || detail.whyThisBand || detail.summary}</p>
                  {(detail.whyNotHigherZh || detail.whyNotHigher) && (
                    <p><b>为什么没有更高：</b>{detail.whyNotHigherZh || detail.whyNotHigher}</p>
                  )}
                  {(detail.howToImproveZh || detail.howToImprove) && (
                    <p><b>下一步：</b>{detail.howToImproveZh || detail.howToImprove}</p>
                  )}
                  {detail.essayEvidence?.map((evidence, index) => (
                    <blockquote key={index}>
                      “{evidence.quote}”
                      {(evidence.meaningZh || evidence.meaning) && <small>{evidence.meaningZh || evidence.meaning}</small>}
                    </blockquote>
                  ))}
                </details>
              );
            })}
          </div>

          <LearningCenter
            session={session}
            busyAction={busyAction}
            onGenerateFeedback={onGenerateFeedback}
            onGenerateRevision={onGenerateRevision}
            onGenerateTeacher={onGenerateTeacher}
          />
        </section>

        <aside>
          <article className="panel warning-panel">
            <span className="eyebrow">REVIEW FLAGS</span>
            <h3>复核提示</h3>
            {warnings.length > 0 ? <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>暂无额外复核提示。</p>}
          </article>
          <button className="primary full" type="button" onClick={onEdit}>返回修改作文</button>
          <button className="secondary full" type="button" onClick={exportReport}>导出 Markdown 报告</button>
          <button className="secondary full" type="button" onClick={onNew}>新建另一篇</button>
        </aside>
      </div>
    </section>
  );
}
