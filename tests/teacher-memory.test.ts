import assert from "node:assert/strict";
import test from "node:test";
import { memoryBucketForProfile } from "../lib/teacher-memory.ts";

test("teacher memory separates A/G task buckets", () => {
  assert.equal(memoryBucketForProfile("academic_task1"), "academicTask1");
  assert.equal(memoryBucketForProfile("general_task1"), "generalTask1");
  assert.equal(memoryBucketForProfile("academic_task2"), "academicTask2");
  assert.equal(memoryBucketForProfile("general_task2"), "generalTask2");
});

test("shared language scope overrides task bucket", () => {
  assert.equal(memoryBucketForProfile("academic_task1", "sharedLanguage"), "sharedLanguage");
});
