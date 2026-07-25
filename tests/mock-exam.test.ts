import assert from "node:assert/strict";
import test from "node:test";
import { calculateWeightedWritingBand, profileIdsForModule } from "../lib/mock-exam-storage.ts";

test("mock exam uses matching A/G task profiles", () => {
  assert.deepEqual(profileIdsForModule("academic"), {
    task1: "academic_task1",
    task2: "academic_task2"
  });
  assert.deepEqual(profileIdsForModule("general_training"), {
    task1: "general_task1",
    task2: "general_task2"
  });
});

test("Task 2 receives double weighting in mock estimate", () => {
  assert.equal(calculateWeightedWritingBand(6, 7), 6.5);
  assert.equal(calculateWeightedWritingBand({ overallBand: 5.5 }, { overallBand: 6.5 }), 6);
  assert.equal(calculateWeightedWritingBand(null, 6.5), null);
});
