import { callJson } from "@/server/ai/deepseek.ts";
import { errorResponse, jsonResponse, readJsonRequest } from "@/server/http.ts";
import { learningContext, targetBand } from "@/server/learning/context.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

interface GeneratedPart {
  targetBand: number;
  essay: string;
  whatChanged?: string[];
  whatChangedFromPlus05?: string[];
  studyPoints?: string[];
}

async function verifyGeneratedEssay(args: {
  contextText: string;
  essay: string;
  targetBand: number;
  label: string;
  signal?: AbortSignal;
}) {
  const call = await callJson<Record<string, unknown>>({
    role: "generated_verifier",
    maxTokens: 1_800,
    temperature: 0,
    signal: args.signal,
    messages: [
      {
        role: "system",
        content: "You are a conservative IELTS Writing verifier. Estimate only an overall half-band for the generated response. Return JSON only."
      },
      {
        role: "user",
        content: [
          `Label: ${args.label}`,
          `Target band: ${args.targetBand}`,
          "Return: {\"verifiedBand\": 0, \"reason\": \"\", \"needsHumanReview\": false}",
          args.contextText,
          `Generated response:\n${args.essay}`
        ].join("\n\n")
      }
    ]
  });
  const verified = Number(call.data.verifiedBand);
  const verifiedBand = Number.isFinite(verified) ? Math.max(0, Math.min(9, Math.round(verified * 2) / 2)) : null;
  const difference = verifiedBand === null ? null : Math.round((verifiedBand - args.targetBand) * 2) / 2;
  return {
    enabled: true,
    targetBand: args.targetBand,
    verifiedBand,
    difference,
    status: verifiedBand === null
      ? "verification_unavailable"
      : difference === 0
        ? "verified-pass"
        : Math.abs(difference || 0) <= 0.5
          ? "verified-close"
          : difference! < 0
            ? "verified-too-low"
            : "verified-too-high",
    reason: String(call.data.reason || ""),
    needsHumanReview: call.data.needsHumanReview === true,
    audit: call.audit
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonRequest(request);
    const context = learningContext(body);
    const currentBand = context.overallBand;
    const plus05 = targetBand(currentBand, 0.5, 6.5);
    const plus10 = targetBand(currentBand, 1.0, 7);
    const modelBand = Math.max(7, targetBand(currentBand, 1.5, 7.5));

    const schema = {
      modelAnswer: {
        targetBand: modelBand,
        essay: "complete model response",
        studyPoints: ["what to learn from this response"]
      },
      revisionPlus05: {
        targetBand: plus05,
        essay: "complete revision based on the learner response",
        whatChanged: ["specific change"]
      },
      revisionPlus10: {
        targetBand: plus10,
        essay: "complete revision based on the learner response",
        whatChangedFromPlus05: ["additional improvement"]
      },
      learningGuide: {
        biggestScoreBlockers: [""],
        howToStudyTheThreeVersions: [""],
        reusablePatterns: [{ pattern: "", meaningZh: "", example: "" }]
      },
      modelAnswerOutline: ""
    };

    const taskSpecific = context.taskConfig.taskKind === "academic_visual_report"
      ? [
          "The model answer and both revisions must be Academic Task 1 reports, never letters.",
          "Use only supplied visualFacts. Do not invent data, dates, stages or map changes.",
          "Include a clear overview and select/group key features appropriately for the visual type."
        ]
      : context.taskConfig.taskKind === "gt_letter"
        ? [
            "The model answer and revisions must be letters with a clear purpose, complete bullet coverage and appropriate sustained tone.",
            "Use a natural greeting and closing suitable for the supplied relationship."
          ]
        : [
            "The model answer and revisions must answer every direct Task 2 demand and sustain a clear position.",
            "Develop claims through reasons, consequences or examples rather than adding memorised paragraphs."
          ];

    const generated = await callJson<Record<string, any>>({
      role: "generator",
      maxTokens: 12_000,
      temperature: 0.45,
      messages: [
        {
          role: "system",
          content: "You generate calibrated IELTS Writing learning versions. Return one complete JSON object only. Preserve the learner's intended meaning in revisions and never change the frozen original score."
        },
        {
          role: "user",
          content: [
            `Return exactly this shape:\n${JSON.stringify(schema, null, 2)}`,
            `Requirements:\n- ${[
              "Generate three complete texts, not outlines.",
              "revisionPlus05 and revisionPlus10 must remain recognisably based on the learner response while fixing the highest-impact weaknesses.",
              "Keep language appropriate to each target band; do not make the +0.5 version unrealistically advanced.",
              "Meet the IELTS minimum word count without padding.",
              ...taskSpecific
            ].join("\n- ")}`,
            context.contextText
          ].join("\n\n")
        }
      ]
    });

    const modelAnswer = generated.data.modelAnswer as GeneratedPart;
    const revisionPlus05 = generated.data.revisionPlus05 as GeneratedPart;
    const revisionPlus10 = generated.data.revisionPlus10 as GeneratedPart;
    const shouldVerify = body.verifyGeneratedBands !== false;

    const [modelVerification, plus05Verification, plus10Verification] = shouldVerify
      ? await Promise.all([
          verifyGeneratedEssay({ contextText: context.contextText, essay: String(modelAnswer?.essay || ""), targetBand: modelBand, label: "modelAnswer", signal: request.signal }),
          verifyGeneratedEssay({ contextText: context.contextText, essay: String(revisionPlus05?.essay || ""), targetBand: plus05, label: "revisionPlus05", signal: request.signal }),
          verifyGeneratedEssay({ contextText: context.contextText, essay: String(revisionPlus10?.essay || ""), targetBand: plus10, label: "revisionPlus10", signal: request.signal })
        ])
      : [null, null, null];

    return jsonResponse({
      ...generated.data,
      ok: true,
      system: "essay-generator-native-v1",
      generationOnly: true,
      scoreUnaffected: true,
      scoreChanged: false,
      task: context.taskConfig.task,
      taskKind: context.taskConfig.taskKind,
      currentBand,
      targetBandModel: modelBand,
      targetBandPlus05: plus05,
      targetBandPlus10: plus10,
      modelAnswer: { ...modelAnswer, targetBand: modelBand, verification: modelVerification },
      revisionPlus05: { ...revisionPlus05, targetBand: plus05, verification: plus05Verification },
      revisionPlus10: { ...revisionPlus10, targetBand: plus10, verification: plus10Verification },
      audit: generated.audit
    });
  } catch (error) {
    return errorResponse(error);
  }
}
