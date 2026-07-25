import test from "node:test";
import assert from "node:assert/strict";
import { createSession, buildScoringPayload, countWords } from "../js/session.js";

test("creates all four task profiles", () => {
  for (const id of ["academic_task1","academic_task2","general_task1","general_task2"]) {
    const session=createSession(id);
    assert.equal(session.profileId,id);
    assert.ok(session.timer.durationSeconds>0);
  }
});

test("builds Academic Task 1 payload with visual facts", () => {
  const session=createSession("academic_task1");
  session.prompt.text="The chart below shows changes.";
  session.prompt.visualFacts={visualType:"line_chart",referenceDescription:"A rose while B fell.",keyFeatures:["A rose"],sourceVerified:true,verificationNote:"user confirmed"};
  session.writing.essay="Overall, A increased while B declined. The main figures changed over time.";
  const payload=buildScoringPayload(session);
  assert.equal(payload.examModule,"academic");
  assert.equal(payload.taskNumber,1);
  assert.equal(payload.taskKind,"academic_visual_report");
  assert.equal(payload.visualFacts.sourceVerified,true);
});

test("builds GT letter payload", () => {
  const session=createSession("general_task1");
  session.prompt.text="Write a letter to your manager.";
  session.prompt.letterStyle="formal";
  session.writing.essay="Dear Sir or Madam, I am writing to request a change. Yours faithfully, Alex";
  const payload=buildScoringPayload(session);
  assert.equal(payload.examModule,"general_training");
  assert.equal(payload.taskKind,"gt_letter");
  assert.equal(payload.letterStyle,"formal");
});

test("counts contractions and hyphenated words as one token", () => {
  assert.equal(countWords("I can't use a well-known phrase."),6);
});
