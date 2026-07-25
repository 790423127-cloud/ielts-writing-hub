"use client";

import { getTaskProfile } from "@/lib/task-profiles.ts";
import type { LiveSuggestion, TaskProfileId, WritingSession } from "@/types/writing.ts";

interface WorkspaceProps {
  session: WritingSession;
  gradingMessage: string;
  onSessionChange: (updater: (current: WritingSession) => WritingSession) => void;
  onChangeTask: () => void;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onGrade: () => void;
  onQuickCheck: () => void;
  onApplySuggestion: (suggestion: LiveSuggestion) => void;
  onSwitchProfile: (profileId: TaskProfileId) => void;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function Workspace({
  session,
  gradingMessage,
  onSessionChange,
  onChangeTask,
  onToggleTimer,
  onResetTimer,
  onGrade,
  onQuickCheck,
  onApplySuggestion,
  onSwitchProfile
}: WorkspaceProps) {
  const profile = getTaskProfile(session.profileId);
  const detection = session.prompt.detection;
  const detectionConflict =
    detection?.profileId &&
    detection.profileId !== "task2_ambiguous" &&
    detection.profileId !== session.profileId;

  const updatePrompt = (patch: Partial<WritingSession["prompt"]>) =>
    onSessionChange((current) => ({
      ...current,
      prompt: { ...current.prompt, ...patch }
    }));

  const updateVisual = (patch: Partial<WritingSession["prompt"]["visualFacts"]>) =>
    onSessionChange((current) => ({
      ...current,
      prompt: {
        ...current.prompt,
        visualFacts: { ...current.prompt.visualFacts, ...patch }
      }
    }));

  const onImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("请选择图片文件。");
      return;
    }
    if (file.size > 2_000_000) {
      window.alert("图片请控制在 2MB 以内。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () =>
      updatePrompt({
        imageName: file.name,
        imageDataUrl: typeof reader.result === "string" ? reader.result : ""
      });
    reader.readAsDataURL(file);
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="badge">{profile.label}</span>
          <h2>{profile.title}</h2>
          <p>粘贴题目、完成写作，再提交统一评分。</p>
        </div>
        <button className="secondary" type="button" onClick={onChangeTask}>更换任务</button>
      </div>

      {detection && (
        <div className={`detection-banner ${detectionConflict ? "warning" : ""}`}>
          <div>
            <strong>{detectionConflict ? "题目类型可能与选择不一致" : "题目特征检查"}</strong>
            <p>{detection.evidence.join("；")}</p>
          </div>
          {detectionConflict && detection.profileId !== "task2_ambiguous" && (
            <button
              type="button"
              className="secondary small"
              onClick={() => onSwitchProfile(detection.profileId as TaskProfileId)}
            >
              切换到建议类型
            </button>
          )}
        </div>
      )}

      <div className="workspace-grid">
        <section className="editor-column">
          <article className="panel prompt-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">QUESTION</span><h3>题目与任务信息</h3></div>
              <span className="save-status">自动保存到本机</span>
            </div>

            <label>
              <span>自定义标题（可选）</span>
              <input
                value={session.prompt.title}
                onChange={(event) => updatePrompt({ title: event.target.value })}
                placeholder="例如：城市交通问题"
              />
            </label>

            <label>
              <span>作文题目</span>
              <textarea
                className="prompt-input"
                value={session.prompt.text}
                onChange={(event) => updatePrompt({ text: event.target.value })}
                placeholder="请粘贴完整作文题目"
              />
            </label>

            <div className="two-fields">
              <label>
                <span>题型（可选）</span>
                <input
                  value={session.prompt.questionType}
                  onChange={(event) => updatePrompt({ questionType: event.target.value })}
                  placeholder="例如 agree/disagree、bar chart"
                />
              </label>

              {session.profileId === "general_task1" && (
                <label>
                  <span>书信语气</span>
                  <select
                    value={session.prompt.letterStyle}
                    onChange={(event) => updatePrompt({ letterStyle: event.target.value })}
                  >
                    <option value="">自动判断</option>
                    <option value="formal">formal</option>
                    <option value="semi-formal">semi-formal</option>
                    <option value="informal">informal</option>
                  </select>
                </label>
              )}
            </div>
          </article>

          {session.profileId === "academic_task1" && (
            <article className="panel visual-panel">
              <div className="panel-heading">
                <div><span className="eyebrow">ACADEMIC VISUAL</span><h3>题图和事实层</h3></div>
              </div>

              <div className="visual-grid">
                <label className="upload-box">
                  <input type="file" accept="image/*" onChange={(event) => onImage(event.target.files?.[0])} />
                  <span>上传题图</span>
                  <small>仅在本机预览，不会通过评分请求上传</small>
                </label>

                <div className="image-stage">
                  {session.prompt.imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={session.prompt.imageDataUrl} alt="Academic Task 1 题图预览" />
                  ) : (
                    <p>尚未选择图片</p>
                  )}
                </div>
              </div>

              <div className="two-fields">
                <label>
                  <span>图表类型</span>
                  <select
                    value={session.prompt.visualFacts.visualType}
                    onChange={(event) => updateVisual({ visualType: event.target.value })}
                  >
                    <option value="unknown">请选择</option>
                    <option value="line_chart">折线图</option>
                    <option value="bar_chart">柱状图</option>
                    <option value="pie_chart">饼图</option>
                    <option value="table">表格</option>
                    <option value="map">地图</option>
                    <option value="process">流程图</option>
                    <option value="mixed">混合图</option>
                  </select>
                </label>

                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={session.prompt.visualFacts.sourceVerified}
                    onChange={(event) =>
                      updateVisual({
                        sourceVerified: event.target.checked,
                        verificationNote: event.target.checked ? "Confirmed by user" : ""
                      })
                    }
                  />
                  <span>我已核对事实摘要</span>
                </label>
              </div>

              <label>
                <span>图表事实摘要</span>
                <textarea
                  value={session.prompt.visualFacts.referenceDescription}
                  onChange={(event) => updateVisual({ referenceDescription: event.target.value })}
                  placeholder="填写主要数据、趋势、阶段或地图变化。"
                />
              </label>

              <label>
                <span>关键特征（每行一条）</span>
                <textarea
                  value={session.prompt.visualFacts.keyFeatures.join("\n")}
                  onChange={(event) =>
                    updateVisual({
                      keyFeatures: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean)
                    })
                  }
                  placeholder="例如：A 在 2020 年达到最高点"
                />
              </label>
            </article>
          )}

          <article className="panel editor-panel">
            <div className="editor-toolbar">
              <div><span className="eyebrow">ESSAY DRAFT</span><h3>作文草稿</h3></div>
              <div className="timer-control">
                <span>{formatTime(session.timer.remainingSeconds)}</span>
                <button className="primary small" type="button" onClick={onToggleTimer}>
                  {session.timer.running ? "暂停" : "开始"}
                </button>
                <button className="secondary small" type="button" onClick={onResetTimer}>重置</button>
              </div>
            </div>

            <textarea
              className="essay-input"
              value={session.writing.essay}
              onChange={(event) =>
                onSessionChange((current) => ({
                  ...current,
                  writing: { ...current.writing, essay: event.target.value }
                }))
              }
              placeholder="在这里输入完整作文……"
              spellCheck
            />

            <div className="editor-footer">
              <span><strong>{session.writing.wordCount}</strong> / {profile.minimumWords} words</span>
              <button className="text-button" type="button" onClick={onQuickCheck}>检查最后一句</button>
            </div>
          </article>

          {session.learning.liveSuggestions.length > 0 && (
            <article className="panel live-panel">
              <span className="eyebrow">LIVE CHECK</span>
              <h3>句子检查</h3>
              <div className="suggestion-list">
                {session.learning.liveSuggestions.map((suggestion) => (
                  <article key={suggestion.id} className="suggestion-card">
                    <del>{suggestion.original}</del>
                    <strong>{suggestion.replacement}</strong>
                    <p>{suggestion.messageZh || suggestion.message}</p>
                    <button type="button" className="secondary small" onClick={() => onApplySuggestion(suggestion)}>
                      应用修改
                    </button>
                  </article>
                ))}
              </div>
            </article>
          )}
        </section>

        <aside className="assistant-column">
          <article className="panel">
            <span className="eyebrow">PLAN</span>
            <h3>写前计划</h3>
            <textarea
              className="plan-input"
              value={session.writing.plan}
              onChange={(event) =>
                onSessionChange((current) => ({
                  ...current,
                  writing: { ...current.writing, plan: event.target.value }
                }))
              }
              placeholder="记录结构、观点、比较或 bullet 要点"
            />
          </article>

          <article className="panel score-panel">
            <span className="eyebrow">AI SCORE</span>
            <h3>提交完整评分</h3>
            <p>使用统一 A/G 评分接口。争议样本由评分系统按条件复核。</p>
            <button className="primary full" type="button" onClick={onGrade} disabled={session.grading.status === "loading"}>
              {session.grading.status === "loading" ? "评分中…" : "开始评分"}
            </button>
            {gradingMessage && <div className="grading-state">{gradingMessage}</div>}
          </article>

          <article className="panel legal-note">
            <strong>非官方声明</strong>
            <p>本工具不是 IELTS 官方产品，AI 估分仅供学习参考。</p>
          </article>
        </aside>
      </div>
    </section>
  );
}
