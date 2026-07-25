"use client";

import { TASK_PROFILES } from "@/lib/task-profiles.ts";
import type { WritingSession } from "@/types/writing.ts";

interface SidebarProps {
  history: WritingSession[];
  theme: "light" | "dark";
  onNew: () => void;
  onContinue: () => void;
  onOpenHistory: (session: WritingSession) => void;
  onRemoveHistory: (id: string) => void;
  onToggleTheme: () => void;
  onClearData: () => void;
}

export function Sidebar({
  history,
  theme,
  onNew,
  onContinue,
  onOpenHistory,
  onRemoveHistory,
  onToggleTheme,
  onClearData
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span>W</span>
        <div>
          <strong>Writing Studio</strong>
          <small>Academic · General</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button type="button" onClick={onNew}>新建练习</button>
        <button type="button" onClick={onContinue}>继续写作</button>
      </nav>

      <section className="sidebar-section">
        <h3>最近练习</h3>
        <div className="history-list">
          {history.length === 0 ? (
            <p className="muted">还没有已完成的练习。</p>
          ) : (
            history.map((item) => {
              const profile = TASK_PROFILES[item.profileId];
              const score = item.grading.result?.overallBand;
              return (
                <article className="history-item" key={item.id}>
                  <button className="history-open" type="button" onClick={() => onOpenHistory(item)}>
                    <strong>{item.prompt.title || profile.title}</strong>
                    <span>{profile.label}</span>
                    <small>
                      {Number.isFinite(Number(score))
                        ? `Band ${Number(score).toFixed(1)}`
                        : `${item.writing.wordCount} words`}
                    </small>
                  </button>
                  <button
                    className="history-remove"
                    type="button"
                    aria-label="删除该记录"
                    onClick={() => onRemoveHistory(item.id)}
                  >
                    ×
                  </button>
                </article>
              );
            })
          )}
        </div>
      </section>

      <div className="sidebar-footer">
        <button type="button" onClick={onToggleTheme}>{theme === "dark" ? "浅色" : "深色"}</button>
        <button type="button" className="danger-link" onClick={onClearData}>删除本地数据</button>
        <p>独立学习工具，不提供公共题库。</p>
      </div>
    </aside>
  );
}
