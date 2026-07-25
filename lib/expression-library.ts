"use client";

import type { SavedExpression, TaskProfileId } from "../types/writing.ts";
import { createId } from "./session.ts";

const STORAGE_KEY = "ielts-writing-studio:v3:expressions";

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cleanTags(value: string[] | string): string[] {
  const raw = Array.isArray(value) ? value : value.split(/[,，]/);
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))].slice(0, 8);
}

export function normalizeExpressionInput(input: {
  expression: string;
  meaningZh?: string;
  usageNote?: string;
  sourceTitle?: string;
  profileId?: TaskProfileId | "";
  tags?: string[] | string;
}): Omit<SavedExpression, "id" | "createdAt"> {
  return {
    expression: String(input.expression || "").trim().slice(0, 1200),
    meaningZh: String(input.meaningZh || "").trim().slice(0, 1200),
    usageNote: String(input.usageNote || "").trim().slice(0, 1600),
    sourceTitle: String(input.sourceTitle || "").trim().slice(0, 300),
    profileId: input.profileId || "",
    tags: cleanTags(input.tags || [])
  };
}

function normalizeSavedExpression(raw: unknown): SavedExpression | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Partial<SavedExpression>;
  const normalized = normalizeExpressionInput({
    expression: source.expression || "",
    meaningZh: source.meaningZh,
    usageNote: source.usageNote,
    sourceTitle: source.sourceTitle,
    profileId: source.profileId,
    tags: source.tags || []
  });
  if (!normalized.expression) return null;
  return {
    id: String(source.id || createId()),
    createdAt: String(source.createdAt || new Date().toISOString()),
    ...normalized
  };
}

export function loadExpressions(): SavedExpression[] {
  if (!hasStorage()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as unknown[];
    return Array.isArray(raw)
      ? raw.map(normalizeSavedExpression).filter((item): item is SavedExpression => item !== null)
      : [];
  } catch {
    return [];
  }
}

export function saveExpressions(items: SavedExpression[]): SavedExpression[] {
  const next = items.slice(0, 300);
  if (hasStorage()) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function addExpression(input: {
  expression: string;
  meaningZh?: string;
  usageNote?: string;
  sourceTitle?: string;
  profileId?: TaskProfileId | "";
  tags?: string[] | string;
}): SavedExpression[] {
  const normalized = normalizeExpressionInput(input);
  if (!normalized.expression) throw new Error("请先输入要收藏的表达。");
  const existing = loadExpressions();
  const duplicateIndex = existing.findIndex(
    (item) => item.expression.toLowerCase() === normalized.expression.toLowerCase()
  );
  const entry: SavedExpression = {
    id: duplicateIndex >= 0 ? existing[duplicateIndex].id : createId(),
    createdAt: duplicateIndex >= 0 ? existing[duplicateIndex].createdAt : new Date().toISOString(),
    ...normalized
  };
  const next = duplicateIndex >= 0
    ? [entry, ...existing.filter((_, index) => index !== duplicateIndex)]
    : [entry, ...existing];
  return saveExpressions(next);
}

export function removeExpression(id: string): SavedExpression[] {
  return saveExpressions(loadExpressions().filter((item) => item.id !== id));
}

export function clearExpressions(): void {
  if (hasStorage()) localStorage.removeItem(STORAGE_KEY);
}

export function expressionsToMarkdown(items: SavedExpression[]): string {
  const lines = ["# IELTS Writing 表达收藏", ""];
  for (const item of items) {
    lines.push(`## ${item.expression}`);
    if (item.meaningZh) lines.push(`- 中文：${item.meaningZh}`);
    if (item.usageNote) lines.push(`- 用法：${item.usageNote}`);
    if (item.sourceTitle) lines.push(`- 来源：${item.sourceTitle}`);
    if (item.profileId) lines.push(`- 任务：${item.profileId}`);
    if (item.tags.length) lines.push(`- 标签：${item.tags.join("、")}`);
    lines.push("");
  }
  return lines.join("\n");
}
