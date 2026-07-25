import { callJson, type AiCallResult } from "../ai/deepseek.ts";
import { auditAgreement, selectStableReport } from "./agreement.ts";
import { validateAndNormalizeInput } from "./input.ts";
import { normalizeExaminerReport, type NormalizedReport } from "./normalize.ts";
import {
  buildAdjudicatorMessages,
  buildExaminerMessages,
  buildFeedbackRepairMessages
} from "./prompts.ts";
import { resolveTaskConfig } from "./tasks.ts";

export interface ScoringOptions {
  signal?: AbortSignal;
  onStage?: (stage: string, detail?: Record<string, unknown>) => void;
}

function confidenceLabel(value: number): "high" | "medium" | "low" {
  if (value >= 0.82) return "high";
  if (value >= 0.65) return "medium";
  return "low";
}

function publicExaminerSummary(report: NormalizedReport) {
  return {
    examinerId: report.examinerId,
    rateable: report.rateable,
    criteria: report.criteria,
    overallBand: report.overallBand,
    confidence: report.confidence,
    evidenceCount: report.evidenceCount,
    evidenceComplete: report.evidenceComplete,
    feedbackComplete: report.feedbackComplete,
    uniformCriteria: report.uniformCriteria,
    needsHumanReview: report.needsHumanReview,
    uncertaintyReasons: report.uncertaintyReasons
  };
}

async function callAndNormalize(args: {
  role: string;
  messages: ReturnType<typeof buildExaminerMessages>;
  taskConfig: ReturnType<typeof resolveTaskConfig>;
  input: ReturnType<typeof validateAndNormalizeInput>;
  examinerId: string;
  signal?: AbortSignal;
}): Promise<{ call: AiCallResult<Record<string, unknown>>; report: NormalizedReport }> {
  let lastError: unknown = null;
  for (let semanticAttempt = 1; semanticAttempt <= 2; semanticAttempt += 1) {
    const messages = semanticAttempt === 1
      ? args.messages
      : args.messages.map((message, index) => index === args.messages.length - 1
        ? {
            ...message,
            content: `${String(message.content)}\n\nSEMANTIC RETRY: The previous JSON was incomplete or invalid. Return all four criteria, valid half-band scores, exact essay evidence and all required bilingual feedback fields.`
          }
        : message);
    const call = await callJson<Record<string, unknown>>({
      role: args.role,
      messages,
      signal: args.signal,
      maxTokens: args.role === "high_specialist" ? 8_000 : 6_500,
      temperature: 0.08,
      reasoningEffort: args.role === "high_specialist" ? "high" : "medium"
    });
    try {
      const report = normalizeExaminerReport(call.data, args.taskConfig, args.input, args.examinerId);
      if (!report.fullRangeCeilingAuditComplete && semanticAttempt === 1) {
        throw new Error("The Band-9 ceiling audit was incomplete.");
      }
      if (report.nonDescriptorUpperBandClaims.length && semanticAttempt === 1) {
        throw new Error("The report used non-descriptor upper-band blockers.");
      }
      return { call, report };
    } catch (error) {
      lastError = error;
      if (semanticAttempt === 2) throw error;
    }
  }
  throw lastError || new Error("Invalid examiner report.");
}

export async function runUnifiedScoring(body: Record<string, any>, options: ScoringOptions = {}) {
  const taskConfig = resolveTaskConfig(body);
  const input = validateAndNormalizeInput(body, taskConfig);
  const startedAt = Date.now();
  const reportStage = (stage: string, detail: Record<string, unknown> = {}) => options.onStage?.(stage, detail);

  reportStage("examiners_started");
  const [examinerAResult, examinerBResult] = await Promise.all([
    callAndNormalize({
      role: "examiner",
      messages: buildExaminerMessages({ taskConfig, input, examinerId: "A" }),
      taskConfig,
      input,
      examinerId: "A",
      signal: options.signal
    }),
    callAndNormalize({
      role: "examiner",
      messages: buildExaminerMessages({ taskConfig, input, examinerId: "B" }),
      taskConfig,
      input,
      examinerId: "B",
      signal: options.signal
    })
  ]);
  reportStage("examiners_completed");

  const examinerA = examinerAResult.report;
  const examinerB = examinerBResult.report;
  const agreement = auditAgreement(examinerA, examinerB, taskConfig);
  reportStage("agreement_completed", {
    adjudicationRequired: agreement.adjudicationRequired,
    reasons: agreement.reasons
  });

  const upperBoundaryCandidate = Math.max(examinerA.overallBand, examinerB.overallBand) >= 7;
  let finalReport: NormalizedReport;
  let finalCallAudit: unknown = null;
  let adjudication: Record<string, unknown>;

  if (agreement.adjudicationRequired || upperBoundaryCandidate) {
    const highBoundary = upperBoundaryCandidate;
    reportStage(highBoundary ? "high_specialist_started" : "adjudication_started", {
      reasons: agreement.reasons
    });
    const messages = buildAdjudicatorMessages({
      taskConfig,
      input,
      examinerA: publicExaminerSummary(examinerA),
      examinerB: publicExaminerSummary(examinerB),
      highBoundary
    });
    const adjudicatorResult = await callAndNormalize({
      role: highBoundary ? "high_specialist" : "adjudicator",
      messages,
      taskConfig,
      input,
      examinerId: highBoundary ? "high-specialist" : "adjudicator",
      signal: options.signal
    });
    finalReport = adjudicatorResult.report;
    finalCallAudit = adjudicatorResult.call.audit;
    adjudication = {
      triggered: true,
      reasons: agreement.reasons,
      decision: highBoundary ? "independent_pro_upper_boundary_final" : "independent_reassessment",
      finalCriteria: finalReport.criteria,
      finalOverallBand: finalReport.overallBand,
      localScoreAdjustment: false
    };
    reportStage(highBoundary ? "high_specialist_completed" : "adjudication_completed", {
      finalOverallBand: finalReport.overallBand
    });
  } else {
    const selection = selectStableReport(examinerA, examinerB);
    finalReport = selection.selected;
    adjudication = {
      triggered: false,
      reasons: [],
      decision: "stable_examiner_selected",
      selectionReason: selection.reason,
      localScoreAdjustment: false
    };
    reportStage("adjudication_skipped", { reason: "AI_PANEL_STABLE" });
  }

  let feedbackRepairAudit: unknown = null;
  if (!finalReport.feedbackComplete) {
    reportStage("feedback_repair_started");
    const repairCall = await callJson<Record<string, unknown>>({
      role: "feedback",
      messages: buildFeedbackRepairMessages({
        taskConfig,
        input,
        frozenCriteria: finalReport.criteria,
        currentReport: finalReport
      }),
      signal: options.signal,
      maxTokens: 9_000,
      temperature: 0.08
    });
    const repairedRaw = { ...repairCall.data, criteria: { ...(repairCall.data.criteria as Record<string, unknown> || {}) } } as Record<string, any>;
    for (const criterion of taskConfig.criteria) {
      const item = repairedRaw.criteria[criterion] && typeof repairedRaw.criteria[criterion] === "object"
        ? repairedRaw.criteria[criterion]
        : {};
      repairedRaw.criteria[criterion] = { ...item, band: finalReport.criteria[criterion] };
    }
    const repaired = normalizeExaminerReport(repairedRaw, taskConfig, input, `${finalReport.examinerId}-feedback-repair`);
    const scoresUnchanged = taskConfig.criteria.every((criterion) => repaired.criteria[criterion] === finalReport.criteria[criterion]);
    if (scoresUnchanged && repaired.feedbackComplete) {
      finalReport = repaired;
      feedbackRepairAudit = repairCall.audit;
      reportStage("feedback_repair_completed");
    } else {
      reportStage("feedback_repair_rejected", { scoresUnchanged, feedbackComplete: repaired.feedbackComplete });
    }
  }

  const humanReviewReasons = [...new Set([
    ...finalReport.uncertaintyReasons,
    ...(taskConfig.taskKind === "academic_visual_report" && !input.visualFacts?.sourceVerified
      ? ["Academic Task 1 fact layer was not source-verified; factual accuracy needs confirmation."]
      : []),
    ...(Boolean(input.signals.possibleNonEnglishResponse) ? ["The response may not contain enough English for stable automated scoring."] : []),
    ...(Boolean(input.signals.possiblePromptInjection) ? ["The response contains prompt-like instructions that were ignored."] : [])
  ])];
  const needsHumanReview = finalReport.needsHumanReview || humanReviewReasons.length > 0;

  const result = {
    ok: true,
    system: "unified-native-scoring-v6.5-next",
    architecture: "two-independent-examiners-conditional-adjudication",
    rubricVersion: taskConfig.rubricVersion,
    examModule: taskConfig.examModule,
    moduleLabel: taskConfig.moduleLabel,
    task: taskConfig.task,
    taskNumber: taskConfig.taskNumber,
    taskKind: taskConfig.taskKind,
    wordCount: input.signals.wordCount,
    minimumWords: taskConfig.minimumWords,
    underMinimum: input.signals.underMinimum,
    overallBand: finalReport.overallBand,
    rawAverage: finalReport.rawAverage,
    finalCriteria: finalReport.criteria,
    criteria: finalReport.criteria,
    criteriaDetails: finalReport.criterionDetails,
    criterionCalibration: finalReport.criterionDetails,
    overallAssessment: finalReport.overallAssessment,
    overallAssessmentZh: finalReport.overallAssessmentZh,
    revisionSequence: finalReport.revisionSequence,
    revisionSequenceZh: finalReport.revisionSequenceZh,
    confidence: confidenceLabel(finalReport.confidence),
    confidenceScore: finalReport.confidence,
    needsHumanReview,
    humanReviewReasons,
    examinerPanel: [publicExaminerSummary(examinerA), publicExaminerSummary(examinerB)],
    agreement,
    adjudication,
    audit: {
      examinerA: examinerAResult.call.audit,
      examinerB: examinerBResult.call.audit,
      finalCall: finalCallAudit,
      feedbackRepair: feedbackRepairAudit,
      elapsedMs: Date.now() - startedAt
    },
    signals: input.signals,
    visualFactsStatus: taskConfig.taskKind === "academic_visual_report"
      ? {
          available: Boolean(input.signals.visualFactsAvailable),
          sourceVerified: Boolean(input.signals.visualFactsSourceVerified),
          visualType: input.visualFacts?.visualType || "unknown"
        }
      : null,
    scoreUnaffectedByLocalRules: true,
    disclaimerZh: "AI 估分用于学习参考，不等于 IELTS 官方成绩。"
  };
  reportStage("completed", { overallBand: result.overallBand });
  return result;
}
