"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { TASK_PROFILES } from "@/lib/task-profiles.ts";
import {
  addExpression,
  clearExpressions,
  expressionsToMarkdown,
  loadExpressions,
  removeExpression
} from "@/lib/expression-library.ts";
import type { SavedExpression, TaskProfileId } from "@/types/writing.ts";

interface ExpressionLibraryProps {
  onClose: () => void;
}

export function ExpressionLibrary({ onClose }: ExpressionLibraryProps) {
  const [items, setItems] = useState<SavedExpression[]>([]);
  const [query, setQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState<TaskProfileId | "all">("all");
  const [expression, setExpression] = useState("");
  const [meaningZh, setMeaningZh] = useState("");
  const [usageNote, setUsageNote] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [profileId, setProfileId] = useState<TaskProfileId | "">("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => setItems(loadExpressions()), []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (profileFilter !== "all" && item.profileId !== profileFilter) return false;
      if (!needle) return true;
      return [item.expression, item.meaningZh, item.usageNote, item.sourceTitle, item.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, profileFilter, query]);

  const submit = () => {
    try {
      const next = addExpression({ expression, meaningZh, usageNote, sourceTitle, profileId, tags });
      setItems(next);
      setExpression("");
      setMeaningZh("");
      setUsageNote("");
      setSourceTitle("");
      setTags("");
      setMessage("已保存到当前浏览器。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const exportMarkdown = () => {
    const blob = new Blob([expressionsToMarkdown(items)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ielts-expressions-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page feature-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">表达收藏</span>
          <h2>建立自己的 IELTS 写作表达库</h2>
          <p>保存可复用的短语、句型和用法说明。内容只保存在当前浏览器。</p>
        </div>
        <button className="secondary" type="button" onClick={onClose}>返回首页</button>
      </div>

      <div className="feature-layout">
        <section className="panel expression-form">
          <h3>添加表达</h3>
          <label>
            英文表达
            <textarea value={expression} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setExpression(event.target.value)} placeholder="例如：This can be attributed to..." />
          </label>
          <label>
            中文意思
            <textarea value={meaningZh} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMeaningZh(event.target.value)} placeholder="这个现象可以归因于……" />
          </label>
          <label>
            使用说明
            <textarea value={usageNote} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setUsageNote(event.target.value)} placeholder="适合解释原因，不要用于没有因果关系的句子。" />
          </label>
          <div className="two-fields">
            <label>
              来源
              <input value={sourceTitle} onChange={(event: ChangeEvent<HTMLInputElement>) => setSourceTitle(event.target.value)} placeholder="某次作文或老师反馈" />
            </label>
            <label>
              适用任务
              <select value={profileId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setProfileId(event.target.value as TaskProfileId | "")}>
                <option value="">通用</option>
                {Object.values(TASK_PROFILES).map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.title}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            标签（逗号分隔）
            <input value={tags} onChange={(event: ChangeEvent<HTMLInputElement>) => setTags(event.target.value)} placeholder="原因, Task 2, 衔接" />
          </label>
          <button className="primary" type="button" onClick={submit}>保存表达</button>
          {message && <p className="muted">{message}</p>}
        </section>

        <section className="panel expression-list-panel">
          <div className="panel-heading">
            <div>
              <h3>已收藏 {items.length} 条</h3>
              <p className="muted">可以搜索、筛选、复制或导出 Markdown。</p>
            </div>
            <div className="compact-actions">
              <button className="secondary small" type="button" disabled={!items.length} onClick={exportMarkdown}>导出</button>
              <button
                className="secondary small danger-link"
                type="button"
                disabled={!items.length}
                onClick={() => {
                  if (!window.confirm("确定清空全部表达收藏吗？")) return;
                  clearExpressions();
                  setItems([]);
                }}
              >
                清空
              </button>
            </div>
          </div>

          <div className="expression-filters">
            <input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="搜索表达、中文、标签或来源" />
            <select value={profileFilter} onChange={(event: ChangeEvent<HTMLSelectElement>) => setProfileFilter(event.target.value as TaskProfileId | "all")}>
              <option value="all">全部任务</option>
              {Object.values(TASK_PROFILES).map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.title}</option>
              ))}
            </select>
          </div>

          <div className="expression-list">
            {filtered.length === 0 ? (
              <div className="empty-state">还没有符合条件的表达。</div>
            ) : filtered.map((item) => (
              <article className="expression-card" key={item.id}>
                <div className="expression-card-heading">
                  <strong>{item.expression}</strong>
                  <div className="compact-actions">
                    <button className="text-button" type="button" onClick={() => navigator.clipboard.writeText(item.expression)}>复制</button>
                    <button className="text-button danger-link" type="button" onClick={() => setItems(removeExpression(item.id))}>删除</button>
                  </div>
                </div>
                {item.meaningZh && <p>{item.meaningZh}</p>}
                {item.usageNote && <small>{item.usageNote}</small>}
                <div className="tag-row">
                  {item.profileId && <span>{TASK_PROFILES[item.profileId]?.title || item.profileId}</span>}
                  {item.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                  {item.sourceTitle && <span>来源：{item.sourceTitle}</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
