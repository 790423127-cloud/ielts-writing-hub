export type ExamModule = "academic" | "general_training";
export type TaskKind = "academic_visual_report" | "gt_letter" | "essay";
export type CriterionName =
  | "Task Achievement"
  | "Task Response"
  | "Coherence and Cohesion"
  | "Lexical Resource"
  | "Grammatical Range and Accuracy";

export interface TaskConfig {
  examModule: ExamModule;
  moduleLabel: string;
  taskNumber: 1 | 2;
  task: "Task 1" | "Task 2";
  taskKind: TaskKind;
  minimumWords: number;
  suggestedMinutes: number;
  firstCriterion: "Task Achievement" | "Task Response";
  criteria: CriterionName[];
  instructions: string[];
  rubricVersion: string;
}

export const RUBRIC_VERSION = "ielts-writing-rubric-2026-07-v6.5-next-native";

export class RequestValidationError extends Error {
  code: string;
  httpStatus = 400;

  constructor(message: string, code = "INVALID_REQUEST") {
    super(message);
    this.name = "RequestValidationError";
    this.code = code;
  }
}

const SHARED: CriterionName[] = [
  "Coherence and Cohesion",
  "Lexical Resource",
  "Grammatical Range and Accuracy"
];

const REGISTRY: Record<string, Omit<TaskConfig, "rubricVersion">> = {
  "general_training:1": {
    examModule: "general_training",
    moduleLabel: "General Training",
    taskNumber: 1,
    task: "Task 1",
    taskKind: "gt_letter",
    minimumWords: 150,
    suggestedMinutes: 20,
    firstCriterion: "Task Achievement",
    criteria: ["Task Achievement", ...SHARED],
    instructions: [
      "Judge the letter as communication to a specific reader.",
      "Check whether the purpose is clear and every bullet receives useful, relevant detail.",
      "Judge tone and register across the whole letter, not only the greeting and closing.",
      "Do not reward memorised letter phrases that do not help the communicative purpose."
    ]
  },
  "academic:1": {
    examModule: "academic",
    moduleLabel: "Academic",
    taskNumber: 1,
    task: "Task 1",
    taskKind: "academic_visual_report",
    minimumWords: 150,
    suggestedMinutes: 20,
    firstCriterion: "Task Achievement",
    criteria: ["Task Achievement", ...SHARED],
    instructions: [
      "Judge the response as a selective visual summary, not a list of every detail.",
      "Check the overview, choice of key features, useful comparisons or grouping of stages.",
      "Verify facts only against the supplied visualFacts. Never invent unseen data.",
      "For maps, judge major additions, removals, relocations and unchanged features.",
      "For processes, judge sequence, endpoints, cyclical or linear nature and grouping.",
      "When the fact layer is missing or unverified, flag factual accuracy for human review rather than inventing a penalty."
    ]
  },
  "general_training:2": {
    examModule: "general_training",
    moduleLabel: "General Training",
    taskNumber: 2,
    task: "Task 2",
    taskKind: "essay",
    minimumWords: 250,
    suggestedMinutes: 40,
    firstCriterion: "Task Response",
    criteria: ["Task Response", ...SHARED],
    instructions: [
      "Identify every direct question and required view before judging Task Response.",
      "Follow the position across the whole essay and reward a clear qualified position.",
      "Judge development through claim, reason, consequence and example, not paragraph length.",
      "Personal experience is valid when it genuinely supports the argument."
    ]
  },
  "academic:2": {
    examModule: "academic",
    moduleLabel: "Academic",
    taskNumber: 2,
    task: "Task 2",
    taskKind: "essay",
    minimumWords: 250,
    suggestedMinutes: 40,
    firstCriterion: "Task Response",
    criteria: ["Task Response", ...SHARED],
    instructions: [
      "Identify every direct question and required view before judging Task Response.",
      "Follow the position across the whole essay and reward a clear qualified position.",
      "Judge development through claim, reason, consequence and example, not paragraph length.",
      "Expect an academic or semi-formal style without requiring specialist knowledge."
    ]
  }
};

export function normalizeExamModule(value: unknown, body: Record<string, unknown> = {}): ExamModule {
  const raw = String(value || body.module || body.testModule || "").trim().toLowerCase();
  const compact = raw.replace(/[\s_-]+/g, "");
  const taskKind = String(body.taskKind || "").toLowerCase();
  if (taskKind === "academic_visual_report") return "academic";
  if (taskKind === "gt_letter") return "general_training";
  if (["a", "ac", "academic", "atype", "aclass", "a类", "学术", "学术类"].includes(compact)) return "academic";
  if (["g", "gt", "general", "generaltraining", "gtype", "gclass", "g类", "培训", "培训类"].includes(compact)) return "general_training";
  if (/academic|学术|a类/.test(raw)) return "academic";
  if (/general|training|培训|g类/.test(raw)) return "general_training";
  throw new RequestValidationError("examModule must be academic or general_training.", "INVALID_EXAM_MODULE");
}

export function normalizeTaskNumber(value: unknown, body: Record<string, unknown> = {}): 1 | 2 {
  const raw = String(value || body.task || body.scoringTask || body.selectedTask || body.taskType || "").toLowerCase();
  if (Number(value) === 1 || /task\s*1|task1|letter|visual|report|小作文/.test(raw)) return 1;
  if (Number(value) === 2 || /task\s*2|task2|essay|大作文/.test(raw)) return 2;
  throw new RequestValidationError("taskNumber must identify Task 1 or Task 2.", "INVALID_TASK");
}

export function resolveTaskConfig(body: Record<string, unknown> = {}): TaskConfig {
  const examModule = normalizeExamModule(body.examModule, body);
  const taskNumber = normalizeTaskNumber(body.taskNumber, body);
  const config = REGISTRY[`${examModule}:${taskNumber}`];
  if (!config) throw new RequestValidationError("Unsupported IELTS writing task.", "UNSUPPORTED_TASK");
  if (body.taskKind && String(body.taskKind) !== config.taskKind) {
    throw new RequestValidationError(
      `taskKind ${String(body.taskKind)} does not match ${config.moduleLabel} Task ${taskNumber}.`,
      "TASK_KIND_MISMATCH"
    );
  }
  return { ...config, criteria: [...config.criteria], instructions: [...config.instructions], rubricVersion: RUBRIC_VERSION };
}
