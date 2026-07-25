"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { apiClient } from "@/lib/api-client.ts";
import {
  calculateWeightedWritingBand,
  clearMockExam,
  createMockExam,
  loadMockExam,
  saveMockExam
} from "@/lib/mock-exam-storage.ts";
import { buildScoringPayload, countWords, touchSession } from "@/lib/session.ts";
import { loadHistory, saveToHistory } from "@/lib/storage.ts";
import { getTaskProfile } from "@/lib/task-profiles.ts";
import type { MockExamDraft, ScoreResult, WritingSession } from "@/types/writing.ts";

interface MockExamProps {
  onClose: () => void;
  onHistoryUpdated: (history: WritingSession[]) => void;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function scoreOf(session: WritingSession): number | null {
  const value = Number(session.grading.result?.overallBand);
  return Number.isFinite(value) ? value : null;
}

export function MockExam({ onClose, onHistoryUpdated }: MockExamProps) {
  const [draft, setDraft] = useState<MockExamDraft | null>(null);
  const [restored, setRestored] = useState<MockExamDraft | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setRestored(loadMockExam()), []);

  useEffect(() => {
    if (!draft) return;
    const timeout = window.setTimeout(() => saveMockExam(draft), 400);
    return () => window.clearTimeout(timeout);
  }, [draft]);

  useEffect(() => {
    if (!draft?.timer.running) return;
    const interval = window.setInterval(() => {
      setDraft((current) => {
        if (!current?.timer.running) return current;
        const remainingSeconds = Math.max(0, current.timer.remainingSeconds - 1);
        return {
          ...current,
          timer: {
            ...current.timer,
            remainingSeconds,
            running: remainingSeconds > 0
          },
          updatedAt: new Date().toISOString()
        };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [draft?.timer.running]);

  const activeSession = draft ? (draft.activeTask === 1 ? draft.task1 : draft.task2) : null;
  const combinedBand = useMemo(
    () => draft ? calculateWeightedWritingBand(draft.task1.grading.result, draft.task2.grading.result) : null,
    [draft]
  );

  const start = (examModule: MockExamDraft["examModule"]) => {
    clearMockExam();
    setDraft(createMockExam(examModule));
    setMessage("");
  };

  const updateTask = (taskNumber: 1 | 2, updater: (session: WritingSession) => WritingSession) => {
    setDraft((current) => {
      if (!current) return current;
      const key = taskNumber === 1 ? "task1" : "task2";
      return {
        ...current,
        [key]: touchSession(updater(current[key])),
        updatedAt: new Date().toISOString()
      };
    });
  };

  const uploadImage = (file: File | null) => {
    if (!file || !draft) return;
    if (!file.type.startsWith("image/")) {
      setMessage("请上传图片文件。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateTask(1, (session) => ({
        ...session,
        prompt: {
          ...session.prompt,
          imageName: file.name,
          imageDataUrl: String(reader.result || "")
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!draft) return;
    try {
      setSubmitting(true);
      setMessage("正在评分 Task 1…");
      const task1Result = await apiClient.grade<ScoreResult>(buildScoringPayload(draft.task1));
      const completedTask1 = touchSession({
        ...draft.task1,
        timer: { ...draft.task1.timer, running: false },
        grading: { status: "complete", result: task1Result, error: "" }
      });

      setMessage("正在评分 Task 2…");
      const task2Result = await apiClient.grade<ScoreResult>(buildScoringPayload(draft.task2));
      const completedTask2 = touchSession({
        ...draft.task2,
        timer: { ...draft.task2.timer, running: false },
        grading: { status: "complete", result: task2Result, error: "" }
      });

      const completedDraft: MockExamDraft = {
        ...draft,
        task1: completedTask1,
        task2: completedTask2,
        timer: { ...draft.timer, running: false },
        updatedAt: new Date().toISOString()
      };
      setDraft(completedDraft);
      saveToHistory(completedTask1);
      saveToHistory(completedTask2);
      onHistoryUpdated(loadHistory());
      clearMockExam();
      setRestored(null);
      setMessage("模拟考试评分完成。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) {
    return (
      <section className="page feature-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">60 分钟模拟考试</span>
            <h2>一次完成 Task 1 和 Task 2</h2>
            <p>自行粘贴两道题目。Task 2 在练习总分中按双倍权重计算。</p>
          </div>
          <button className="secondary" type="button" onClick={onClose}>返回首页</button>
        </div>

        {restored && (
          <section className="notice mock-resume">
            <div>
              <strong>发现未完成的模拟考试</strong>
              <p>{restored.examModule === "academic" ? "Academic" : "General Training"} · 剩余 {formatTime(restored.timer.remainingSeconds)}</p>
            </div>
            <div className="compact-actions">
              <button className="primary small" type="button" onClick={() => setDraft(restored)}>继续</button>
              <button className="secondary small" type="button" onClick={() => { clearMockExam(); setRestored(null); }}>删除</button>
            </div>
          </section>
        )}

        <div className="mock-module-grid">
          <button className="profile-card" type="button" onClick={() => start("academic")}>
            <span className="profile-code">A</span>
            <strong>Academic 模拟考试</strong>
            <small>Task 1 图表报告 + Task 2 议论文</small>
            <em>总计 60 分钟</em>
          </button>
          <button className="profile-card" type="button" onClick={() => start("general_training")}>
            <span className="profile-code">G</span>
            <strong>General Training 模拟考试</strong>
            <small>Task 1 书信 + Task 2 议论文</small>
            <em>总计 60 分钟</em>
          </button>
        </div>
      </section>
    );
  }

  const activeProfile = getTaskProfile(activeSession!.profileId);
  const task1Score = scoreOf(draft.task1);
  const task2Score = scoreOf(draft.task2);

  return (
    <section className="page feature-page">
      <div className="page-heading mock-heading">
        <div>
          <span className="eyebrow">{draft.examModule === "academic" ? "ACADEMIC" : "GENERAL TRAINING"} MOCK</span>
          <h2>写作模拟考试</h2>
          <p>先确认两道题目，再开始计时。系统不会随机提供题目。</p>
        </div>
        <div className="mock-timer">
          <strong>{formatTime(draft.timer.remainingSeconds)}</strong>
          <button
            className="secondary small"
            type="button"
            onClick={() => setDraft({ ...draft, timer: { ...draft.timer, running: !draft.timer.running } })}
          >
            {draft.timer.running ? "暂停" : "开始"}
          </button>
          <button className="secondary small" type="button" onClick={onClose}>退出</button>
        </div>
      </div>

      <div className="mock-task-tabs">
        {[1, 2].map((taskNumber) => {
          const session = taskNumber === 1 ? draft.task1 : draft.task2;
          return (
            <button
              key={taskNumber}
              type="button"
              className={draft.activeTask === taskNumber ? "active" : ""}
              onClick={() => setDraft({ ...draft, activeTask: taskNumber as 1 | 2 })}
            >
              Task {taskNumber}
              <small>{session.writing.wordCount} 词</small>
            </button>
          );
        })}
      </div>

      <div className="mock-workspace">
        <section className="panel mock-prompt-panel">
          <div className="panel-heading">
            <div>
              <span className="badge">{activeProfile.title}</span>
              <h3>题目与要求</h3>
            </div>
          </div>
          <label>
            题目标题（可选）
            <input
              value={activeSession!.prompt.title}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateTask(draft.activeTask, (session) => ({ ...session, prompt: { ...session.prompt, title: event.target.value } }))}
            />
          </label>
          <label>
            题目原文
            <textarea
              className="prompt-input"
              value={activeSession!.prompt.text}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateTask(draft.activeTask, (session) => ({ ...session, prompt: { ...session.prompt, text: event.target.value } }))}
              placeholder="粘贴完整 IELTS 写作题目"
            />
          </label>

          {activeSession!.taskKind === "gt_letter" && (
            <label>
              书信语气
              <select
                value={activeSession!.prompt.letterStyle}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => updateTask(1, (session) => ({ ...session, prompt: { ...session.prompt, letterStyle: event.target.value } }))}
              >
                <option value="">请确认</option>
                <option value="formal">Formal</option>
                <option value="semi-formal">Semi-formal</option>
                <option value="informal">Informal</option>
              </select>
            </label>
          )}

          {activeSession!.taskKind === "academic_visual_report" && (
            <div className="mock-visual-fields">
              <label className="upload-box">
                <span>上传 Task 1 题图</span>
                <small>{activeSession!.prompt.imageName || "图片只用于本地预览"}</small>
                <input type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => uploadImage(event.target.files?.[0] || null)} />
              </label>
              {activeSession!.prompt.imageDataUrl && (
                <div className="image-stage"><img src={activeSession!.prompt.imageDataUrl} alt="Academic Task 1 题图预览" /></div>
              )}
              <label>
                图表类型
                <input
                  value={activeSession!.prompt.visualFacts.visualType}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => updateTask(1, (session) => ({
                    ...session,
                    prompt: { ...session.prompt, visualFacts: { ...session.prompt.visualFacts, visualType: event.target.value } }
                  }))}
                  placeholder="bar chart / map / process"
                />
              </label>
              <label>
                事实摘要
                <textarea
                  value={activeSession!.prompt.visualFacts.referenceDescription}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateTask(1, (session) => ({
                    ...session,
                    prompt: { ...session.prompt, visualFacts: { ...session.prompt.visualFacts, referenceDescription: event.target.value } }
                  }))}
                  placeholder="填写主要数据、趋势、阶段或地图变化"
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={activeSession!.prompt.visualFacts.sourceVerified}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => updateTask(1, (session) => ({
                    ...session,
                    prompt: {
                      ...session.prompt,
                      visualFacts: {
                        ...session.prompt.visualFacts,
                        sourceVerified: event.target.checked,
                        verificationNote: event.target.checked ? "Confirmed by user in mock exam" : ""
                      }
                    }
                  }))}
                />
                我已核对事实摘要
              </label>
            </div>
          )}
        </section>

        <section className="panel mock-editor-panel">
          <div className="editor-toolbar">
            <div>
              <h3>Task {draft.activeTask} 作文</h3>
              <span className="muted">至少 {activeProfile.minimumWords} 词</span>
            </div>
            <strong>{countWords(activeSession!.writing.essay)} 词</strong>
          </div>
          <textarea
            className="essay-input"
            value={activeSession!.writing.essay}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateTask(draft.activeTask, (session) => ({ ...session, writing: { ...session.writing, essay: event.target.value } }))}
            placeholder="在这里完成作文……"
          />
          <label>
            写作计划（可选）
            <textarea
              className="plan-input"
              value={activeSession!.writing.plan}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateTask(draft.activeTask, (session) => ({ ...session, writing: { ...session.writing, plan: event.target.value } }))}
            />
          </label>
        </section>
      </div>

      {(task1Score !== null || task2Score !== null) && (
        <section className="mock-score-summary">
          <article><span>Task 1</span><strong>{task1Score === null ? "—" : task1Score.toFixed(1)}</strong></article>
          <article><span>Task 2</span><strong>{task2Score === null ? "—" : task2Score.toFixed(1)}</strong></article>
          <article><span>加权练习估分</span><strong>{combinedBand === null ? "—" : combinedBand.toFixed(1)}</strong></article>
        </section>
      )}

      <div className="mock-submit-row">
        <p>{message || "提交后会分别评分两篇作文，并保存为两条练习记录。"}</p>
        <button className="primary" type="button" disabled={submitting} onClick={submit}>
          {submitting ? "正在评分…" : "提交两篇作文"}
        </button>
      </div>
    </section>
  );
}
