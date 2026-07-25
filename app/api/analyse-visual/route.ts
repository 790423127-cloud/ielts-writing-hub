import { parseJsonContent } from "@/server/ai/deepseek.ts";
import { errorResponse, jsonResponse, readJsonRequest } from "@/server/http.ts";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonRequest(request, 12_000_000);
    const imageDataUrl = String(body.imageDataUrl || body.image || "");
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(imageDataUrl)) {
      return jsonResponse({ ok: false, error: "MISSING_VISUAL_IMAGE", detail: "A base64 imageDataUrl is required." }, 400);
    }

    const apiUrl = String(process.env.VISION_API_URL || "").trim();
    const apiKey = String(process.env.VISION_API_KEY || process.env.OPENAI_API_KEY || "").trim();
    const model = String(process.env.VISION_MODEL || "").trim();
    if (!apiUrl || !apiKey || !model) {
      return jsonResponse({
        ok: false,
        error: "VISION_NOT_CONFIGURED",
        detail: "Set VISION_API_URL, VISION_API_KEY and VISION_MODEL in the new Vercel project."
      }, 503);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 100_000);
    try {
      const prompt = [
        "Analyse this IELTS Academic Writing Task 1 visual carefully.",
        "Extract only information actually visible in the image. Do not guess unreadable values.",
        "Return one JSON object with this exact shape:",
        JSON.stringify({
          visualType: "bar_chart | line_graph | pie_chart | table | map | process | mixed | unknown",
          title: "",
          units: [],
          timeRange: [],
          series: [],
          dataPoints: [{ label: "", series: "", value: "", unit: "", time: "" }],
          keyFeatures: [],
          majorComparisons: [],
          stages: [],
          mapChanges: { additions: [], removals: [], relocations: [], unchanged: [] },
          referenceDescription: "concise factual summary for an IELTS examiner",
          uncertainItems: [],
          confidence: 0.8
        }, null, 2),
        `Question text supplied by the learner:\n${String(body.questionPrompt || body.prompt || "").slice(0, 5_000)}`
      ].join("\n\n");

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 4_000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a precise chart, map and process-diagram extraction engine. Return JSON only." },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageDataUrl } }
              ]
            }
          ]
        }),
        signal: controller.signal,
        cache: "no-store"
      });
      const raw = await response.text();
      let payload: Record<string, any> = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { raw }; }
      if (!response.ok) {
        throw Object.assign(new Error(String(payload?.error?.message || raw.slice(0, 500) || `Vision HTTP ${response.status}`)), {
          code: "VISION_HTTP_ERROR",
          httpStatus: response.status
        });
      }
      const content = String(payload?.choices?.[0]?.message?.content || payload?.output_text || "");
      const facts = parseJsonContent<Record<string, any>>(content);
      return jsonResponse({
        ok: true,
        system: "academic-visual-extractor-v1",
        visualFacts: {
          ...facts,
          sourceVerified: false,
          verificationNote: "Extracted by a vision model; confirm against the source image before scoring."
        },
        model: payload.model || model,
        usage: payload.usage || null
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
