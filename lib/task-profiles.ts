import type { TaskProfile, TaskProfileId } from "../types/writing.ts";

export const TASK_PROFILES: Readonly<Record<TaskProfileId, TaskProfile>> = Object.freeze({
  academic_task1: {
    id: "academic_task1",
    examModule: "academic",
    taskNumber: 1,
    taskKind: "academic_visual_report",
    label: "Academic Task 1",
    title: "A 类小作文",
    description: "图表、表格、地图或流程图",
    minimumWords: 150,
    minutes: 20,
    accent: "A1"
  },
  academic_task2: {
    id: "academic_task2",
    examModule: "academic",
    taskNumber: 2,
    taskKind: "essay",
    label: "Academic Task 2",
    title: "A 类大作文",
    description: "学术类议论文",
    minimumWords: 250,
    minutes: 40,
    accent: "A2"
  },
  general_task1: {
    id: "general_task1",
    examModule: "general_training",
    taskNumber: 1,
    taskKind: "gt_letter",
    label: "General Training Task 1",
    title: "G 类书信",
    description: "正式、半正式或非正式书信",
    minimumWords: 150,
    minutes: 20,
    accent: "G1"
  },
  general_task2: {
    id: "general_task2",
    examModule: "general_training",
    taskNumber: 2,
    taskKind: "essay",
    label: "General Training Task 2",
    title: "G 类大作文",
    description: "培训类议论文",
    minimumWords: 250,
    minutes: 40,
    accent: "G2"
  }
});

export function getTaskProfile(id: TaskProfileId): TaskProfile {
  const profile = TASK_PROFILES[id];
  if (!profile) throw new Error(`Unknown task profile: ${id}`);
  return profile;
}

export function isTaskProfileId(value: unknown): value is TaskProfileId {
  return typeof value === "string" && value in TASK_PROFILES;
}
