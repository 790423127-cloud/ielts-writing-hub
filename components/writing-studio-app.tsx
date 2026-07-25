"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dashboard } from "./dashboard";
import { ExpressionLibrary } from "./expression-library";
import { MockExam } from "./mock-exam";
import { ScoreReport } from "./score-report";
import { Sidebar } from "./sidebar";
import { Workspace } from "./workspace";
import { apiClient } from "@/lib/api-client";
import { classifyPrompt } from "@/lib/prompt-classifier.ts";
import {
  buildLearningPayload,
  buildScoringPayload,
  createSession,
  ensureSessionShape,
  touchSession
} from "@/lib/session.ts";
import {
  calculateHistoryStats,
  clearAllData,
  loadCurrent,
  loadHistory,
  loadTheme,
  removeHistory,
  saveCurrent,
  saveTheme,
  saveToHistory
} from "@/lib/storage.ts";
import {
  clearTeacherMemory,
  mergeTeacherMemory,
  teacherMemoryContext
} from "@/lib/teacher-memory.ts";
import { getTaskProfile } from "@/lib/task-profiles.ts";
import type {
  LearningModuleName,
  LiveSuggestion,
  ScoreResult,
  TaskProfileId,
  WritingSession
} from "@/types/writing.ts";

type View = "dashboard" | "workspace" | "report" | "mock" | "expressions";

function lastSentence(text: string): { text: string; offsetStart: number } | null {
  const trimmedEnd = text.trimEnd();
  if (trimmedEnd.length < 8) return null;
  const boundary = Math.max(
    trimmedEnd.lastIndexOf(". ", trimmedEnd.length - 2),
    trimmedEnd.lastIndexOf("! ", trimmedEnd.length - 2),
    trimmedEnd.lastIndexOf("? ", trimmedEnd.length - 2),
    trimmedEnd.lastIndexOf("\n", trimmedEnd.length - 2)
  );
  const offsetStart = boundary >= 0 ? boundary + 1 : 0;
  const sentence = trimmedEnd.slice(offsetStart).trimStart();
  const leading = trimmedEnd.slice(offsetStart).length - sentence.length;
  return sentence.length >= 8 ? { text: sentence.slice(0, 650), offsetStart: offsetStart + leading } : null;
}

export function WritingStudioApp() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [session, setSession] = useState<WritingSession | null>(null);
  const [history, setHistory] = useState<WritingSession[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const restored = loadCurrent();
    setSession(restored);
    setHistory(loadHistory());
    const initialTheme = loadTheme();
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!session || !mounted) return;
    const timeout = window.setTimeout(() => saveCurrent(session), 350);
    return () => window.clearTimeout(timeout);
  }, [session, mounted]);

  useEffect(() => {
    if (!session?.timer.running) return;
    const interval = window.setInterval(() => {
      setSession((current) => {
        if (!current?.timer.running) return current;
        const remaining = Math.max(0, current.timer.remainingSeconds - 1);
        return {
          ...current,
          timer: {
            ...current.timer,
            remainingSeconds: remaining,
            running: remaining > 0
          }
        };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [session?.timer.running]);

  const stats = useMemo(() => calculateHistoryStats(history), [history]);

  const updateSession = (updater: (current: WritingSession) => WritingSession) => {
    setSession((current) => {
      if (!current) return current;
      const next = touchSession(updater(current));
      if (next.prompt.text !== current.prompt.text) {
        next.prompt.detection = classifyPrompt(next.prompt.text);
      }
      return next;
    });
  };

  const startSession = (profileId: TaskProfileId) => {
    requestRef.current?.abort();
    const next = createSession(profileId);
    setSession(next);
    saveCurrent(next);
    setMessage("");
    setView("workspace");
  };

  const switchProfile = (profileId: TaskProfileId) => {
    if (!session) return;
    const profile = getTaskProfile(profileId);
    updateSession((current) => ({
      ...current,
      profileId,
      examModule: profile.examModule,
      taskNumber: profile.taskNumber,
      taskKind: profile.taskKind,
      timer: {
        durationSeconds: profile.minutes * 60,
        remainingSeconds: profile.minutes * 60,
        running: false
      },
      grading: { status: "idle", result: null, error: "" },
      learning: { modules: {}, generation: null, teacherClinic: null, liveSuggestions: [] }
    }));
  };

  const grade = async () => {
    if (!session) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      setMessage("正在提交评分，请稍候…");
      setSession((current) => current ? {
        ...current,
        grading: { ...current.grading, status: "loading", error: "" }
      } : current);

      const payload = buildScoringPayload(session);
      const result = await apiClient.grade<ScoreResult>(payload, controller.signal);
      const completed: WritingSession = touchSession({
        ...session,
        grading: { status: "complete", result, error: "" },
        timer: { ...session.timer, running: false }
      });
      setSession(completed);
      const nextHistory = saveToHistory(completed);
      setHistory(nextHistory);
      setMessage("");
      setView("report");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage(errorMessage);
      setSession((current) => current ? {
        ...current,
        grading: { ...current.grading, status: "error", error: errorMessage }
      } : current);
    }
  };

  const quickCheck = async () => {
    if (!session) return;
    const sentence = lastSentence(session.writing.essay);
    if (!sentence) {
      setMessage("请先写一个完整句子。");
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      setMessage("正在检查最后一句…");
      const result = await apiClient.liveCheck<{ suggestions?: LiveSuggestion[] }>(
        {
          text: sentence.text,
          offsetStart: sentence.offsetStart,
          task: `Task ${session.taskNumber}`,
          prompt: session.prompt.text,
          examModule: session.examModule,
          taskKind: session.taskKind,
          mode: "help"
        },
        controller.signal
      );
      updateSession((current) => ({
        ...current,
        learning: {
          ...current.learning,
          liveSuggestions: Array.isArray(result.suggestions) ? result.suggestions : []
        }
      }));
      setMessage(result.suggestions?.length ? "" : "没有发现高置信度错误。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const applySuggestion = (suggestion: LiveSuggestion) => {
    if (!session) return;
    const essay = session.writing.essay;
    if (essay.slice(suggestion.globalStart, suggestion.globalEnd) !== suggestion.original) {
      setMessage("作文已经发生变化，请重新检查句子。");
      return;
    }

    updateSession((current) => ({
      ...current,
      writing: {
        ...current.writing,
        essay:
          current.writing.essay.slice(0, suggestion.globalStart) +
          suggestion.replacement +
          current.writing.essay.slice(suggestion.globalEnd)
      },
      learning: { ...current.learning, liveSuggestions: [] }
    }));
  };

  const generateFeedback = async (module: LearningModuleName) => {
    if (!session?.grading.result) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      setBusyAction("正在生成详细反馈…");
      const payload = buildLearningPayload(session, module === "criterionFeedback" ? {} : { module });
      const result = module === "criterionFeedback"
        ? await apiClient.criterionFeedback<unknown>(payload, controller.signal)
        : await apiClient.learningFeedback<unknown>(payload, controller.signal);

      const updated = touchSession({
        ...session,
        learning: {
          ...session.learning,
          modules: { ...session.learning.modules, [module]: result }
        }
      });
      setSession(updated);
      setHistory(saveToHistory(updated));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction("");
    }
  };

  const generateRevision = async () => {
    if (!session?.grading.result) return;
    try {
      setBusyAction("正在生成范文与改写…");
      const result = await apiClient.generateEssay<unknown>(
        buildLearningPayload(session, { verifyGeneratedBands: true })
      );
      const updated = touchSession({
        ...session,
        learning: { ...session.learning, generation: result }
      });
      setSession(updated);
      setHistory(saveToHistory(updated));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction("");
    }
  };

  const generateTeacher = async () => {
    if (!session?.grading.result) return;
    try {
      setBusyAction("正在生成 AI 教师精讲…");
      const result = await apiClient.learningFeedback<Record<string, unknown>>(
        buildLearningPayload(session, {
          module: "expressionBank",
          errorMemoryContext: teacherMemoryContext(session.profileId)
        })
      );

      const moduleResult = result.moduleResult && typeof result.moduleResult === "object"
        ? result.moduleResult as Record<string, unknown>
        : {};
      const memoryUpdate = moduleResult.memoryUpdate && typeof moduleResult.memoryUpdate === "object"
        ? moduleResult.memoryUpdate as Record<string, unknown>
        : {};
      mergeTeacherMemory(session.profileId, memoryUpdate);

      const updated = touchSession({
        ...session,
        learning: { ...session.learning, teacherClinic: result }
      });
      setSession(updated);
      setHistory(saveToHistory(updated));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction("");
    }
  };

  const analyseVisual = async () => {
    if (!session || session.profileId !== "academic_task1" || !session.prompt.imageDataUrl) return;
    try {
      setMessage("正在读取题图，请稍候…");
      const result = await apiClient.analyseVisual<{ visualFacts?: Record<string, unknown> }>({
        imageDataUrl: session.prompt.imageDataUrl,
        questionPrompt: session.prompt.text
      });
      const facts = result.visualFacts && typeof result.visualFacts === "object" ? result.visualFacts : {};
      updateSession((current) => ({
        ...current,
        prompt: {
          ...current.prompt,
          visualFacts: {
            ...current.prompt.visualFacts,
            visualType: String(facts.visualType || current.prompt.visualFacts.visualType || "unknown"),
            referenceDescription: String(facts.referenceDescription || current.prompt.visualFacts.referenceDescription || ""),
            keyFeatures: Array.isArray(facts.keyFeatures) ? facts.keyFeatures.map(String).filter(Boolean).slice(0, 30) : current.prompt.visualFacts.keyFeatures,
            sourceVerified: false,
            verificationNote: String(facts.verificationNote || "Extracted by vision model; awaiting user confirmation.")
          }
        }
      }));
      setMessage("题图信息已提取，请对照原图核对后勾选确认。 ");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
    document.documentElement.dataset.theme = next;
  };

  const clearData = () => {
    if (!window.confirm("确定删除本浏览器中的全部练习、草稿、模拟考试、表达收藏和教师记忆吗？")) return;
    clearAllData();
    clearTeacherMemory();
    setSession(null);
    setHistory([]);
    setView("dashboard");
  };

  const openLatest = () => {
    const latest = session?.grading.result ? session : history.find((item) => item.grading.result);
    if (!latest) {
      window.alert("还没有评分报告。");
      return;
    }
    setSession(ensureSessionShape(latest));
    setView("report");
  };

  if (!mounted) {
    return <main className="loading-screen">正在加载写作工作台…</main>;
  }

  return (
    <div className="app-shell">
      <Sidebar
        history={history}
        theme={theme}
        onNew={() => setView("dashboard")}
        onContinue={() => session && setView("workspace")}
        onOpenMockExam={() => setView("mock")}
        onOpenExpressions={() => setView("expressions")}
        onOpenHistory={(saved) => {
          setSession(ensureSessionShape(saved));
          setView(saved.grading.result ? "report" : "workspace");
        }}
        onRemoveHistory={(id) => setHistory(removeHistory(id))}
        onToggleTheme={toggleTheme}
        onClearData={clearData}
      />

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">IELTS WRITING WORKSPACE</span>
            <h1>用户自带题目的写作与评分工作台</h1>
          </div>
          <button className="primary" type="button" onClick={() => setView("dashboard")}>新建练习</button>
        </header>

        {view === "dashboard" && (
          <Dashboard
            stats={stats}
            onSelect={startSession}
            onOpenLatest={openLatest}
            onOpenMockExam={() => setView("mock")}
            onOpenExpressions={() => setView("expressions")}
          />
        )}

        {view === "workspace" && session && (
          <Workspace
            session={session}
            gradingMessage={message}
            onSessionChange={updateSession}
            onChangeTask={() => setView("dashboard")}
            onToggleTimer={() =>
              updateSession((current) => ({
                ...current,
                timer: { ...current.timer, running: !current.timer.running }
              }))
            }
            onResetTimer={() => {
              const profile = getTaskProfile(session.profileId);
              updateSession((current) => ({
                ...current,
                timer: {
                  durationSeconds: profile.minutes * 60,
                  remainingSeconds: profile.minutes * 60,
                  running: false
                }
              }));
            }}
            onGrade={grade}
            onQuickCheck={quickCheck}
            onAnalyseVisual={analyseVisual}
            onApplySuggestion={applySuggestion}
            onSwitchProfile={switchProfile}
          />
        )}

        {view === "report" && session?.grading.result && (
          <ScoreReport
            session={session}
            busyAction={busyAction}
            onEdit={() => setView("workspace")}
            onNew={() => setView("dashboard")}
            onGenerateFeedback={generateFeedback}
            onGenerateRevision={generateRevision}
            onGenerateTeacher={generateTeacher}
          />
        )}

        {view === "mock" && (
          <MockExam onClose={() => setView("dashboard")} onHistoryUpdated={setHistory} />
        )}

        {view === "expressions" && (
          <ExpressionLibrary onClose={() => setView("dashboard")} />
        )}
      </main>
    </div>
  );
}
