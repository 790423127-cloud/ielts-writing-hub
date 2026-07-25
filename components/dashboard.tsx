"use client";

import { TASK_PROFILES } from "@/lib/task-profiles.ts";
import type { HistoryStats, TaskProfileId } from "@/types/writing.ts";

const CRITERION_LABELS: Record<string, string> = {
  "Task Achievement": "任务完成度",
  "Task Response": "任务回应",
  "Coherence and Cohesion": "连贯与衔接",
  "Lexical Resource": "词汇资源",
  "Grammatical Range and Accuracy": "语法多样性与准确性"
};

interface DashboardProps {
  stats: HistoryStats;
  onSelect: (profileId: TaskProfileId) => void;
  onOpenLatest: () => void;
  onOpenMockExam: () => void;
  onOpenExpressions: () => void;
}

export function Dashboard({
  stats,
  onSelect,
  onOpenLatest,
  onOpenMockExam,
  onOpenExpressions
}: DashboardProps) {
  return (
    <section className="page">
      <div className="hero">
        <div>
          <span className="eyebrow">第一步</span>
          <h2>选择考试类型和写作任务</h2>
          <p>你的选择决定评分路线；系统会再次检查题目特征，但不会偷偷覆盖你的选择。</p>
        </div>
        <div className="privacy-card">
          <strong>私密输入</strong>
          <p>题目、草稿和历史记录默认保存在当前浏览器。网站不提供公共题库。</p>
        </div>
      </div>

      <div className="stats-grid">
        <article><span>已评分</span><strong>{stats.total}</strong></article>
        <article><span>平均分</span><strong>{stats.average === null ? "—" : stats.average.toFixed(1)}</strong></article>
        <article><span>最高分</span><strong>{stats.best === null ? "—" : stats.best.toFixed(1)}</strong></article>
        <article><span>最弱项</span><strong className="small-stat">{CRITERION_LABELS[stats.weakestCriterion] || stats.weakestCriterion}</strong></article>
      </div>

      <div className="profile-grid">
        {Object.values(TASK_PROFILES).map((profile) => (
          <button
            key={profile.id}
            className="profile-card"
            type="button"
            onClick={() => onSelect(profile.id)}
          >
            <span className="profile-code">{profile.accent}</span>
            <strong>{profile.title}</strong>
            <small>{profile.description}</small>
            <em>{profile.minutes} 分钟 · 至少 {profile.minimumWords} 词</em>
          </button>
        ))}
      </div>

      <div className="tool-grid">
        <button className="tool-card" type="button" onClick={onOpenMockExam}>
          <span>60</span>
          <div>
            <strong>模拟考试</strong>
            <small>自行粘贴 Task 1 和 Task 2，完成 60 分钟全套练习。</small>
          </div>
        </button>
        <button className="tool-card" type="button" onClick={onOpenExpressions}>
          <span>☆</span>
          <div>
            <strong>表达收藏</strong>
            <small>保存自己的短语、句型、中文解释和使用场景。</small>
          </div>
        </button>
      </div>

      <div className="dashboard-actions">
        <button className="secondary" type="button" onClick={onOpenLatest}>打开最近报告</button>
      </div>

      <section className="notice">
        <strong>使用提示</strong>
        <p>
          请仅提交你有权使用的材料。Academic Task 1 的图片只在浏览器本地预览；
          评分核对依据你填写并确认的事实摘要。
        </p>
      </section>
    </section>
  );
}
