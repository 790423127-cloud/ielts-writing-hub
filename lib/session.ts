import { getTaskProfile, isTaskProfileId } from "./task-profiles.ts";
import type { ScoreResult, TaskProfileId, WritingSession } from "../types/writing.ts";

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function countWords(text: string): number {
  return (String(text ?? "").match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g) ?? []).length;
}

export function createSession(profileId: TaskProfileId): WritingSession {
  const profile = getTaskProfile(profileId);
  const now = new Date().toISOString();

  return {
    schemaVersion: 3,
    id: createId(),
    profileId,
    examModule: profile.examModule,
    taskNumber: profile.taskNumber,
    taskKind: profile.taskKind,
    prompt: {
      title: "",
      text: "",
      questionType: "",
      letterStyle: "",
      imageName: "",
      imageDataUrl: "",
      detection: null,
      visualFacts: {
        visualType: "unknown",
        referenceDescription: "",
        keyFeatures: [],
        sourceVerified: false,
        verificationNote: ""
      }
    },
    writing: { essay: "", plan: "", wordCount: 0 },
    timer: {
      durationSeconds: profile.minutes * 60,
      remainingSeconds: profile.minutes * 60,
      running: false
    },
    grading: { status: "idle", result: null, error: "" },
    learning: { modules: {}, generation: null, teacherClinic: null, liveSuggestions: [] },
    createdAt: now,
    updatedAt: now
  };
}

export function ensureSessionShape(raw: unknown): WritingSession | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<WritingSession>;
  if (!isTaskProfileId(candidate.profileId)) return null;

  const base = createSession(candidate.profileId);
  return {
    ...base,
    ...candidate,
    schemaVersion: 3,
    prompt: {
      ...base.prompt,
      ...(candidate.prompt ?? {}),
      visualFacts: {
        ...base.prompt.visualFacts,
        ...(candidate.prompt?.visualFacts ?? {})
      }
    },
    writing: { ...base.writing, ...(candidate.writing ?? {}) },
    timer: { ...base.timer, ...(candidate.timer ?? {}), running: false },
    grading: { ...base.grading, ...(candidate.grading ?? {}) },
    learning: {
      ...base.learning,
      ...(candidate.learning ?? {}),
      modules: { ...(candidate.learning?.modules ?? {}) },
      liveSuggestions: Array.isArray(candidate.learning?.liveSuggestions)
        ? candidate.learning.liveSuggestions
        : []
    }
  };
}

export function touchSession(session: WritingSession): WritingSession {
  return {
    ...session,
    writing: {
      ...session.writing,
      wordCount: countWords(session.writing.essay)
    },
    updatedAt: new Date().toISOString()
  };
}

export function buildScoringPayload(session: WritingSession): Record<string, unknown> {
  const profile = getTaskProfile(session.profileId);
  const prompt = session.prompt.text.trim();
  const essay = session.writing.essay.trim();

  if (!prompt) throw new Error("请先粘贴作文题目。");
  if (!essay) throw new Error("请先输入作文内容。");

  const payload: Record<string, unknown> = {
    examModule: profile.examModule,
    taskNumber: profile.taskNumber,
    taskKind: profile.taskKind,
    questionPrompt: prompt,
    prompt,
    title: session.prompt.title.trim(),
    essay,
    wordCount: countWords(essay),
    questionType: session.prompt.questionType.trim(),
    letterStyle: session.prompt.letterStyle.trim(),
    promptId: session.id,
    task: `Task ${profile.taskNumber}`,
    taskType: profile.taskNumber === 1 ? "task1" : "task2",
    mode: "score"
  };

  if (profile.taskKind === "academic_visual_report") {
    const facts = session.prompt.visualFacts;
    payload.visualFacts = {
      visualType: facts.visualType || "unknown",
      referenceDescription: facts.referenceDescription.trim(),
      keyFeatures: facts.keyFeatures.filter(Boolean).slice(0, 30),
      sourceVerified: facts.sourceVerified,
      verificationNote: facts.verificationNote
    };
  }

  return payload;
}

export function buildLearningPayload(
  session: WritingSession,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const result = session.grading.result;
  return {
    ...buildScoringPayload(session),
    ...extra,
    currentResult: result,
    frozenScore: result
      ? {
          overallBand: result.overallBand,
          finalCriteria: result.finalCriteria ?? result.criteria ?? {}
        }
      : null
  };
}

export function scoreFromSession(session: WritingSession): ScoreResult | null {
  return session.grading.result;
}
