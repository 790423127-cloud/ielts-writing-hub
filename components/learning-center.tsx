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

function textFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const object = value as Record<string, unknown>;
  return String(
    object.zh ??
      object.summaryZh ??
      object.whyThisBandZh ??
      object.explanationZh ??
      object.en ??
      object.summary ??
      ""
  );
}

function FeedbackView({ payload }: { payload: unknown }) {
  const root = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const data = ((root.moduleResult ?? root.result ?? root) || {}) as Record<string, unknown>;
  const summary = textFrom(data.summary) || String(data.summaryZh ?? "");

  const collections = [
    ["重点问题", data.topProblems],
    ["逐句修改", data.sentenceCards],
    ["语法问题", data.grammarErrors],
    ["词形问题", data.wordFormErrors],
    ["任务检查", data.taskChecklist],
    ["四项反馈", data.criteria]
  ] as const;

  return (
    <div className="learning-output">
      {summary && <p className="learning-summary">{summary}</p>}
      {collections.map(([title, raw]) => {
        const items = Array.isArray(raw)
          ? raw
          : raw && typeof raw === "object"
            ? Object.entries(raw as Record<string, unknown>).map(([name, value]) => ({ name, value }))
            : [];
        if (items.length === 0) return null;

        return (
          <section key={title}>
            <h4>{title}</h4>
            <div className="learning-cards">
              {items.slice(0, 20).map((item, index) => {
                const record = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
                const nested = record.value && typeof record.value === "object"
                  ? record.value as Record<string, unknown>
                  : record;
                const heading = String(
                  record.name ??
                    nested.problem ??
                    nested.issueTitleZh ??
                    nested.original ??
                    nested.requirementZh ??
                    nested.requirement ??
                    `第 ${index + 1} 项`
                );
                const detail =
                  textFrom(nested.whyMatters) ||
                  textFrom(nested.explanation) ||
                  String(nested.whyThisBandZh ?? nested.whyNotHigherZh ?? nested.corrected ?? nested.minimalCorrection ?? "");
                const example = String(
                  nested.revisedExample ??
                    nested.upgradedVersion ??
                    nested.advice?.toString?.() ??
                    ""
                );
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
  const root = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const parts = [
    ["题目范文", root.modelAnswer],
    ["+0.5 修改版", root.revisionPlus05],
    ["+1.0 修改版", root.revisionPlus10]
  ] as const;

  return (
    <div className="learning-cards">
      {parts.map(([title, raw]) => {
        if (!raw || typeof raw !== "object") return null;
        const part = raw as Record<string, unknown>;
        const essay = String(part.essay ?? part.text ?? "");
        if (!essay) return null;
        return (
          <article className="revision-card" key={title}>
            <div>
              <h4>{title}</h4>
              {Number.isFinite(Number(part.targetBand)) && <span>目标 Band {Number(part.targetBand).toFixed(1)}</span>}
            </div>
            <p className="essay-text">{essay}</p>
          </article>
        );
      })}
    </div>
  );
}

function TeacherView({ payload }: { payload: unknown }) {
  const root = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const data = ((root.moduleResult ?? root) || {}) as Record<string, unknown>;
  const opening = (data.teacherOpening && typeof data.teacherOpening === "object"
    ? data.teacherOpening
    : {}) as Record<string, unknown>;
  const issues = Array.isArray(data.teachingIssues) ? data.teachingIssues : [];

  return (
    <div className="teacher-view">
      <article className="teacher-opening">
        <h4>{String(opening.todayMainGoalZh ?? "本次教师精讲")}</h4>
        <p>{String(opening.diagnosisZh ?? textFrom(data.summary))}</p>
      </article>
      {issues.map((raw, index) => {
        const issue = raw as Record<string, unknown>;
        const examples = Array.isArray(issue.examplesFromYourEssay) ? issue.examplesFromYourEssay : [];
        return (
          <details key={index} open>
            <summary>{index + 1}. {String(issue.issueTitleZh ?? issue.issueTitleEn ?? "语言问题")}</summary>
            <p>{String(issue.slowLearnerExplanationZh ?? issue.whyTeacherPickedThisZh ?? "")}</p>
            {examples.map((exampleRaw, exampleIndex) => {
              const example = exampleRaw as Record<string, unknown>;
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
  const academicTask1 = session.profileId === "academic_task1";
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
            <button
              type="button"
              onClick={() => onGenerateFeedback("structureCohesionTask")}
              disabled={!!busyAction || academicTask1}
              title={academicTask1 ? "旧上游该模块仍含 G 类书信规则，暂不调用" : ""}
            >
              结构与任务回应
            </button>
          </div>
          {busyAction && <p className="loading-note">{busyAction}</p>}
          {latestModule ? (
            <FeedbackView payload={modules[latestModule]} />
          ) : (
            <p className="muted">选择一个模块生成反馈。</p>
          )}
        </div>
      )}

      {tab === "revision" && (
        <div>
          {academicTask1 ? (
            <div className="notice">
              <strong>Academic Task 1 安全限制</strong>
              <p>旧上游生成器仍可能套用 G 类书信规则，因此重构版暂不调用。</p>
            </div>
          ) : (
            <>
              <button type="button" className="primary" onClick={onGenerateRevision} disabled={!!busyAction}>生成范文与改写</button>
              {busyAction && <p className="loading-note">{busyAction}</p>}
              {session.learning.generation ? <RevisionView payload={session.learning.generation} /> : <p className="muted">评分后生成学习版本。</p>}
            </>
          )}
        </div>
      )}

      {tab === "teacher" && (
        <div>
          {academicTask1 ? (
            <div className="notice">
              <strong>Academic Task 1 安全限制</strong>
              <p>专用图表教师规则接入前，不会调用旧的书信教师模块。</p>
            </div>
          ) : (
            <>
              <button type="button" className="primary" onClick={onGenerateTeacher} disabled={!!busyAction}>生成 AI 教师精讲</button>
              {busyAction && <p className="loading-note">{busyAction}</p>}
              {session.learning.teacherClinic ? <TeacherView payload={session.learning.teacherClinic} /> : <p className="muted">教师记忆按 A/G 和 Task 分开保存。</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
