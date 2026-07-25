import assert from "node:assert/strict";
import test from "node:test";
import { expressionsToMarkdown, normalizeExpressionInput } from "../lib/expression-library.ts";

test("expression input is trimmed and tags are deduplicated", () => {
  const result = normalizeExpressionInput({
    expression: "  in contrast to  ",
    meaningZh: "  与……相比  ",
    tags: "Task 2, 对比, Task 2"
  });
  assert.equal(result.expression, "in contrast to");
  assert.equal(result.meaningZh, "与……相比");
  assert.deepEqual(result.tags, ["Task 2", "对比"]);
});

test("expression export creates readable markdown", () => {
  const markdown = expressionsToMarkdown([{
    id: "1",
    expression: "in contrast to",
    meaningZh: "与……相比",
    usageNote: "用于对比",
    sourceTitle: "Task 2 practice",
    profileId: "academic_task2",
    tags: ["对比"],
    createdAt: "2026-07-26T00:00:00.000Z"
  }]);
  assert.match(markdown, /# IELTS Writing 表达收藏/);
  assert.match(markdown, /## in contrast to/);
  assert.match(markdown, /与……相比/);
});
