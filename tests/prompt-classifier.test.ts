import assert from "node:assert/strict";
import test from "node:test";
import { classifyPrompt, detectConflict } from "../lib/prompt-classifier.ts";

test("detects general training letter", () => {
  const result = classifyPrompt("Write a letter to your manager. In your letter:\n- explain the problem\n- suggest a solution");
  assert.equal(result.profileId, "general_task1");
  assert.equal(result.taskNumber, 1);
});

test("detects academic visual task", () => {
  const result = classifyPrompt("The chart below shows population changes. Summarise the information by selecting and reporting the main features.");
  assert.equal(result.profileId, "academic_task1");
});

test("task 2 stays module-ambiguous", () => {
  const result = classifyPrompt("Discuss both views and give your own opinion.");
  assert.equal(result.profileId, "task2_ambiguous");
});

test("conflict suggests academic task 1", () => {
  const detection = classifyPrompt("The graph below shows sales. Summarise the information and report the main features.");
  const conflict = detectConflict("general_task1", detection);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.suggestedProfileId, "academic_task1");
});
