import { getTaskProfile } from "./task-profiles.js";

export function createId() {
  return globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function countWords(text) {
  return (String(text || "").match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g) || []).length;
}

export function createSession(profileId) {
  const profile = getTaskProfile(profileId);
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
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
    timer: { durationSeconds: profile.minutes * 60, remainingSeconds: profile.minutes * 60, running: false },
    grading: { status: "idle", result: null, error: "" },
    learning: { modules: {}, generation: null, teacherClinic: null, liveSuggestions: [] },
    createdAt: now,
    updatedAt: now
  };
}

export function ensureSessionShape(raw) {
  if (!raw || typeof raw !== "object" || !raw.profileId) return null;
  const base = createSession(raw.profileId);
  return {
    ...base,
    ...raw,
    schemaVersion: 2,
    prompt: {
      ...base.prompt,
      ...(raw.prompt || {}),
      visualFacts: { ...base.prompt.visualFacts, ...(raw.prompt?.visualFacts || {}) }
    },
    writing: { ...base.writing, ...(raw.writing || {}) },
    timer: { ...base.timer, ...(raw.timer || {}), running: false },
    grading: { ...base.grading, ...(raw.grading || {}) },
    learning: {
      ...base.learning,
      ...(raw.learning || {}),
      modules: { ...(raw.learning?.modules || {}) },
      liveSuggestions: Array.isArray(raw.learning?.liveSuggestions) ? raw.learning.liveSuggestions : []
    }
  };
}

export function buildScoringPayload(session) {
  const profile = getTaskProfile(session.profileId);
  const prompt = String(session.prompt?.text || "").trim();
  const essay = String(session.writing?.essay || "").trim();
  if (!prompt) throw new Error("请先粘贴作文题目。");
  if (!essay) throw new Error("请先输入作文内容。");

  const payload = {
    examModule: profile.examModule,
    taskNumber: profile.taskNumber,
    taskKind: profile.taskKind,
    questionPrompt: prompt,
    prompt,
    title: String(session.prompt?.title || "").trim(),
    essay,
    wordCount: countWords(essay),
    questionType: String(session.prompt?.questionType || "").trim(),
    letterStyle: String(session.prompt?.letterStyle || "").trim(),
    promptId: session.id,
    task: `Task ${profile.taskNumber}`,
    taskType: profile.taskNumber === 1 ? "task1" : "task2",
    mode: "score"
  };

  if (profile.taskKind === "academic_visual_report") {
    const facts = session.prompt?.visualFacts || {};
    payload.visualFacts = {
      visualType: String(facts.visualType || "unknown"),
      referenceDescription: String(facts.referenceDescription || "").trim(),
      keyFeatures: Array.isArray(facts.keyFeatures) ? facts.keyFeatures.filter(Boolean).slice(0, 30) : [],
      sourceVerified: facts.sourceVerified === true,
      verificationNote: String(facts.verificationNote || "")
    };
  }
  return payload;
}

export function buildLearningPayload(session, extra = {}) {
  const base = buildScoringPayload(session);
  return {
    ...base,
    ...extra,
    currentResult: session.grading?.result || null,
    frozenScore: session.grading?.result ? {
      overallBand: session.grading.result.overallBand,
      finalCriteria: session.grading.result.finalCriteria || session.grading.result.criteria || {}
    } : null
  };
}

export function touchSession(session) {
  session.writing.wordCount = countWords(session.writing.essay);
  session.updatedAt = new Date().toISOString();
  return session;
}
