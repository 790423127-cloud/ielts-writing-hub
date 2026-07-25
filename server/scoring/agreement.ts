import type { NormalizedReport } from "./normalize.ts";
import type { TaskConfig } from "./tasks.ts";

export interface AgreementAudit {
  adjudicationRequired: boolean;
  reasons: string[];
  overallDifference: number;
  criterionDifferences: Record<string, number>;
  stable: boolean;
}

export function auditAgreement(a: NormalizedReport, b: NormalizedReport, taskConfig: TaskConfig): AgreementAudit {
  const reasons: string[] = [];
  const criterionDifferences: Record<string, number> = {};
  for (const criterion of taskConfig.criteria) {
    const difference = Math.abs(Number(a.criteria[criterion]) - Number(b.criteria[criterion]));
    criterionDifferences[criterion] = difference;
    if (difference >= 1) reasons.push(`${criterion.toUpperCase().replace(/\s+/g, "_")}_DIFF_${difference}`);
  }
  const overallDifference = Math.abs(a.overallBand - b.overallBand);
  if (overallDifference >= 1) reasons.push(`OVERALL_DIFF_${overallDifference}`);
  if (a.rateable !== b.rateable) reasons.push("RATEABILITY_DISAGREEMENT");
  if (a.needsHumanReview !== b.needsHumanReview) reasons.push("HUMAN_REVIEW_DISAGREEMENT");
  if (a.nonDescriptorUpperBandClaims.length || b.nonDescriptorUpperBandClaims.length) reasons.push("NON_DESCRIPTOR_UPPER_BAND_CLAIM");
  if (!a.fullRangeCeilingAuditComplete || !b.fullRangeCeilingAuditComplete) reasons.push("INCOMPLETE_CEILING_AUDIT");
  if ((a.uniformCriteria && !a.contrastComplete) || (b.uniformCriteria && !b.contrastComplete)) reasons.push("UNJUSTIFIED_UNIFORM_PROFILE");
  const adjudicationRequired = reasons.length > 0;
  return {
    adjudicationRequired,
    reasons: [...new Set(reasons)],
    overallDifference,
    criterionDifferences,
    stable: !adjudicationRequired
  };
}

export function selectStableReport(a: NormalizedReport, b: NormalizedReport): { selected: NormalizedReport; reason: string } {
  const quality = (report: NormalizedReport) =>
    report.confidence * 10 +
    (report.feedbackComplete ? 3 : 0) +
    (report.evidenceComplete ? 2 : 0) +
    (report.contrastComplete ? 1 : 0) -
    report.uncertaintyReasons.length * 0.25;
  return quality(a) >= quality(b)
    ? { selected: a, reason: "EXAMINER_A_HIGHER_REPORT_QUALITY" }
    : { selected: b, reason: "EXAMINER_B_HIGHER_REPORT_QUALITY" };
}
