import type { NormalizedInput } from "./input.ts";
import type { CriterionName, TaskConfig } from "./tasks.ts";

export interface NormalizedEvidence {
  quote: string;
  explanation: string;
  explanationZh: string;
}

export interface NormalizedCriterion {
  band: number;
  diagnosis: string;
  diagnosisZh: string;
  bandBoundary: {
    fit: string;
    fitZh: string;
    nextBandGap: string;
    nextBandGapZh: string;
  };
  strengths: string[];
  strengthsZh: string[];
  constraints: string[];
  constraintsZh: string[];
  essayEvidence: NormalizedEvidence[];
  nextRevision: {
    priority: string;
    priorityZh: string;
    action: string;
    actionZh: string;
    beforeQuote: string;
    revisedExample: string;
    whyItWorks: string;
    whyItWorksZh: string;
  };
  ceilingAudit: {
    highestBandTested: number | null;
    passed: boolean;
    reason: string;
    band9PositiveEvidence: string;
    band9BlockingPattern: string;
  };
  feedbackComplete: boolean;
  confidence: number;
  whyThisBand: string;
  whyThisBandZh: string;
  whyNotHigher: string;
  whyNotHigherZh: string;
  howToImprove: string;
  howToImproveZh: string;
}

export interface NormalizedReport {
  examinerId: string;
  rateable: boolean;
  rateabilityReason: string;
  criteria: Record<CriterionName, number>;
  criterionDetails: Record<CriterionName, NormalizedCriterion>;
  rawAverage: number;
  overallBand: number;
  overallAssessment: string;
  overallAssessmentZh: string;
  revisionSequence: string[];
  revisionSequenceZh: string[];
  confidence: number;
  uncertaintyReasons: string[];
  needsHumanReview: boolean;
  evidenceCount: number;
  evidenceComplete: boolean;
  feedbackComplete: boolean;
  uniformCriteria: boolean;
  fullRangeCeilingAuditComplete: boolean;
  nonDescriptorUpperBandClaims: string[];
  criterionContrastAudit: {
    strongest: string;
    weakest: string;
    comparison: string;
    uniformProfileJustification: string;
  };
  contrastComplete: boolean;
}

export function roundHalf(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(9, Math.round(numeric * 2) / 2));
}

export function averageBand(criteria: Record<string, number>): { rawAverage: number; overallBand: number } {
  const values = Object.values(criteria).map(Number).filter(Number.isFinite);
  if (values.length !== 4) throw new Error("Exactly four criterion bands are required.");
  const rawAverage = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { rawAverage: Number(rawAverage.toFixed(3)), overallBand: roundHalf(rawAverage) ?? 0 };
}

function text(value: unknown): string {
  return String(value || "").trim();
}

function list(value: unknown, limit = 8): string[] {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map(text)
    .filter(Boolean)
    .slice(0, limit);
}

function evidence(value: unknown, essay: string): NormalizedEvidence[] {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  return source
    .map((entry) => {
      const raw = typeof entry === "string" ? { quote: entry } : (entry || {}) as Record<string, unknown>;
      const quote = text(raw.quote || raw.text || raw.original);
      if (!quote || !essay.includes(quote) || seen.has(quote)) return null;
      seen.add(quote);
      return {
        quote,
        explanation: text(raw.explanation || raw.meaning || raw.evidence),
        explanationZh: text(raw.explanationZh || raw.meaningZh || raw.evidenceZh)
      };
    })
    .filter((item): item is NormalizedEvidence => Boolean(item))
    .slice(0, 8);
}

function normalizeCriterion(raw: unknown, essay: string): NormalizedCriterion {
  const source = raw && typeof raw === "object" ? raw as Record<string, any> : {};
  const band = roundHalf(source.band ?? raw);
  if (band === null) throw new Error("A criterion band is missing or invalid.");
  const boundary = source.bandBoundary && typeof source.bandBoundary === "object" ? source.bandBoundary : {};
  const revision = source.nextRevision && typeof source.nextRevision === "object" ? source.nextRevision : {};
  const ceiling = source.ceilingAudit && typeof source.ceilingAudit === "object" ? source.ceilingAudit : {};
  const diagnosis = text(source.diagnosis || source.whyThisBand || source.summary);
  const diagnosisZh = text(source.diagnosisZh || source.whyThisBandZh || source.summaryZh);
  const fit = text(boundary.fit || source.whyNotLower || diagnosis);
  const fitZh = text(boundary.fitZh || source.whyNotLowerZh || diagnosisZh);
  const nextBandGap = text(boundary.nextBandGap || source.whyNotHigher);
  const nextBandGapZh = text(boundary.nextBandGapZh || source.whyNotHigherZh);
  const essayEvidence = evidence(source.essayEvidence || source.textEvidence || source.evidenceQuotes, essay);
  const beforeQuoteRaw = text(revision.beforeQuote || revision.quote || revision.original);
  const nextRevision = {
    priority: text(revision.priority || revision.focus || source.howToImprove),
    priorityZh: text(revision.priorityZh || revision.focusZh || source.howToImproveZh),
    action: text(revision.action || source.howToImprove),
    actionZh: text(revision.actionZh || source.howToImproveZh),
    beforeQuote: beforeQuoteRaw && essay.includes(beforeQuoteRaw) ? beforeQuoteRaw : "",
    revisedExample: text(revision.revisedExample || revision.after || revision.rewrite),
    whyItWorks: text(revision.whyItWorks || revision.explanation),
    whyItWorksZh: text(revision.whyItWorksZh || revision.explanationZh)
  };
  const ceilingAudit = {
    highestBandTested: roundHalf(ceiling.highestBandTested),
    passed: ceiling.passed === true,
    reason: text(ceiling.reason || ceiling.descriptorDecision),
    band9PositiveEvidence: text(ceiling.band9PositiveEvidence || ceiling.positiveEvidenceForBand9),
    band9BlockingPattern: text(ceiling.band9BlockingPattern || ceiling.blockingEvidenceForBand9)
  };
  const feedbackComplete = Boolean(
    diagnosis && diagnosisZh && fit && fitZh && nextBandGap && nextBandGapZh &&
    essayEvidence.length >= Math.min(2, essay.split(/\s+/).length > 30 ? 2 : 1) &&
    essayEvidence.every((item) => item.explanation && item.explanationZh) &&
    (nextRevision.action || nextRevision.priority) &&
    (nextRevision.actionZh || nextRevision.priorityZh) &&
    nextRevision.revisedExample && nextRevision.whyItWorks && nextRevision.whyItWorksZh
  );
  return {
    band,
    diagnosis,
    diagnosisZh,
    bandBoundary: { fit, fitZh, nextBandGap, nextBandGapZh },
    strengths: list(source.strengths || source.positiveEvidence),
    strengthsZh: list(source.strengthsZh || source.positiveEvidenceZh),
    constraints: list(source.constraints || source.limitingEvidence),
    constraintsZh: list(source.constraintsZh || source.limitingEvidenceZh),
    essayEvidence,
    nextRevision,
    ceilingAudit,
    feedbackComplete,
    confidence: Math.max(0, Math.min(1, Number(source.confidence) || 0.5)),
    whyThisBand: diagnosis,
    whyThisBandZh: diagnosisZh,
    whyNotHigher: nextBandGap,
    whyNotHigherZh: nextBandGapZh,
    howToImprove: nextRevision.action || nextRevision.priority,
    howToImproveZh: nextRevision.actionZh || nextRevision.priorityZh
  };
}

function suspiciousUpperBandClaim(name: string, detail: NormalizedCriterion, taskConfig: TaskConfig, input: NormalizedInput): boolean {
  const claim = [detail.bandBoundary.nextBandGap, detail.ceilingAudit.reason, detail.ceilingAudit.band9BlockingPattern].join(" ");
  if (/(?:require|need|lack|without)[^.!?]{0,90}(?:inversion|conditional|advanced structure|original|novel|surprising|innovative)/i.test(claim)) return true;
  if (/(?:absolute perfection|flawless|zero errors|complete absence of errors)/i.test(claim)) return true;
  if (detail.band < 9 && /(?:is correct|fully accurate|not an error|no true errors)/i.test(claim)) return true;
  if (name === taskConfig.firstCriterion && taskConfig.taskKind === "academic_visual_report" && /process|diagram/i.test(input.visualFacts?.visualType || "") && /(?:lack|missing|require)[^.!?]{0,90}compar/i.test(claim)) return true;
  return false;
}

export function normalizeExaminerReport(
  raw: unknown,
  taskConfig: TaskConfig,
  input: NormalizedInput,
  examinerId: string
): NormalizedReport {
  if (!raw || typeof raw !== "object") throw new Error(`Examiner ${examinerId} returned no report.`);
  const source = raw as Record<string, any>;
  const rawCriteria = source.criteria && typeof source.criteria === "object" ? source.criteria : {};
  const criteria = {} as Record<CriterionName, number>;
  const criterionDetails = {} as Record<CriterionName, NormalizedCriterion>;
  for (const name of taskConfig.criteria) {
    const detail = normalizeCriterion(rawCriteria[name], input.essay);
    criteria[name] = detail.band;
    criterionDetails[name] = detail;
  }
  const score = averageBand(criteria);
  const evidenceCount = Object.values(criterionDetails).reduce((sum, item) => sum + item.essayEvidence.length, 0);
  const rawContrast = source.criterionContrastAudit && typeof source.criterionContrastAudit === "object" ? source.criterionContrastAudit : {};
  const criterionContrastAudit = {
    strongest: text(rawContrast.strongest),
    weakest: text(rawContrast.weakest),
    comparison: text(rawContrast.comparison),
    uniformProfileJustification: text(rawContrast.uniformProfileJustification)
  };
  const uniformCriteria = new Set(Object.values(criteria)).size === 1;
  const fullRangeCeilingAuditComplete = Object.values(criterionDetails).every((detail) =>
    detail.ceilingAudit.highestBandTested === 9 && Boolean(detail.ceilingAudit.reason)
  );
  const nonDescriptorUpperBandClaims = taskConfig.criteria.filter((name) =>
    suspiciousUpperBandClaim(name, criterionDetails[name], taskConfig, input)
  );
  const contrastComplete = Boolean(
    criterionContrastAudit.strongest && criterionContrastAudit.weakest && criterionContrastAudit.comparison &&
    (!uniformCriteria || criterionContrastAudit.uniformProfileJustification)
  );
  return {
    examinerId,
    rateable: source.rateable !== false,
    rateabilityReason: text(source.rateabilityReason),
    criteria,
    criterionDetails,
    ...score,
    overallAssessment: text(source.overallAssessment),
    overallAssessmentZh: text(source.overallAssessmentZh),
    revisionSequence: list(source.revisionSequence, 6),
    revisionSequenceZh: list(source.revisionSequenceZh, 6),
    confidence: Math.max(0, Math.min(1, Number(source.confidence) || 0.5)),
    uncertaintyReasons: list(source.uncertaintyReasons, 10),
    needsHumanReview: source.needsHumanReview === true,
    evidenceCount,
    evidenceComplete: evidenceCount >= taskConfig.criteria.length * Math.min(2, input.essay.split(/\s+/).length > 30 ? 2 : 1),
    feedbackComplete: Object.values(criterionDetails).every((detail) => detail.feedbackComplete),
    uniformCriteria,
    fullRangeCeilingAuditComplete,
    nonDescriptorUpperBandClaims,
    criterionContrastAudit,
    contrastComplete
  };
}
