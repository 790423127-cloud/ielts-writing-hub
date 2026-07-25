import { validateAndNormalizeInput } from "../scoring/input.ts";
import { resolveTaskConfig } from "../scoring/tasks.ts";

export function learningContext(body: Record<string, any>) {
  const taskConfig = resolveTaskConfig(body);
  const input = validateAndNormalizeInput(body, taskConfig);
  const currentResult = body.currentResult && typeof body.currentResult === "object" ? body.currentResult : {};
  const frozenCriteria = currentResult.finalCriteria || currentResult.criteria || body.frozenScore?.finalCriteria || {};
  const overallBand = Number(currentResult.overallBand ?? body.frozenScore?.overallBand);
  return {
    taskConfig,
    input,
    currentResult,
    frozenCriteria,
    overallBand: Number.isFinite(overallBand) ? overallBand : null,
    contextText: [
      `Exam module: ${taskConfig.moduleLabel}`,
      `Task: ${taskConfig.task}`,
      `Task kind: ${taskConfig.taskKind}`,
      `Frozen overall band: ${Number.isFinite(overallBand) ? overallBand : "not supplied"}`,
      `Frozen criteria: ${JSON.stringify(frozenCriteria)}`,
      `Question type: ${input.questionType || "not supplied"}`,
      `Letter style: ${input.letterStyle || "not supplied"}`,
      `Task-specific rules:\n- ${taskConfig.instructions.join("\n- ")}`,
      `Visual facts: ${input.visualFacts ? JSON.stringify(input.visualFacts, null, 2) : "not applicable"}`,
      `Question prompt:\n${input.prompt}`,
      `Learner response:\n${input.essay}`
    ].join("\n\n")
  };
}

export function targetBand(current: number | null, delta: number, fallback = 7): number {
  const base = current == null ? fallback : current;
  return Math.max(4, Math.min(9, Math.round((base + delta) * 2) / 2));
}
