import { ensureSessionShape } from "./session.js";

const PREFIX = "ielts-writing-studio:v2";
const LEGACY_PREFIX = "ielts-writing-studio:v1";
const CURRENT_KEY = `${PREFIX}:current`;
const HISTORY_KEY = `${PREFIX}:history`;
const THEME_KEY = `${PREFIX}:theme`;

function migrateLegacy(keySuffix) {
  const current = localStorage.getItem(`${PREFIX}:${keySuffix}`);
  if (current != null) return current;
  const legacy = localStorage.getItem(`${LEGACY_PREFIX}:${keySuffix}`);
  if (legacy != null) localStorage.setItem(`${PREFIX}:${keySuffix}`, legacy);
  return legacy;
}

export function saveCurrent(session) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(session));
}

export function loadCurrent() {
  try { return ensureSessionShape(JSON.parse(migrateLegacy("current") || "null")); }
  catch { return null; }
}

function compactForHistory(session) {
  const copy = JSON.parse(JSON.stringify(session));
  if (copy.prompt) copy.prompt.imageDataUrl = "";
  return copy;
}

export function saveToHistory(session) {
  const history = loadHistory().filter((item) => item.id !== session.id);
  history.unshift(compactForHistory(session));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
}

export function loadHistory() {
  try {
    const raw = JSON.parse(migrateLegacy("history") || "[]");
    return Array.isArray(raw) ? raw.map(ensureSessionShape).filter(Boolean) : [];
  } catch { return []; }
}

export function removeHistory(id) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(loadHistory().filter((item) => item.id !== id)));
}

export function clearAllData() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(PREFIX) || key.startsWith(LEGACY_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
}

export function saveTheme(theme) { localStorage.setItem(THEME_KEY, theme); }
export function loadTheme() { return migrateLegacy("theme") || "light"; }

export function calculateHistoryStats() {
  const history = loadHistory().filter((item) => Number.isFinite(Number(item.grading?.result?.overallBand)));
  if (!history.length) return { total: 0, average: null, best: null, weakestCriterion: "暂无数据" };
  const bands = history.map((item) => Number(item.grading.result.overallBand));
  const criterionTotals = {};
  const criterionCounts = {};
  for (const item of history) {
    const criteria = item.grading.result.finalCriteria || item.grading.result.criteria || {};
    for (const [name, value] of Object.entries(criteria)) {
      criterionTotals[name] = (criterionTotals[name] || 0) + Number(value || 0);
      criterionCounts[name] = (criterionCounts[name] || 0) + 1;
    }
  }
  const averages = Object.entries(criterionTotals).map(([name, sum]) => [name, sum / criterionCounts[name]]).sort((a, b) => a[1] - b[1]);
  return {
    total: history.length,
    average: bands.reduce((sum, value) => sum + value, 0) / bands.length,
    best: Math.max(...bands),
    weakestCriterion: averages[0]?.[0] || "暂无数据"
  };
}
