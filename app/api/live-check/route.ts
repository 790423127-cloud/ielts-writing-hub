import { callJson } from "@/server/ai/deepseek.ts";
import { errorResponse, jsonResponse, readJsonRequest } from "@/server/http.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

function compact(value: string): string {
  return value.toLowerCase().replace(/[\s.,!?;:'"“”‘’()\[\]{}]+/g, " ").trim();
}

function nearestOccurrence(text: string, original: string, proposed: number): number {
  const positions: number[] = [];
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(original, from);
    if (index < 0) break;
    positions.push(index);
    from = index + Math.max(1, original.length);
    if (positions.length > 20) break;
  }
  if (!positions.length) return -1;
  return positions.reduce((best, item) => Math.abs(item - proposed) < Math.abs(best - proposed) ? item : best, positions[0]);
}

function normalizeSuggestion(raw: Record<string, any>, text: string, offsetStart: number, index: number) {
  const original = String(raw.original || raw.source || "");
  const replacement = String(raw.replacement || raw.corrected || raw.suggestion || "").trim();
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence ?? 0.8)));
  if (confidence < 0.72 || !original.trim() || !replacement || compact(original) === compact(replacement)) return null;

  let start = Number(raw.start);
  let end = Number(raw.end);
  const proposed = Number.isFinite(start) ? start : 0;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > text.length || text.slice(start, end) !== original) {
    if (original.trim().length < 4) return null;
    start = nearestOccurrence(text, original, proposed);
    if (start < 0) return null;
    end = start + original.length;
  }
  if (text.slice(start, end) !== original) return null;

  const typeRaw = String(raw.type || "grammar").toLowerCase();
  const type = /spell/.test(typeRaw)
    ? "spelling"
    : /word|lexical|collocation|vocab/.test(typeRaw)
      ? "vocabulary"
      : /clear|fragment|run[- ]?on|sentence/.test(typeRaw)
        ? "clarity"
        : "grammar";

  return {
    id: String(raw.id || `live-${Date.now()}-${index}`),
    start,
    end,
    globalStart: offsetStart + start,
    globalEnd: offsetStart + end,
    original,
    replacement,
    type,
    confidence,
    sentenceOnly: true,
    message: String(raw.message || raw.reason || "Clear language issue."),
    messageZh: String(raw.messageZh || raw.explanationZh || "这个句子中存在一个较明确的语言问题。"),
    ieltsImpact: String(raw.ieltsImpact || "This may affect IELTS Writing accuracy or clarity.")
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonRequest(request, 100_000);
    const text = String(body.text || "").replace(/\r/g, "").slice(0, 650);
    const offsetStart = Math.max(0, Number(body.offsetStart) || 0);
    if (text.trim().length < 8) return jsonResponse({ ok: true, suggestions: [], skipped: "sentence_too_short" });

    const result = await callJson<{ suggestions?: Record<string, any>[] }>({
      role: "examiner",
      maxTokens: 1_000,
      temperature: 0,
      timeoutMs: 20_000,
      messages: [
        {
          role: "system",
          content: "You are a conservative IELTS sentence correction engine. Precision is more important than recall. Return JSON only."
        },
        {
          role: "user",
          content: [
            "Check only the supplied sentence. Return only clear, high-confidence errors, not optional style upgrades.",
            "Prefer objective issues: agreement, tense/form, article/plural, spelling, wrong word form, clearly wrong collocation, fragment, run-on or unclear grammar.",
            "Return at most 3 issues. Use 0-based indexes relative to the supplied sentence, and text.slice(start,end) must exactly equal original.",
            "If confidence is below 0.72 or exact indexes cannot be supplied, omit the issue.",
            "Return: {\"suggestions\":[{\"id\":\"s1\",\"start\":0,\"end\":0,\"original\":\"\",\"replacement\":\"\",\"type\":\"grammar\",\"confidence\":0.9,\"message\":\"\",\"messageZh\":\"\",\"ieltsImpact\":\"\"}]}",
            `Exam module: ${String(body.examModule || "")}`,
            `Task kind: ${String(body.taskKind || body.task || "")}`,
            `Question prompt: ${String(body.prompt || body.questionPrompt || "").slice(0, 1_200)}`,
            `Sentence:\n${text}`
          ].join("\n\n")
        }
      ]
    });

    const seen = new Set<string>();
    const suggestions = (Array.isArray(result.data.suggestions) ? result.data.suggestions : [])
      .map((item, index) => normalizeSuggestion(item, text, offsetStart, index))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => {
        const key = `${item.globalStart}:${item.globalEnd}:${item.replacement.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);

    return jsonResponse({
      ok: true,
      engine: "live-check-sentence-native-v1",
      offsetStart,
      sentenceOnly: true,
      suggestions,
      audit: result.audit
    });
  } catch (error) {
    return errorResponse(error);
  }
}
