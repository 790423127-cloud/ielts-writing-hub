"use client";

import { ensureSessionShape } from "./session.ts";
import type { HistoryStats, WritingSession } from "../types/writing.ts";

const PREFIX = "ielts-writing-studio:v3";
const LEGACY_PREFIXES = ["ielts-writing-studio:v2", "ielts-writing-studio:v1"];
const CURRENT_KEY = `${PREFIX}:current`;
const HISTORY_KEY = `${PREFIX}:history`;
const THEME_KEY = `${PREFIX}:theme`;

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function migrateLegacy(suffix: string): string | null {
  if (!hasStorage()) return null;
  const current = localStorage.getItem(`${PREFIX}:${suffix}`);
  if (current !== null) return current;

  for (const legacyPrefix of LEGACY_PREFIXES) {
    const legacy = localStorage.getItem(`${legacyPrefix}:${suffix}`);
    if (legacy !== null) {
      localStorage.setItem(`${PREFIX}:${suffix}`, legacy);
      return legacy;
    }
  }
  return null;
}

export function saveCurrent(session: WritingSession): void {
  if (!hasStorage()) return;
  localStorage.setItem(CURRENT_KEY, JSON.stringify(session));
}

export function loadCurrent(): WritingSession | null {
  if (!hasStorage()) return null;
  try {
    return ensureSessionShape(JSON.parse(migrateLegacy("current") ?? "null"));
  } catch {
    return null;
  }
}

function compactForHistory(session: WritingSession): WritingSession {
  return {
    ...session,
    prompt: {
      ...session.prompt,
      imageDataUrl: ""
    },
    timer: {
      ...session.timer,
      running: false
    }
  };
}

export function saveToHistory(session: WritingSession): WritingSession[] {
  if (!hasStorage()) return [];
  const history = loadHistory().filter((item) => item.id !== session.id);
  const next = [compactForHistory(session), ...history].slice(0, 30);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function loadHistory(): WritingSession[] {
  if (!hasStorage()) return [];
  try {
    const raw = JSON.parse(migrateLegacy("history") ?? "[]") as unknown[];
    return Array.isArray(raw)
      ? raw.map(ensureSessionShape).filter((item): item is WritingSession => item !== null)
      : [];
  } catch {
    return [];
  }
}

export function removeHistory(id: string): WritingSession[] {
  if (!hasStorage()) return [];
  const next = loadHistory().filter((item) => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearAllData(): void {
  if (!hasStorage()) return;
  const prefixes = [PREFIX, ...LEGACY_PREFIXES];
  Object.keys(localStorage)
    .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
    .forEach((key) => localStorage.removeItem(key));
}

export function saveTheme(theme: "light" | "dark"): void {
  if (hasStorage()) localStorage.setItem(THEME_KEY, theme);
}

export function loadTheme(): "light" | "dark" {
  if (!hasStorage()) return "light";
  return migrateLegacy("theme") === "dark" ? "dark" : "light";
}

export function calculateHistoryStats(history: WritingSession[]): HistoryStats {
  const scored = history.filter((item) => Number.isFinite(Number(item.grading.result?.overallBand)));
  if (scored.length === 0) {
    return { total: 0, average: null, best: null, weakestCriterion: "暂无数据" };
  }

  const bands = scored.map((item) => Number(item.grading.result?.overallBand));
  const criterionTotals: Record<string, number> = {};
  const criterionCounts: Record<string, number> = {};

  for (const item of scored) {
    const criteria = item.grading.result?.finalCriteria ?? item.grading.result?.criteria ?? {};
    for (const [name, value] of Object.entries(criteria)) {
      criterionTotals[name] = (criterionTotals[name] ?? 0) + Number(value || 0);
      criterionCounts[name] = (criterionCounts[name] ?? 0) + 1;
    }
  }

  const weakestCriterion =
    Object.entries(criterionTotals)
      .map(([name, total]) => [name, total / criterionCounts[name]] as const)
      .sort((a, b) => a[1] - b[1])[0]?.[0] ?? "暂无数据";

  return {
    total: scored.length,
    average: bands.reduce((sum, value) => sum + value, 0) / bands.length,
    best: Math.max(...bands),
    weakestCriterion
  };
}
