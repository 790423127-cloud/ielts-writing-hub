import { callJson } from "@/server/ai/deepseek.ts";
import { errorResponse, jsonResponse, readJsonRequest } from "@/server/http.ts";
import { learningContext } from "@/server/learning/context.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODULE_SCHEMAS: Record<string, Record<string, unknown>> = {
  overview: {
    summary: { en: "", zh: "" },
    topProblems: [{
      problem: "",
      problemZh: "",
      evidence: "exact response or prompt evidence",
      evidenceZh: "",
      whyMatters: { en: "", zh: "" },
      nextPractice: { en: "", zh: "" },
      priority: "high"
    }],
    errorSummary: [{ type: "grammar", count: 0, note: { en: "", zh: "" } }],
    nextPracticeFocus: [{ focus: { en: "", zh: "" }, reason: { en: "", zh: "" }, action: { en: "", zh: "" } }],
    priorityAdvice: { en: "", zh: "" }
  },
  sentenceUpgrade: {
    summary: { en: "", zh: "" },
    sentenceCards: [{
      index: 1,
      original: "exact original sentence",
      originalZh: "",
      hasClearError: true,
      issueTags: ["grammar"],
      minimalCorrection: "",
      minimalCorrectionZh: "",
      upgradedVersion: "",
      upgradedVersionZh: "",
      whyBetter: { en: "", zh: "" },
      learnThis: { en: "", zh: "" },
      usefulPattern: { en: "", zh: "" }
    }],
    priorityAdvice: { en: "", zh: "" }
  },
  grammarWordFormSpelling: {
    summary: { en: "", zh: "" },
    grammarErrors: [{ index: 1, errorType: "article", original: "", corrected: "", explanation: { en: "", zh: "" }, checkMethod: { en: "", zh: "" } }],
    wordFormErrors: [{ index: 1, errorType: "word_form", original: "", corrected: "", explanation: { en: "", zh: "" }, checkMethod: { en: "", zh: "" } }],
    spellingQuickFix: [{ wrong: "", correct: "", note: "" }],
    learningFocus: [{ point: "", example: "", exampleZh: "", rule: { en: "", zh: "" }, checkMethod: { en: "", zh: "" } }],
    priorityAdvice: { en: "", zh: "" }
  },
  structureCohesionTask: {
    summary: { en: "", zh: "" },
    taskChecklist: [{ requirement: "", requirementZh: "", status: "covered", statusZh: "", evidence: "", evidenceZh: "", advice: { en: "", zh: "" } }],
    opening: { currentIssue: "", currentIssueZh: "", suggestedVersion: "", suggestedVersionZh: "", whyBetter: { en: "", zh: "" } },
    paragraphOrganisation: { currentIssue: "", currentIssueZh: "", suggestedVersion: "", suggestedVersionZh: "", whyBetter: { en: "", zh: "" } },
    cohesion: { issues: [{ original: "", improved: "", whyBetter: { en: "", zh: "" } }] },
    taskSpecificAdvice: { en: "", zh: "" },
    priorityAdvice: { en: "", zh: "" }
  },
  expressionBank: {
    summary: { en: "", zh: "" },
    teacherOpening: {
      todayMainGoalZh: "",
      diagnosisZh: "",
      encouragementZh: ""
    },
    teachingIssues: [{
      issueTitleZh: "",
      issueTitleEn: "",
      whyTeacherPickedThisZh: "",
      slowLearnerExplanationZh: "",
      examplesFromYourEssay: [{
        original: "exact response substring",
        survivalCorrection: "",
        naturalUpgrade: "",
        explanationZh: ""
      }],
      practiceMethodZh: ""
    }],
    reusableExpressions: [{ expression: "", meaningZh: "", useWhenZh: "", example: "" }],
    memoryUpdate: {
      recurringErrors: [{ key: "", labelZh: "", count: 1, evidence: "" }],
      strengths: [{ key: "", labelZh: "", count: 1, evidence: "" }]
    }
  }
};

function moduleInstructions(module: string, taskKind: string): string[] {
  const common = [
    "The score is frozen. Do not change, estimate or discuss a different score.",
    "Use exact evidence from the learner response. Do not invent mistakes.",
    "Give Chinese-first explanations with concise English support.",
    "Keep recommendations appropriate for roughly 0.5 to 1.0 band improvement, not an unrealistic jump."
  ];
  if (module === "overview") return [...common, "Identify the 3-5 issues with the greatest score impact and a concrete practice order."];
  if (module === "sentenceUpgrade") return [...common, "Follow the response order. If a sentence is acceptable, mark hasClearError false and offer only a natural expression upgrade."];
  if (module === "grammarWordFormSpelling") return [...common, "List all clear grammar, word-form and spelling errors that can be supported by exact text."];
  if (module === "structureCohesionTask") {
    return [...common,
      taskKind === "academic_visual_report"
        ? "For Academic Task 1, focus on overview, key-feature selection, grouping, comparisons, factual precision and report structure. Never apply letter rules."
        : taskKind === "gt_letter"
          ? "For GT Task 1, focus on purpose, every bullet, tone/register, paragraphing and reader action."
          : "For Task 2, map every question demand, position, idea development, paragraph purpose and cohesion."
    ];
  }
  return [...common,
    taskKind === "academic_visual_report"
      ? "Act as an Academic Task 1 teacher: explain overview, key features, comparisons/grouping, data language and factual accuracy. Never mention greetings, sign-offs or letter tone."
      : taskKind === "gt_letter"
        ? "Act as a GT letter teacher: explain purpose, bullet coverage, reader relationship, tone and natural functional language."
        : "Act as a Task 2 teacher: explain task demands, reasoning chains, paragraph purpose, vocabulary and grammar patterns."
  ];
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonRequest(request);
    const context = learningContext(body);
    const module = String(body.module || "overview");
    const schema = MODULE_SCHEMAS[module];
    if (!schema) {
      return jsonResponse({ ok: false, error: "UNSUPPORTED_FEEDBACK_MODULE", detail: `Unsupported module: ${module}` }, 400);
    }

    const result = await callJson<Record<string, unknown>>({
      role: "teacher",
      maxTokens: module === "sentenceUpgrade" || module === "grammarWordFormSpelling" ? 10_000 : 7_500,
      temperature: 0.18,
      messages: [
        {
          role: "system",
          content: "You are a careful bilingual IELTS Writing teacher. Return a single valid JSON object only. Precision and task-specific teaching are more important than quantity."
        },
        {
          role: "user",
          content: [
            `Feedback module: ${module}`,
            `Return exactly this moduleResult shape:\n${JSON.stringify(schema, null, 2)}`,
            `Instructions:\n- ${moduleInstructions(module, context.taskConfig.taskKind).join("\n- ")}`,
            body.errorMemoryContext ? `Prior learner memory (advisory only):\n${JSON.stringify(body.errorMemoryContext, null, 2)}` : "",
            context.contextText
          ].filter(Boolean).join("\n\n")
        }
      ]
    });

    return jsonResponse({
      ok: true,
      system: "learning-feedback-native-v1",
      module,
      title: module,
      scoreChanged: false,
      frozenScore: { overallBand: context.overallBand, finalCriteria: context.frozenCriteria },
      moduleResult: result.data,
      audit: result.audit
    });
  } catch (error) {
    return errorResponse(error);
  }
}
