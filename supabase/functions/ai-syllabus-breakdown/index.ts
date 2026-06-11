// POST /functions/v1/ai-syllabus-breakdown   { exam_id: string } | { spec_id: string }
//
// Pro-only. Resolves the syllabus source (exams.syllabus_text, exams.syllabus_storage_path,
// or subject_specs.storage_path), downloads the file via the service role, extracts text
// (pdfjs-dist legacy build for PDFs; capped at 80 pages / 150k chars), then makes a
// single-shot Sonnet call that is FORCED to answer through a `submit_breakdown` tool whose
// schema is exactly:
//   { "topics": [ { "name": "...", "subtopics": ["..."], "key_skills": ["..."], "estimated_hours": 0 } ] }
// The result is validated before persisting to exams.ai_breakdown_json (exam_id input only)
// and returned as the response body.

import {
  errorResponse,
  json,
  methodNotAllowed,
  preflight,
  readJson,
} from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/auth.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { getPlan, requirePro } from "../_shared/entitlements.ts";
import {
  AnthropicError,
  createMessage,
  getModel,
  type ToolDefinition,
} from "../_shared/anthropic.ts";
import { isUuid } from "../_shared/secure.ts";

const MAX_PDF_PAGES = 80;
const MAX_TEXT_CHARS = 150_000;
const MAX_OUTPUT_TOKENS = 8192;

// ---------------------------------------------------------------------------
// PDF text extraction (pdfjs-dist legacy build, imported lazily to keep cold
// starts fast for text-only syllabi).
// ---------------------------------------------------------------------------

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs");
  try {
    // The legacy build can run worker-less ("fake worker") in server runtimes;
    // point workerSrc at the worker module when the runtime can resolve it.
    const workerSrc = import.meta.resolve("npm:pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs");
    if (workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch {
    // Optional — pdf.js falls back to its own loader.
  }

  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
  });
  const doc = await task.promise;
  try {
    const pageCount = Math.min(doc.numPages as number, MAX_PDF_PAGES);
    let text = "";
    for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const pageText = (content.items as Array<{ str?: string }>)
        .map((item) => (typeof item.str === "string" ? item.str : ""))
        .join(" ");
      text += pageText + "\n";
      if (text.length >= MAX_TEXT_CHARS) break;
    }
    return text.slice(0, MAX_TEXT_CHARS);
  } finally {
    try {
      await doc.destroy();
    } catch {
      // best effort
    }
  }
}

function looksLikePdf(buffer: ArrayBuffer, mimeHint: string | null): boolean {
  if (mimeHint && mimeHint.toLowerCase().includes("pdf")) return true;
  const head = new Uint8Array(buffer.slice(0, 5));
  // "%PDF-"
  return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
}

// ---------------------------------------------------------------------------
// Breakdown schema: forced via tool_choice so the model must emit valid JSON.
// ---------------------------------------------------------------------------

const BREAKDOWN_TOOL: ToolDefinition = {
  name: "submit_breakdown",
  description:
    "Submit the final structured syllabus breakdown. Call exactly once with the complete topic tree.",
  input_schema: {
    type: "object",
    properties: {
      topics: {
        type: "array",
        description: "Major syllabus topics, in syllabus order.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Topic name." },
            subtopics: {
              type: "array",
              items: { type: "string" },
              description: "Subtopics within this topic.",
            },
            key_skills: {
              type: "array",
              items: { type: "string" },
              description: "Skills the student must be able to demonstrate.",
            },
            estimated_hours: {
              type: "number",
              description: "Realistic study hours to reach exam readiness for this topic.",
            },
          },
          required: ["name", "subtopics", "key_skills", "estimated_hours"],
          additionalProperties: false,
        },
      },
    },
    required: ["topics"],
    additionalProperties: false,
  },
};

interface BreakdownTopic {
  name: string;
  subtopics: string[];
  key_skills: string[];
  estimated_hours: number;
}

interface Breakdown {
  topics: BreakdownTopic[];
}

function cleanStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) out.push(item.trim().slice(0, 300));
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Validates/normalises model output. Returns null when unusable. */
function validateBreakdown(raw: unknown): Breakdown | null {
  if (typeof raw !== "object" || raw === null) return null;
  const topicsRaw = (raw as { topics?: unknown }).topics;
  if (!Array.isArray(topicsRaw) || topicsRaw.length === 0) return null;

  const topics: BreakdownTopic[] = [];
  for (const entry of topicsRaw.slice(0, 60)) {
    if (typeof entry !== "object" || entry === null) continue;
    const t = entry as Record<string, unknown>;
    const name = typeof t.name === "string" ? t.name.trim().slice(0, 200) : "";
    if (!name) continue;
    const hoursRaw = typeof t.estimated_hours === "number" ? t.estimated_hours : Number(t.estimated_hours);
    const estimated_hours = Number.isFinite(hoursRaw)
      ? Math.max(0, Math.min(500, Math.round(hoursRaw * 10) / 10))
      : 0;
    topics.push({
      name,
      subtopics: cleanStringArray(t.subtopics, 40),
      key_skills: cleanStringArray(t.key_skills, 40),
      estimated_hours,
    });
  }
  return topics.length > 0 ? { topics } : null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed();

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, supabase } = auth;

  const body = await readJson<{ exam_id?: unknown; spec_id?: unknown }>(req);
  const examId = isUuid(body?.exam_id) ? (body?.exam_id as string) : null;
  const specId = isUuid(body?.spec_id) ? (body?.spec_id as string) : null;
  if (!examId && !specId) {
    return errorResponse(
      "invalid_request",
      'Provide either "exam_id" or "spec_id" (UUID).',
      400,
    );
  }

  const service = createServiceClient();
  const plan = await getPlan(service, user.id);
  const gated = requirePro(plan);
  if (gated) return gated;

  const limited = await enforceRateLimit(user.id, "ai-breakdown", 5, 3600, service);
  if (limited) return limited;

  // Resolve the syllabus source (user-scoped reads → RLS proves ownership).
  let syllabusText: string | null = null;
  let storagePath: string | null = null;
  let mimeHint: string | null = null;

  if (examId) {
    const { data: exam, error } = await supabase
      .from("exams")
      .select("id,syllabus_text,syllabus_storage_path")
      .eq("id", examId)
      .maybeSingle();
    if (error) return errorResponse("internal_error", "Could not load the exam.", 500);
    if (!exam) return errorResponse("not_found", "Exam not found.", 404);
    const row = exam as { syllabus_text: string | null; syllabus_storage_path: string | null };
    if (row.syllabus_text?.trim()) syllabusText = row.syllabus_text;
    else if (row.syllabus_storage_path) storagePath = row.syllabus_storage_path;
    else {
      return errorResponse(
        "no_syllabus",
        "This exam has no syllabus text or uploaded syllabus file.",
        422,
      );
    }
  } else if (specId) {
    const { data: spec, error } = await supabase
      .from("subject_specs")
      .select("id,storage_path,mime")
      .eq("id", specId)
      .maybeSingle();
    if (error) return errorResponse("internal_error", "Could not load the syllabus file.", 500);
    if (!spec) return errorResponse("not_found", "Syllabus file not found.", 404);
    const row = spec as { storage_path: string; mime: string | null };
    storagePath = row.storage_path;
    mimeHint = row.mime;
  }

  // Download + extract when the source is a storage object.
  if (!syllabusText && storagePath) {
    const { data: blob, error: downloadError } = await service.storage
      .from("syllabi")
      .download(storagePath);
    if (downloadError || !blob) {
      return errorResponse("not_found", "The syllabus file could not be downloaded.", 404);
    }
    const buffer = await blob.arrayBuffer();
    if (looksLikePdf(buffer, mimeHint ?? blob.type ?? null)) {
      try {
        syllabusText = await extractPdfText(buffer);
      } catch {
        return errorResponse(
          "extraction_failed",
          "We could not extract text from this PDF. Try uploading a text-based (not scanned) PDF, or paste the syllabus as text.",
          422,
        );
      }
    } else {
      try {
        syllabusText = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      } catch {
        syllabusText = null;
      }
    }
  }

  syllabusText = syllabusText?.replace(/\u0000/g, "").trim().slice(0, MAX_TEXT_CHARS) ?? null;
  if (!syllabusText || syllabusText.length < 40) {
    return errorResponse(
      "extraction_failed",
      "No usable syllabus text was found in this source. Try a text-based PDF or paste the syllabus text.",
      422,
    );
  }

  // Single-shot Sonnet call, forced through the breakdown tool.
  let breakdown: Breakdown | null = null;
  try {
    const response = await createMessage({
      model: getModel("sonnet"),
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
      system: [
        {
          type: "text",
          text:
            "You are an expert curriculum analyst for secondary-school exam syllabi (GCSE, IGCSE, IB, A-Level). " +
            "Break the provided syllabus into a complete, well-organised topic tree. Rules: " +
            "follow the syllabus's own structure and order; keep topic names short and exam-board accurate; " +
            "subtopics are the concrete content points under each topic; key_skills are assessable abilities " +
            "(e.g. 'balance redox equations', 'evaluate sources'); estimated_hours is a realistic total study " +
            "estimate per topic for a typical student (use 0.5-hour granularity). " +
            "Submit the result by calling submit_breakdown exactly once. Do not include anything not in the syllabus.",
        },
      ],
      messages: [
        {
          role: "user",
          content: `Break down the following syllabus into the structured topic tree.\n\n<syllabus>\n${syllabusText}\n</syllabus>`,
        },
      ],
      tools: [BREAKDOWN_TOOL],
      tool_choice: { type: "tool", name: BREAKDOWN_TOOL.name },
    });

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === BREAKDOWN_TOOL.name) {
        breakdown = validateBreakdown(block.input);
        break;
      }
    }
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error(`ai-syllabus-breakdown upstream status=${err.status} type=${err.errorType}`);
      return errorResponse(
        "ai_unavailable",
        "The AI service is temporarily unavailable. Please try again shortly.",
        502,
      );
    }
    console.error("ai-syllabus-breakdown failed:", (err as Error)?.name ?? "unknown");
    return errorResponse("internal_error", "Could not generate the breakdown.", 500);
  }

  if (!breakdown) {
    return errorResponse(
      "ai_invalid_output",
      "The AI returned an unusable breakdown. Please try again.",
      502,
    );
  }

  // Persist only for exam-sourced breakdowns (user-scoped update → RLS).
  if (examId) {
    const { error: saveError } = await supabase
      .from("exams")
      .update({ ai_breakdown_json: breakdown })
      .eq("id", examId);
    if (saveError) {
      console.error("ai-syllabus-breakdown: persist failed");
      // The breakdown is still returned; the client may retry the save.
    }
  }

  return json(breakdown, 200);
});
