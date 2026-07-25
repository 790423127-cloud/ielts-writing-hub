const KEY = "ielts-writing-studio:v2:teacherMemory";
const MAX_RECORDS = 250;

function emptyMemory() {
  return {
    version: 2,
    updatedAt: "",
    academicTask1: [],
    generalTask1: [],
    academicTask2: [],
    generalTask2: [],
    sharedLanguage: []
  };
}

export function memoryBucketForProfile(profileId, scope = "") {
  const normalized = String(scope || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized.includes("shared") || normalized.includes("language")) return "sharedLanguage";
  if (profileId === "academic_task1") return "academicTask1";
  if (profileId === "general_task1") return "generalTask1";
  if (profileId === "academic_task2") return "academicTask2";
  return "generalTask2";
}

export function loadTeacherMemory() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object") return emptyMemory();
    const base = emptyMemory();
    for (const key of Object.keys(base)) {
      if (Array.isArray(base[key])) base[key] = Array.isArray(raw[key]) ? raw[key].slice(-MAX_RECORDS) : [];
    }
    base.updatedAt = raw.updatedAt || "";
    return base;
  } catch {
    return emptyMemory();
  }
}

function recordId(item = {}) {
  return String(item.issueId || item.id || item.wrongPattern || item.issueTitleZh || item.issueFamilyZh || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function normalizeItem(item = {}, kind = "new") {
  const id = recordId(item);
  if (!id) return null;
  return {
    id,
    issueId: item.issueId || item.id || id,
    issueTitleZh: item.issueTitleZh || item.titleZh || item.issueFamilyZh || "",
    issueFamilyZh: item.issueFamilyZh || "",
    taskScope: item.taskScope || item.scope || "",
    wrongPattern: item.wrongPattern || item.wrongExpression || "",
    correctPattern: item.correctPattern || item.saferVersion || "",
    originalExample: item.currentExample || item.originalExample || item.original || item.previousExample || "",
    correctedExample: item.correctedExample || item.corrected || item.survivalCorrection || "",
    explanationZh: item.explanationZh || item.whyWrongZh || item.teacherNoteZh || "",
    memoryHookZh: item.memoryHookZh || item.memoryTipZh || item.teacherMemoryHookZh || "",
    nextPracticeZh: item.nextPracticeZh || item.whatToPractiseAgainZh || "",
    status: kind,
    occurrenceCount: kind === "improved" ? 0 : 1,
    repeatedCount: kind === "repeated" ? 1 : 0,
    masteryStatus: kind === "improved" ? "improving" : "not_mastered"
  };
}

export function mergeTeacherMemory(profileId, update = {}) {
  if (!update || update.saveToLocalMemory === false) return loadTeacherMemory();
  const memory = loadTeacherMemory();
  const now = new Date().toISOString();

  const upsert = (raw, kind) => {
    const item = normalizeItem(raw, kind);
    if (!item) return;
    const bucket = memoryBucketForProfile(profileId, item.taskScope);
    const records = memory[bucket];
    const existing = records.find((record) => record.id === item.id);
    if (!existing) {
      records.push({ ...item, firstSeenAt: now, lastSeenAt: now });
    } else {
      Object.assign(existing, Object.fromEntries(Object.entries(item).filter(([, value]) => value !== "")));
      existing.lastSeenAt = now;
      if (kind === "improved") {
        existing.masteryStatus = "improving";
      } else {
        existing.occurrenceCount = Number(existing.occurrenceCount || 0) + 1;
        if (kind === "repeated") existing.repeatedCount = Number(existing.repeatedCount || 0) + 1;
        existing.masteryStatus = "still_not_mastered";
      }
    }
  };

  (update.newErrors || []).forEach((item) => upsert(item, "new"));
  (update.repeatedErrors || []).forEach((item) => upsert(item, "repeated"));
  (update.improvedErrors || []).forEach((item) => upsert(item, "improved"));

  for (const key of ["academicTask1", "generalTask1", "academicTask2", "generalTask2", "sharedLanguage"]) {
    memory[key] = memory[key]
      .sort((a, b) => String(a.lastSeenAt || "").localeCompare(String(b.lastSeenAt || "")))
      .slice(-MAX_RECORDS);
  }
  memory.updatedAt = now;
  localStorage.setItem(KEY, JSON.stringify(memory));
  return memory;
}

export function teacherMemoryContext(profileId) {
  const memory = loadTeacherMemory();
  const bucket = memoryBucketForProfile(profileId);
  const recent = (items, limit = 18) => items.slice().sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || ""))).slice(0, limit);
  return {
    enabled: true,
    memoryVersion: "teacher-memory-v2-ag-separated",
    currentProfileId: profileId,
    taskMemoryBucket: bucket,
    rule: "Use only the current A/G task bucket plus sharedLanguage. Never mix Academic Task 1 visual-report advice with General Task 1 letter advice.",
    taskSpecificMemory: recent(memory[bucket]),
    sharedLanguageMemory: recent(memory.sharedLanguage),
    frequentErrors: [...memory[bucket], ...memory.sharedLanguage]
      .sort((a, b) => Number(b.occurrenceCount || 0) - Number(a.occurrenceCount || 0))
      .slice(0, 12)
  };
}

export function teacherMemoryStats() {
  const memory = loadTeacherMemory();
  return {
    academicTask1: memory.academicTask1.length,
    generalTask1: memory.generalTask1.length,
    academicTask2: memory.academicTask2.length,
    generalTask2: memory.generalTask2.length,
    sharedLanguage: memory.sharedLanguage.length
  };
}
