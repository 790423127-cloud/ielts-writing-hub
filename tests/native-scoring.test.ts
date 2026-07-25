import test from "node:test";
import assert from "node:assert/strict";
import { auditAgreement } from "../server/scoring/agreement.ts";
import { validateAndNormalizeInput } from "../server/scoring/input.ts";
import { normalizeExaminerReport } from "../server/scoring/normalize.ts";
import { resolveTaskConfig } from "../server/scoring/tasks.ts";

function reportRaw(criteria: string[], band = 6.5) {
  return {
    rateable: true,
    criteria: Object.fromEntries(criteria.map((name) => [name, {
      band,
      diagnosis: "The criterion is generally controlled.",
      diagnosisZh: "该评分项总体控制较好。",
      bandBoundary: {
        fit: "The evidence fits this band.",
        fitZh: "原文证据符合该档。",
        nextBandGap: "Development is not fully sustained.",
        nextBandGapZh: "发展还不够持续。"
      },
      essayEvidence: [
        { quote: "clear position", explanation: "Relevant evidence", explanationZh: "相关证据" },
        { quote: "relevant example", explanation: "Relevant evidence", explanationZh: "相关证据" }
      ],
      nextRevision: {
        action: "Extend the explanation.", actionZh: "扩展解释。", beforeQuote: "relevant example",
        revisedExample: "It also gives a relevant example and explains its wider consequence.",
        whyItWorks: "It develops the idea.", whyItWorksZh: "它进一步发展了观点。"
      },
      ceilingAudit: {
        highestBandTested: 9, passed: false, reason: "Control is not sustained enough for Band 9.",
        band9PositiveEvidence: "", band9BlockingPattern: "Development is not consistently precise."
      },
      confidence: 0.8
    }])),
    criterionContrastAudit: {
      strongest: criteria[0], weakest: criteria[3], comparison: "The task criterion is stronger than grammar.", uniformProfileJustification: "All four show the same dominant level."
    },
    overallAssessment: "Generally effective.",
    overallAssessmentZh: "总体有效。",
    revisionSequence: ["Develop ideas"], revisionSequenceZh: ["发展观点"], confidence: 0.8
  };
}

const essay = "The response has a clear position. It also gives a relevant example and explains the consequence.";

test("resolves all four IELTS task profiles", () => {
  assert.equal(resolveTaskConfig({ examModule: "academic", taskNumber: 1, taskKind: "academic_visual_report" }).taskKind, "academic_visual_report");
  assert.equal(resolveTaskConfig({ examModule: "academic", taskNumber: 2, taskKind: "essay" }).firstCriterion, "Task Response");
  assert.equal(resolveTaskConfig({ examModule: "general_training", taskNumber: 1, taskKind: "gt_letter" }).taskKind, "gt_letter");
  assert.equal(resolveTaskConfig({ examModule: "general_training", taskNumber: 2, taskKind: "essay" }).minimumWords, 250);
});

test("normalizes Academic Task 1 fact layer without inventing verification", () => {
  const config = resolveTaskConfig({ examModule: "academic", taskNumber: 1, taskKind: "academic_visual_report" });
  const input = validateAndNormalizeInput({
    questionPrompt: "The chart shows changes.", essay: "Overall, the first category rose while the second fell over the period.",
    visualFacts: { visualType: "line_chart", keyFeatures: ["A rose"], sourceVerified: false }
  }, config);
  assert.equal(input.visualFacts?.visualType, "line_chart");
  assert.equal(input.visualFacts?.sourceVerified, false);
  assert.equal(input.signals.visualFactsAvailable, true);
});

test("normalizes four criterion reports and exact evidence", () => {
  const config = resolveTaskConfig({ examModule: "academic", taskNumber: 2, taskKind: "essay" });
  const input = validateAndNormalizeInput({ questionPrompt: "Discuss both views and give your opinion.", essay }, config);
  const report = normalizeExaminerReport(reportRaw(config.criteria), config, input, "A");
  assert.equal(report.overallBand, 6.5);
  assert.equal(report.evidenceComplete, true);
  assert.equal(report.fullRangeCeilingAuditComplete, true);
});

test("agreement audit triggers on one-band criterion disagreement", () => {
  const config = resolveTaskConfig({ examModule: "academic", taskNumber: 2, taskKind: "essay" });
  const input = validateAndNormalizeInput({ questionPrompt: "Discuss both views.", essay }, config);
  const a = normalizeExaminerReport(reportRaw(config.criteria, 6.5), config, input, "A");
  const bRaw = reportRaw(config.criteria, 6.5) as any;
  bRaw.criteria[config.criteria[0]].band = 5.5;
  const b = normalizeExaminerReport(bRaw, config, input, "B");
  const audit = auditAgreement(a, b, config);
  assert.equal(audit.adjudicationRequired, true);
  assert.ok(audit.reasons.some((reason) => reason.includes("DIFF_1")));
});
