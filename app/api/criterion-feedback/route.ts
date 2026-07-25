import { callJson } from "@/server/ai/deepseek.ts";
import { errorResponse, jsonResponse, readJsonRequest } from "@/server/http.ts";
import { learningContext } from "@/server/learning/context.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonRequest(request);
    const context = learningContext(body);
    const criterionSchema = Object.fromEntries(context.taskConfig.criteria.map((name) => [name, {
      band: Number(context.frozenCriteria[name] ?? 0),
      summary: "",
      summaryZh: "",
      whyThisBand: "",
      whyThisBandZh: "",
      whyNotHigher: "",
      whyNotHigherZh: "",
      strengths: [],
      strengthsZh: [],
      constraints: [],
      constraintsZh: [],
      essayEvidence: [
        { quote: "exact essay substring", meaning: "", meaningZh: "" },
        { quote: "second exact essay substring", meaning: "", meaningZh: "" }
      ],
      nextRevision: {
        action: "",
        actionZh: "",
        beforeQuote: "exact essay substring",
        revisedExample: "",
        whyItWorks: "",
        whyItWorksZh: ""
      }
    }]));

    const result = await callJson<Record<string, unknown>>({
      role: "feedback",
      maxTokens: 9_000,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You are a bilingual IELTS Writing teacher. The supplied score is frozen. Explain it with exact response evidence and practical revisions. Never change or recalculate any band. Return JSON only."
        },
        {
          role: "user",
          content: [
            "Return exactly this shape:",
            JSON.stringify({
              ok: true,
              system: "criterion-feedback-native-v1",
              summary: { en: "", zh: "" },
              criteria: criterionSchema,
              priorityAdvice: { en: "", zh: "" }
            }, null, 2),
            "Requirements:",
            "- Keep every criterion band exactly equal to the frozen band.",
            "- Use at least two exact substrings from the learner response per criterion when possible.",
            "- Do not invent errors. Explain both positive evidence and the recurring pattern that blocks the next band.",
            "- Give Chinese-first explanations with concise English support.",
            context.contextText
          ].join("\n\n")
        }
      ]
    });

    return jsonResponse({
      ...result.data,
      ok: true,
      system: "criterion-feedback-native-v1",
      scoreChanged: false,
      frozenScore: {
        overallBand: context.overallBand,
        finalCriteria: context.frozenCriteria
      },
      audit: result.audit
    });
  } catch (error) {
    return errorResponse(error);
  }
}
