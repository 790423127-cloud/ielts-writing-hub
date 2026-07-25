import { RequestValidationError, type TaskConfig } from "./tasks.ts";

export interface VisualFacts {
  visualType: string;
  title: string;
  units: string | string[];
  timeRange: unknown[];
  series: unknown[];
  dataPoints: unknown[];
  keyFeatures: string[];
  majorComparisons: string[];
  stages: string[];
  mapChanges: Record<string, unknown>;
  referenceDescription: string;
  sourceVerified: boolean;
  verificationNote: string;
}

export interface NormalizedInput {
  essay: string;
  prompt: string;
  title: string;
  promptId: string;
  letterStyle: string;
  questionType: string;
  questionSubtype: string;
  visualFacts: VisualFacts | null;
  signals: Record<string, unknown>;
}

export function wordTokens(text: unknown): string[] {
  return String(text || "").match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g) || [];
}

export function countWords(text: unknown): number {
  return wordTokens(text).length;
}

export function countSentences(text: unknown): number {
  return String(text || "")
    .split(/[.!?]+(?:\s+|$)/)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

export function countParagraphs(text: unknown): number {
  return String(text || "")
    .trim()
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function englishLetterRatio(text: string): number {
  const compact = text.replace(/\s/g, "");
  if (!compact) return 0;
  return Number((((compact.match(/[A-Za-z]/g) || []).length / compact.length)).toFixed(3));
}

function copiedPromptRatio(prompt: string, essay: string): number {
  const tokens = (value: string) => value.toLowerCase().match(/[a-z]{3,}/g) || [];
  const promptSet = new Set(tokens(prompt));
  const essayTokens = tokens(essay);
  if (!promptSet.size || !essayTokens.length) return 0;
  const matched = essayTokens.filter((token) => promptSet.has(token)).length;
  return Number((matched / essayTokens.length).toFixed(3));
}

function possiblePromptInjection(text: string): boolean {
  return /ignore (all|any|the|previous)|system prompt|developer message|give (me|this) (a )?band|do not grade|you are chatgpt|output only band/i.test(text);
}

function normalizeStringList(value: unknown, limit: number): string[] {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeVisualFacts(body: Record<string, any>, taskConfig: TaskConfig): VisualFacts | null {
  if (taskConfig.taskKind !== "academic_visual_report") return null;
  const source = body.visualFacts && typeof body.visualFacts === "object" ? body.visualFacts : {};
  return {
    visualType: String(source.visualType || body.visualType || body.bigType || "unknown").slice(0, 120),
    title: String(source.title || body.title || "").slice(0, 500),
    units: Array.isArray(source.units) ? source.units.slice(0, 20) : String(source.units || "").slice(0, 200),
    timeRange: Array.isArray(source.timeRange) ? source.timeRange.slice(0, 20) : [],
    series: Array.isArray(source.series) ? source.series.slice(0, 50) : [],
    dataPoints: Array.isArray(source.dataPoints) ? source.dataPoints.slice(0, 400) : [],
    keyFeatures: normalizeStringList(source.keyFeatures, 40),
    majorComparisons: normalizeStringList(source.majorComparisons, 40),
    stages: normalizeStringList(source.stages, 60),
    mapChanges: source.mapChanges && typeof source.mapChanges === "object" ? source.mapChanges : {},
    referenceDescription: String(source.referenceDescription || body.referenceAnswer || "").slice(0, 15_000),
    sourceVerified: source.sourceVerified === true,
    verificationNote: String(source.verificationNote || "").slice(0, 1_000)
  };
}

export function validateAndNormalizeInput(body: Record<string, any>, taskConfig: TaskConfig): NormalizedInput {
  const essay = String(body.essay || body.response || "").trim();
  const prompt = String(body.questionPrompt || body.promptText || body.prompt || "").trim();
  if (!prompt) throw new RequestValidationError("questionPrompt is required.", "MISSING_PROMPT");
  if (!essay) throw new RequestValidationError("essay is required.", "MISSING_ESSAY");
  if (prompt.length > 20_000) throw new RequestValidationError("questionPrompt is too long.", "PROMPT_TOO_LONG");
  if (essay.length > 50_000) throw new RequestValidationError("essay is too long.", "ESSAY_TOO_LONG");

  const wordCount = countWords(essay);
  const sentenceCount = countSentences(essay);
  const visualFacts = normalizeVisualFacts(body, taskConfig);
  const lexicalTokens = wordTokens(essay).map((token) => token.toLowerCase());
  const lexicalDiversity = lexicalTokens.length ? new Set(lexicalTokens).size / lexicalTokens.length : 0;
  const letterRatio = englishLetterRatio(essay);

  return {
    essay,
    prompt,
    title: String(body.title || body.questionTitle || "").slice(0, 500),
    promptId: String(body.promptId || "").slice(0, 200),
    letterStyle: String(body.letterStyle || "").slice(0, 100),
    questionType: String(body.questionType || body.bigType || "").slice(0, 200),
    questionSubtype: String(body.questionSubtype || body.subtype || "").slice(0, 200),
    visualFacts,
    signals: {
      task: taskConfig.task,
      taskKind: taskConfig.taskKind,
      examModule: taskConfig.examModule,
      wordCount,
      clientWordCount: Number.isFinite(Number(body.wordCount)) ? Number(body.wordCount) : null,
      clientWordCountIgnored: Number.isFinite(Number(body.wordCount)) && Number(body.wordCount) !== wordCount,
      minimumWords: taskConfig.minimumWords,
      underMinimum: wordCount < taskConfig.minimumWords,
      severeLengthRisk: wordCount < Math.max(20, Math.floor(taskConfig.minimumWords * 0.45)),
      paragraphCount: countParagraphs(essay),
      sentenceCount,
      averageSentenceWords: sentenceCount ? Number((wordCount / sentenceCount).toFixed(1)) : 0,
      lexicalDiversity: Number(lexicalDiversity.toFixed(3)),
      englishLetterRatio: letterRatio,
      possibleNonEnglishResponse: letterRatio < 0.45,
      possiblePromptInjection: possiblePromptInjection(essay),
      copiedPromptRatio: copiedPromptRatio(prompt, essay),
      visualFactsAvailable: Boolean(
        visualFacts &&
        (visualFacts.referenceDescription || visualFacts.keyFeatures.length || visualFacts.dataPoints.length || visualFacts.stages.length)
      ),
      visualFactsSourceVerified: Boolean(visualFacts?.sourceVerified)
    }
  };
}
