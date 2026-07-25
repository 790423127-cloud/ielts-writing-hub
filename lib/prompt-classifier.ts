import type { PromptDetection, TaskProfileId } from "../types/writing.ts";

const LETTER_PATTERNS = [
  /write\s+(?:a|an)\s+letter/i,
  /in\s+your\s+letter/i,
  /dear\s+(?:sir|madam|mr|mrs|friend)/i
];

const VISUAL_PATTERNS = [
  /(?:chart|graph|table|diagram|map|maps|process|flow\s*chart|pie\s*chart|bar\s*chart|line\s*graph)/i,
  /summari[sz]e\s+the\s+information/i,
  /selecting\s+and\s+reporting\s+the\s+main\s+features/i
];

const TASK2_PATTERNS = [
  /to\s+what\s+extent\s+do\s+you\s+agree/i,
  /discuss\s+both\s+(?:these\s+)?views/i,
  /advantages?\s+and\s+disadvantages?/i,
  /do\s+the\s+advantages?\s+outweigh/i,
  /what\s+are\s+the\s+(?:causes|problems|reasons)/i,
  /give\s+reasons\s+for\s+your\s+answer/i
];

export function classifyPrompt(text = ""): PromptDetection {
  const prompt = String(text).trim();
  if (!prompt) {
    return { profileId: "", confidence: 0, evidence: [], taskNumber: null, examModule: "" };
  }

  const letterHits = LETTER_PATTERNS.filter((pattern) => pattern.test(prompt));
  const visualHits = VISUAL_PATTERNS.filter((pattern) => pattern.test(prompt));
  const task2Hits = TASK2_PATTERNS.filter((pattern) => pattern.test(prompt));

  if (letterHits.length >= 2 || (letterHits.length > 0 && /bullet|•|\n\s*[-–—]/.test(prompt))) {
    return {
      profileId: "general_task1",
      examModule: "general_training",
      taskNumber: 1,
      confidence: Math.min(0.99, 0.72 + letterHits.length * 0.1),
      evidence: ["题目包含书信指令", letterHits.length >= 2 ? "检测到多个书信特征" : "检测到书信要点结构"]
    };
  }

  if (visualHits.length >= 2 || (visualHits.length > 0 && /below|shows?|illustrates?|compares?/i.test(prompt))) {
    return {
      profileId: "academic_task1",
      examModule: "academic",
      taskNumber: 1,
      confidence: Math.min(0.99, 0.7 + visualHits.length * 0.1),
      evidence: ["题目包含图表、地图或流程图特征", visualHits.length >= 2 ? "检测到标准 Academic Task 1 指令" : "检测到视觉描述任务"]
    };
  }

  if (task2Hits.length > 0) {
    return {
      profileId: "task2_ambiguous",
      examModule: "unknown",
      taskNumber: 2,
      confidence: Math.min(0.96, 0.7 + task2Hits.length * 0.08),
      evidence: ["题目包含 Task 2 议论文问法", "仅凭 Task 2 题目通常无法可靠区分 A 类或 G 类"]
    };
  }

  return {
    profileId: "",
    examModule: "",
    taskNumber: null,
    confidence: 0.35,
    evidence: ["题目特征不足，继续使用用户选择"]
  };
}

export function detectConflict(
  selectedProfileId: TaskProfileId,
  detection: PromptDetection
): { conflict: boolean; suggestedProfileId: TaskProfileId | ""; message: string } {
  if (!detection.profileId || detection.profileId === "task2_ambiguous") {
    if (detection.taskNumber === 2 && !selectedProfileId.endsWith("task2")) {
      return { conflict: true, suggestedProfileId: "", message: "系统判断这更像 Task 2 题目，请确认任务类型。" };
    }
    return { conflict: false, suggestedProfileId: "", message: "" };
  }

  if (detection.profileId === selectedProfileId) {
    return { conflict: false, suggestedProfileId: "", message: "" };
  }

  return {
    conflict: true,
    suggestedProfileId: detection.profileId,
    message:
      detection.profileId === "academic_task1"
        ? "系统判断这更像 Academic Task 1 图表题。"
        : "系统判断这更像 General Training Task 1 书信题。"
  };
}
