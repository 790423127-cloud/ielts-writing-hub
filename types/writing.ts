export type TaskProfileId =
  | "academic_task1"
  | "academic_task2"
  | "general_task1"
  | "general_task2";

export type LearningModuleName =
  | "overview"
  | "sentenceUpgrade"
  | "grammarWordFormSpelling"
  | "structureCohesionTask"
  | "expressionBank"
  | "criterionFeedback";

export interface TaskProfile {
  id: TaskProfileId;
  examModule: "academic" | "general_training";
  taskNumber: 1 | 2;
  taskKind: "academic_visual_report" | "gt_letter" | "essay";
  label: string;
  title: string;
  description: string;
  minimumWords: number;
  minutes: number;
  accent: string;
}

export interface PromptDetection {
  profileId: TaskProfileId | "task2_ambiguous" | "";
  examModule: "academic" | "general_training" | "unknown" | "";
  taskNumber: 1 | 2 | null;
  confidence: number;
  evidence: string[];
}

export interface VisualFacts {
  visualType: string;
  referenceDescription: string;
  keyFeatures: string[];
  sourceVerified: boolean;
  verificationNote: string;
}

export interface PromptState {
  title: string;
  text: string;
  questionType: string;
  letterStyle: string;
  imageName: string;
  imageDataUrl: string;
  detection: PromptDetection | null;
  visualFacts: VisualFacts;
}

export interface CriterionEvidence {
  quote?: string;
  meaning?: string;
  meaningZh?: string;
}

export interface CriterionDetail {
  band?: number;
  summary?: string;
  summaryZh?: string;
  whyThisBand?: string;
  whyThisBandZh?: string;
  whyNotHigher?: string;
  whyNotHigherZh?: string;
  howToImprove?: string;
  howToImproveZh?: string;
  essayEvidence?: CriterionEvidence[];
  nextRevision?: {
    action?: string;
    actionZh?: string;
    beforeQuote?: string;
    revisedExample?: string;
    whyItWorks?: string;
    whyItWorksZh?: string;
  };
}

export interface ScoreResult {
  ok?: boolean;
  overallBand?: number;
  finalCriteria?: Record<string, number>;
  criteria?: Record<string, number>;
  criteriaDetails?: Record<string, CriterionDetail>;
  criterionCalibration?: Record<string, CriterionDetail>;
  overallAssessment?: string;
  overallAssessmentZh?: string;
  needsHumanReview?: boolean;
  humanReviewReasons?: string[];
  confidence?: string;
  confidenceScore?: number;
  disclaimerZh?: string;
  [key: string]: unknown;
}

export interface LearningState {
  modules: Partial<Record<LearningModuleName, unknown>>;
  generation: unknown | null;
  teacherClinic: unknown | null;
  liveSuggestions: LiveSuggestion[];
}

export interface LiveSuggestion {
  id: string;
  globalStart: number;
  globalEnd: number;
  original: string;
  replacement: string;
  type: string;
  confidence: number;
  message?: string;
  messageZh?: string;
  ieltsImpact?: string;
}

export interface WritingSession {
  schemaVersion: 3;
  id: string;
  profileId: TaskProfileId;
  examModule: TaskProfile["examModule"];
  taskNumber: 1 | 2;
  taskKind: TaskProfile["taskKind"];
  prompt: PromptState;
  writing: {
    essay: string;
    plan: string;
    wordCount: number;
  };
  timer: {
    durationSeconds: number;
    remainingSeconds: number;
    running: boolean;
  };
  grading: {
    status: "idle" | "loading" | "complete" | "error";
    result: ScoreResult | null;
    error: string;
  };
  learning: LearningState;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryStats {
  total: number;
  average: number | null;
  best: number | null;
  weakestCriterion: string;
}

export interface SavedExpression {
  id: string;
  expression: string;
  meaningZh: string;
  usageNote: string;
  sourceTitle: string;
  profileId: TaskProfileId | "";
  tags: string[];
  createdAt: string;
}

export interface MockExamDraft {
  schemaVersion: 1;
  id: string;
  examModule: "academic" | "general_training";
  task1: WritingSession;
  task2: WritingSession;
  activeTask: 1 | 2;
  timer: {
    durationSeconds: number;
    remainingSeconds: number;
    running: boolean;
  };
  createdAt: string;
  updatedAt: string;
}
