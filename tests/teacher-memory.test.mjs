import test from "node:test";
import assert from "node:assert/strict";
import { memoryBucketForProfile } from "../js/teacher-memory.js";

test("separates A/G task memory buckets", () => {
  assert.equal(memoryBucketForProfile("academic_task1"), "academicTask1");
  assert.equal(memoryBucketForProfile("general_task1"), "generalTask1");
  assert.equal(memoryBucketForProfile("academic_task2"), "academicTask2");
  assert.equal(memoryBucketForProfile("general_task2"), "generalTask2");
});

test("routes shared language to shared bucket", () => {
  assert.equal(memoryBucketForProfile("academic_task1", "sharedLanguage"), "sharedLanguage");
});
