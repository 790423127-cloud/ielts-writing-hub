"use client";

import { useState } from "react";
import type { LearningModuleName, WritingSession } from "@/types/writing.ts";

interface LearningCenterProps {
  session: WritingSession;
  busyAction: string;
  onGenerateFeedback: (module: LearningModuleName) => void;
  onGenerateRevision: () => void;
  onGenerateTeacher: () => void;
}

function recordOf(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function textFrom(value: unknown): string {
  if (typeof value === "string") return value;
  const item = recordOf(value);
  return String(item.zh ?? item.summaryZh ?? item.explanationZh ?? item.en ?? item.summary ?? "");
}

function FeedbackView({ payload }: { payload: unknown }) {
  const root = recordOf(payload);
  const data = recordOf(root.moduleResult ?? root.result ?? root);
  const summary = textFrom(data.summary) || String(data.summaryZh ?? "");
  const collections: Array<[string, unknown]> = [
    ["重点问题", data.topProblems],
    ["逐句修改", data.sentenceCards],
    ["语法问题", data.grammarErrors],
    ["词形问题", data.wordFormErrors],
    ["拼写速改", data.spellingQuickFix],
    ["任务检查", data.taskChecklist],
    ["四项反馈", data.criteria]
  ];

  return (
    <div className="learning-output">
      {summary && <p className="learning-summary">{summary}</p>}
      {collections.map(([title, raw]) => {
        const items = Array.isArray(raw)
          ? raw
          : raw && typeof raw === "object"
            ? Object.entries(raw as Record<string, unknown>).map(([name, value]) => ({ name, value }))
            : [];
        if (!items.length) return null;
        return (
          <section key={title}>
            <h4>{title}</h4>
            <div className="learning-cards">
              {items.slice(0, 30).map((item, index) => {
                const record = recordOf(item);
                const nested = recordOf(record.value ?? record);
                const heading = String(
                  record.name ?? nested.problemZh ?? nested.problem ?? nested.issueTitleZh ??
                  nested.original ?? nested.requirementZh ?? nested.requirement ?? nested.wrong ?? `第 ${index + 1} 项`
                );
                const detail = textFrom(nested.whyMatters) || textFrom(nested.explanation) ||
                  String(nested.whyThisBandZh ?? nested.whyNotHigherZh ?? nested.corrected ?? nested.minimalCorrection ?? nested.note ?? "");
                const example = String(nested.revisedExample ?? nested.upgradedVersion ?? nested.improved ?? nested.correct ?? "");
                return (
                  <article key={`${heading}-${index}`} className="learning-card">
                    <strong>{heading}</strong>
                    {detail && <p>{detail}</p>}
                    {example && <blockquote>{example}</blockquote>}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function RevisionView({ payload }: { payload: unknown }) {
  const root = recordOf(payload);
  const parts: Array<[string, unknown]> = [
    ["题目范文", root.modelAnswer],
    ["+0.5 修改版", root.revisionPlus05],
    ["+1.0 修改版", root.revisionPlus10]
  ];
  return (
    <div className="learning-cards">
      {parts.map(([title, raw]) => {
        const part = recordOf(raw);
        const essay = String(part.essay ?? part.text ?? "");
        if (!essay) return null;
        const verification = recordOf(part.verification);
        return (
          <article className="revision-card" key={title}>
            <div>
              <h4>{title}</h4>
              <span>
                {Number.isFinite(Number(part.targetBand)) ? `目标 Band ${Number(part.targetBand).toFixed(1)}` : ""}
                {Number.isFinite(Number(verification.verifiedBand)) ? ` · 验证 ${Number(verification.verifiedBand).toFixed(1)}` : ""}
              </span>
            </div>
            <p className="essay-text">{essay}</p>
          </article>
        );
      })}
    </div>
  );
}

function TeacherView({ payload }: { payload: unknown }) {
  const root = recordOf(payload);
  const data = recordOf(root.moduleResult ?? root);
  const opening = recordOf(data.teacherOpening);
  const issues = Array.isArray(data.teachingIssues) ? data.teachingIssues : [];
  const reusable = Array.isArray(data.reusableExpressions) ? data.reusableExpressions : [];
  return (
    <div className="teacher-view">
      <article className="teacher-opening">
        <h4>{String(opening.todayMainGoalZh ?? "本次教师精讲")}</h4>
        <p>{String(opening.diagnosisZh ?? textFrom(data.summary))}</p>
      </article>
      {issues.map((raw, index) => {
        const issue = recordOf(raw);
        const examples = Array.isArray(issue.examplesFromYourEssay) ? issue.examplesFromYourEssay : [];
        return (
          <details key={index} open>
            <summary>{index + 1}. {String(issue.issueTitleZh ?? issue.issueTitleEn ?? "写作问题")}</summary>
            <p>{String(issue.slowLearnerExplanationZh ?? issue.whyTeacherPickedThisZh ?? "")}</p>
            {examples.map((exampleRaw: unknown, exampleIndex: number) => {
              const example = recordOf(exampleRaw);
              return (
                <article className="teacher-example" key={exampleIndex}>
                  <del>{String(example.original ?? "")}</del>
                  <p><b>保底修正：</b>{String(example.survivalCorrection ?? "")}</p>
                  <p><b>自然升级：</b>{String(example.naturalUpgrade ?? "")}</p>
                </article>
              );
            })}
          </details>
        );
      })}
      {reusable.length > 0 && (
        <section>
          <h4>可复用表达</h4>
          <div className="learning-cards">
            {reusable.map((raw: unknown, index: number) => {
              const item = recordOf(raw);
              return <article className="learning-card" key={index}><strong>{String(item.expression ?? "")}</strong><p>{String(item.meaningZh ?? item.useWhenZh ?? "")}</p></article>;
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export function LearningCenter({
  session,
  busyAction,
  onGenerateFeedback,
  onGenerateRevision,
  onGenerateTeacher
}: LearningCenterProps) {
  const [tab, setTab] = useState<"feedback" | "revision" | "teacher">("feedback");
  const modules = session.learning.modules;
  const latestModule = Object.keys(modules).at(-1) as LearningModuleName | undefined;

  return (
    <section className="learning-center">
      <div className="learning-tabs">
        <button className={tab === "feedback" ? "active" : ""} onClick={() => setTab("feedback")} type="button">详细反馈</button>
        <button className={tab === "revision" ? "active" : ""} onClick={() => setTab("revision")} type="button">范文与改写</button>
        <button className={tab === "teacher" ? "active" : ""} onClick={() => setTab("teacher")} type="button">AI 教师</button>
      </div>

      {tab === "feedback" && (
        <div>
          <div className="action-row">
            <button type="button" onClick={() => onGenerateFeedback("criterionFeedback")} disabled={!!busyAction}>四项深度反馈</button>
            <button type="button" onClick={() => onGenerateFeedback("overview")} disabled={!!busyAction}>全文总览</button>
            <button type="button" onClick={() => onGenerateFeedback("sentenceUpgrade")} disabled={!!busyAction}>逐句修改</button>
            <button type="button" onClick={() => onGenerateFeedback("grammarWordFormSpelling")} disabled={!!busyAction}>语法词形</button>
            <button type="button" onClick={() => onGenerateFeedback("structureCohesionTask")} disabled={!!busyAction}>结构与任务回应</button>
          </div>
          {busyAction && <p className="loading-note">{busyAction}</p>}
          {latestModule ? <FeedbackView payload={modules[latestModule]} /> : <p className="muted">选择一个模块生成反馈。</p>}
        </div>
      )}

      {tab === "revision" && (
        <div>
          <button type="button" className="primary" onClick={onGenerateRevision} disabled={!!busyAction}>生成范文与改写</button>
          {session.profileId === "academic_task1" && <p className="muted">A 类小作文会严格依据你确认的事实层生成，不会套用书信规则。</p>}
          {busyAction && <p className="loading-note">{busyAction}</p>}
          {session.learning.generation ? <RevisionView payload={session.learning.generation} /> : <p className="muted">评分后生成三个学习版本。</p>}
        </div>
      )}

      {tab === "teacher" && (
        <div>
          <button type="button" className="primary" onClick={onGenerateTeacher} disabled={!!busyAction}>生成 AI 教师精讲</button>
          {session.profileId === "academic_task1" && <p className="muted">A 类教师会重点讲 overview、关键特征、比较与数据准确性。</p>}
          {busyAction && <p className="loading-note">{busyAction}</p>}
          {session.learning.teacherClinic ? <TeacherView payload={session.learning.teacherClinic} /> : <p className="muted">教师记忆按 A/G 和 Task 分开保存。</p>}
        </div>
      )}
    </section>
  );
}
