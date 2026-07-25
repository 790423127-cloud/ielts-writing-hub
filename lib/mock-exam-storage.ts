"use client";

import { createId, createSession, ensureSessionShape, touchSession } from "./session.ts";
import type { MockExamDraft, ScoreResult, WritingSession } from "../types/writing.ts";

const STORAGE_KEY = "ielts-writing-studio:v3:mock-exam";
const EXAM_SECONDS = 60 * 60;

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function profileIdsForModule(examModule: MockExamDraft["examModule"]): {
  task1: "academic_task1" | "general_task1";
  task2: "academic_task2" | "general_task2";
} {
  return examModule === "academic"
    ? { task1: "academic_task1", task2: "academic_task2" }
    : { task1: "general_task1", task2: "general_task2" };
}

export function createMockExam(examModule: MockExamDraft["examModule"]): MockExamDraft {
  const profiles = profileIdsForModule(examModule);
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: createId(),
    examModule,
    task1: createSession(profiles.task1),
    task2: createSession(profiles.task2),
    activeTask: 1,
    timer: {
      durationSeconds: EXAM_SECONDS,
      remainingSeconds: EXAM_SECONDS,
      running: false
    },
    createdAt: now,
    updatedAt: now
  };
}

function compactSession(session: WritingSession): WritingSession {
  return {
    ...touchSession(session),
    prompt: { ...session.prompt, imageDataUrl: "" },
    timer: { ...session.timer, running: false }
  };
}

export function saveMockExam(draft: MockExamDraft): void {
  if (!hasStorage()) return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...draft,
      task1: compactSession(draft.task1),
      task2: compactSession(draft.task2),
      timer: { ...draft.timer, running: false },
      updatedAt: new Date().toISOString()
    })
  );
}

export function loadMockExam(): MockExamDraft | null {
  if (!hasStorage()) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<MockExamDraft> | null;
    if (!raw || (raw.examModule !== "academic" && raw.examModule !== "general_training")) return null;
    const task1 = ensureSessionShape(raw.task1);
    const task2 = ensureSessionShape(raw.task2);
    if (!task1 || !task2) return null;
    const base = createMockExam(raw.examModule);
    return {
      ...base,
      ...raw,
      schemaVersion: 1,
      task1,
      task2,
      activeTask: raw.activeTask === 2 ? 2 : 1,
      timer: {
        ...base.timer,
        ...(raw.timer || {}),
        running: false
      }
    };
  } catch {
    return null;
  }
}

export function clearMockExam(): void {
  if (hasStorage()) localStorage.removeItem(STORAGE_KEY);
}

export function calculateWeightedWritingBand(
  task1: ScoreResult | number | null | undefined,
  task2: ScoreResult | number | null | undefined
): number | null {
  const band1 = typeof task1 === "number" ? task1 : Number(task1?.overallBand);
  const band2 = typeof task2 === "number" ? task2 : Number(task2?.overallBand);
  if (!Number.isFinite(band1) || !Number.isFinite(band2)) return null;
  return Math.round(((band1 + band2 * 2) / 3) * 2) / 2;
}
