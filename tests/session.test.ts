import assert from "node:assert/strict";
import test from "node:test";
import { buildScoringPayload, countWords, createSession, ensureSessionShape } from "../lib/session.ts";

test("countWords handles apostrophes and hyphens", () => {
  assert.equal(countWords("It's a well-written answer."), 4);
});

test("academic task 1 payload includes visual facts", () => {
  const session = createSession("academic_task1");
  session.prompt.text = "The chart below shows changes.";
  session.prompt.visualFacts.referenceDescription = "A rose while B fell.";
  session.prompt.visualFacts.sourceVerified = true;
  session.writing.essay = "Overall, A increased while B declined.";
  const payload = buildScoringPayload(session);
  assert.equal(payload.examModule, "academic");
  assert.equal(payload.taskKind, "academic_visual_report");
  assert.deepEqual(payload.visualFacts, {
    visualType: "unknown",
    referenceDescription: "A rose while B fell.",
    keyFeatures: [],
    sourceVerified: true,
    verificationNote: ""
  });
});

test("legacy session is upgraded to schema version 3", () => {
  const raw = createSession("general_task1");
  const upgraded = ensureSessionShape({ ...raw, schemaVersion: 1 });
  assert.equal(upgraded?.schemaVersion, 3);
  assert.equal(upgraded?.timer.running, false);
});
