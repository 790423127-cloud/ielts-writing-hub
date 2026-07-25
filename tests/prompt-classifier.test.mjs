import test from "node:test";
import assert from "node:assert/strict";
import { classifyPrompt, detectConflict } from "../js/prompt-classifier.js";

test("detects GT Task 1 letter", () => {
  const result = classifyPrompt("Write a letter to your manager. In your letter, explain the problem and request a change.");
  assert.equal(result.profileId, "general_task1");
  assert.equal(result.taskNumber, 1);
});

test("detects Academic Task 1 visual", () => {
  const result = classifyPrompt("The chart below shows household spending. Summarise the information by selecting and reporting the main features.");
  assert.equal(result.profileId, "academic_task1");
});

test("keeps Task 2 module ambiguous", () => {
  const result = classifyPrompt("Some people think public transport should be free. To what extent do you agree or disagree?");
  assert.equal(result.profileId, "task2_ambiguous");
  assert.equal(result.taskNumber, 2);
});

test("reports conflict between visual prompt and GT letter selection", () => {
  const detection = classifyPrompt("The graph below shows changes. Summarise the information and make comparisons.");
  const conflict = detectConflict("general_task1", detection);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.suggestedProfileId, "academic_task1");
});
