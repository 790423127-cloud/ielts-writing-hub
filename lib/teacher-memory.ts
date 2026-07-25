"use client";

import type { TaskProfileId } from "../types/writing.ts";

const KEY = "ielts-writing-studio:v3:teacherMemory";
const LEGACY_KEY = "ielts-writing-studio:v2:teacherMemory";
const MAX_RECORDS = 250;

export type MemoryBucket =
  | "academicTask1"
  | "generalTask1"
  | "academicTask2"
  | "generalTask2"
  | "sharedLanguage";

export interface MemoryRecord {
  id: string;
  issueId: string;
  issueTitleZh: string;
  issueFamilyZh: string;
  taskScope: string;
  wrongPattern: string;
  correctPattern: string;
  originalExample: string;
  correctedExample: string;
  explanationZh: string;
  memoryHookZh: string;
  nextPracticeZh: string;
  status: string;
  occurrenceCount: number;
  repeatedCount: number;
  masteryStatus: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface TeacherMemory {
  version: 3;
  updatedAt: string;
  academicTask1: MemoryRecord[];
  generalTask1: MemoryRecord[];
  academicTask2: MemoryRecord[];
  generalTask2: MemoryRecord[];
  sharedLanguage: MemoryRecord[];
}

function emptyMemory(): TeacherMemory {
  return {
    version: 3,
    updatedAt: "",
    academicTask1: [],
    generalTask1: [],
    academicTask2: [],
    generalTask2: [],
    sharedLanguage: []
  };
}

export function memoryBucketForProfile(profileId: TaskProfileId, scope = ""): MemoryBucket {
  const normalized = scope.toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized.includes("shared") || normalized.includes("language")) return "sharedLanguage";
  if (profileId === "academic_task1") return "academicTask1";
  if (profileId === "general_task1") return "generalTask1";
  if (profileId === "academic_task2") return "academicTask2";
  return "generalTask2";
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadTeacherMemory(): TeacherMemory {
  if (!hasStorage()) return emptyMemory();
  try {
    const saved = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    const raw = saved ? (JSON.parse(saved) as Partial<TeacherMemory>) : null;
    if (!raw || typeof raw !== "object") return emptyMemory();

    const base = emptyMemory();
    const buckets: MemoryBucket[] = [
      "academicTask1",
      "generalTask1",
      "academicTask2",
      "generalTask2",
      "sharedLanguage"
    ];
    for (const bucket of buckets) {
      base[bucket] = Array.isArray(raw[bucket]) ? raw[bucket].slice(-MAX_RECORDS) : [];
    }
    base.updatedAt = raw.updatedAt ?? "";
    return base;
  } catch {
    return emptyMemory();
  }
}

function recordId(item: Record<string, unknown>): string {
  return String(
    item.issueId ?? item.id ?? item.wrongPattern ?? item.issueTitleZh ?? item.issueFamilyZh ?? ""
  )
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function text(item: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeItem(item: Record<string, unknown>, kind: string): MemoryRecord | null {
  const id = recordId(item);
  if (!id) return null;

  return {
    id,
    issueId: text(item, "issueId", "id") || id,
    issueTitleZh: text(item, "issueTitleZh", "titleZh", "issueFamilyZh"),
    issueFamilyZh: text(item, "issueFamilyZh"),
    taskScope: text(item, "taskScope", "scope"),
    wrongPattern: text(item, "wrongPattern", "wrongExpression"),
    correctPattern: text(item, "correctPattern", "saferVersion"),
    originalExample: text(item, "currentExample", "originalExample", "original", "previousExample"),
    correctedExample: text(item, "correctedExample", "corrected", "survivalCorrection"),
    explanationZh: text(item, "explanationZh", "whyWrongZh", "teacherNoteZh"),
    memoryHookZh: text(item, "memoryHookZh", "memoryTipZh", "teacherMemoryHookZh"),
    nextPracticeZh: text(item, "nextPracticeZh", "whatToPractiseAgainZh"),
    status: kind,
    occurrenceCount: kind === "improved" ? 0 : 1,
    repeatedCount: kind === "repeated" ? 1 : 0,
    masteryStatus: kind === "improved" ? "improving" : "not_mastered"
  };
}

export function mergeTeacherMemory(
  profileId: TaskProfileId,
  update: Record<string, unknown> = {}
): TeacherMemory {
  if (update.saveToLocalMemory === false) return loadTeacherMemory();
  const memory = loadTeacherMemory();
  const now = new Date().toISOString();

  const upsert = (raw: unknown, kind: string) => {
    if (!raw || typeof raw !== "object") return;
    const item = normalizeItem(raw as Record<string, unknown>, kind);
    if (!item) return;

    const bucket = memoryBucketForProfile(profileId, item.taskScope);
    const records = memory[bucket];
    const existing = records.find((record) => record.id === item.id);

    if (!existing) {
      records.push({ ...item, firstSeenAt: now, lastSeenAt: now });
      return;
    }

    Object.assign(
      existing,
      Object.fromEntries(Object.entries(item).filter(([, value]) => value !== ""))
    );
    existing.lastSeenAt = now;

    if (kind === "improved") {
      existing.masteryStatus = "improving";
    } else {
      existing.occurrenceCount = Number(existing.occurrenceCount || 0) + 1;
      if (kind === "repeated") existing.repeatedCount = Number(existing.repeatedCount || 0) + 1;
      existing.masteryStatus = "still_not_mastered";
    }
  };

  const groups = [
    ["newErrors", "new"],
    ["repeatedErrors", "repeated"],
    ["improvedErrors", "improved"]
  ] as const;

  for (const [key, kind] of groups) {
    const values = Array.isArray(update[key]) ? update[key] : [];
    values.forEach((item) => upsert(item, kind));
  }

  const buckets: MemoryBucket[] = [
    "academicTask1",
    "generalTask1",
    "academicTask2",
    "generalTask2",
    "sharedLanguage"
  ];
  for (const bucket of buckets) {
    memory[bucket] = memory[bucket]
      .sort((a, b) => String(a.lastSeenAt ?? "").localeCompare(String(b.lastSeenAt ?? "")))
      .slice(-MAX_RECORDS);
  }

  memory.updatedAt = now;
  if (hasStorage()) localStorage.setItem(KEY, JSON.stringify(memory));
  return memory;
}

export function teacherMemoryContext(profileId: TaskProfileId): Record<string, unknown> {
  const memory = loadTeacherMemory();
  const bucket = memoryBucketForProfile(profileId);
  const recent = (items: MemoryRecord[], limit = 18) =>
    [...items]
      .sort((a, b) => String(b.lastSeenAt ?? "").localeCompare(String(a.lastSeenAt ?? "")))
      .slice(0, limit);

  return {
    enabled: true,
    memoryVersion: "teacher-memory-v3-ag-separated",
    currentProfileId: profileId,
    taskMemoryBucket: bucket,
    rule:
      "Use only the current A/G task bucket plus sharedLanguage. Never mix Academic Task 1 visual-report advice with General Task 1 letter advice.",
    taskSpecificMemory: recent(memory[bucket]),
    sharedLanguageMemory: recent(memory.sharedLanguage),
    frequentErrors: [...memory[bucket], ...memory.sharedLanguage]
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, 12)
  };
}

export function teacherMemoryStats(): Record<MemoryBucket, number> {
  const memory = loadTeacherMemory();
  return {
    academicTask1: memory.academicTask1.length,
    generalTask1: memory.generalTask1.length,
    academicTask2: memory.academicTask2.length,
    generalTask2: memory.generalTask2.length,
    sharedLanguage: memory.sharedLanguage.length
  };
}

export function clearTeacherMemory(): void {
  if (!hasStorage()) return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
}
