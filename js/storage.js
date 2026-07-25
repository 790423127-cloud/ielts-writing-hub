const PREFIX = "ielts-writing-studio:v1";
const CURRENT_KEY = `${PREFIX}:current`;
const HISTORY_KEY = `${PREFIX}:history`;
const THEME_KEY = `${PREFIX}:theme`;

export function saveCurrent(session) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(session));
}

export function loadCurrent() {
  try { return JSON.parse(localStorage.getItem(CURRENT_KEY) || "null"); }
  catch { return null; }
}

export function saveToHistory(session) {
  const history = loadHistory().filter((item) => item.id !== session.id);
  history.unshift(session);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

export function removeHistory(id) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(loadHistory().filter((item) => item.id !== id)));
}

export function clearAllData() {
  Object.keys(localStorage).filter((key) => key.startsWith(PREFIX)).forEach((key) => localStorage.removeItem(key));
}

export function saveTheme(theme) { localStorage.setItem(THEME_KEY, theme); }
export function loadTheme() { return localStorage.getItem(THEME_KEY) || "light"; }
