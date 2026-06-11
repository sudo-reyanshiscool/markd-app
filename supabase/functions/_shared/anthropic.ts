// Minimal fetch-based Anthropic Messages API client (no SDK).
//
// - POST https://api.anthropic.com/v1/messages with `anthropic-version: 2023-06-01`.
// - Supports streaming SSE, tool definitions/results, and PROMPT CACHING via
//   `cache_control: { type: "ephemeral" }` blocks on system text blocks
//   (a breakpoint on a system block also caches the tools that precede it).
// - Model ids come from env with sensible defaults (current model generation):
//     ANTHROPIC_MODEL_SONNET (default "claude-sonnet-4-6")  → paid plans
//     ANTHROPIC_MODEL_HAIKU  (default "claude-haiku-4-5")   → free plan
// - NEVER logs message content. Errors surface only HTTP status + error type.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const DEFAULT_SONNET_MODEL = "claude-sonnet-4-6";
export const DEFAULT_HAIKU_MODEL = "claude-haiku-4-5";

export function getModel(kind: "sonnet" | "haiku"): string {
  return kind === "sonnet"
    ? Deno.env.get("ANTHROPIC_MODEL_SONNET") || DEFAULT_SONNET_MODEL
    : Deno.env.get("ANTHROPIC_MODEL_HAIKU") || DEFAULT_HAIKU_MODEL;
}

// ---------------------------------------------------------------------------
// Request/response types (subset of the Messages API we actually use).
// ---------------------------------------------------------------------------

export interface CacheControl {
  type: "ephemeral";
}

export interface SystemBlock {
  type: "text";
  text: string;
  cache_control?: CacheControl;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface MessagesRequest {
  model: string;
  max_tokens: number;
  messages: ChatMessage[];
  system?: SystemBlock[];
  tools?: ToolDefinition[];
  tool_choice?: { type: "auto" | "any" | "none" } | { type: "tool"; name: string };
  temperature?: number;
  stream?: boolean;
}

export interface MessagesResponse {
  id: string;
  model: string;
  stop_reason: string | null;
  content: ContentBlock[];
  usage: Usage;
}

/** Streaming SSE events (parsed from the `data:` JSON payloads). */
export type StreamEvent =
  | { type: "message_start"; message: { model?: string; usage?: Usage } }
  | {
    type: "content_block_start";
    index: number;
    content_block: { type: string; id?: string; name?: string; text?: string };
  }
  | {
    type: "content_block_delta";
    index: number;
    delta: { type: string; text?: string; partial_json?: string };
  }
  | { type: "content_block_stop"; index: number }
  | { type: "message_delta"; delta: { stop_reason?: string | null }; usage?: Usage }
  | { type: "message_stop" }
  | { type: "ping" }
  | { type: "error"; error: { type?: string; message?: string } };

export class AnthropicError extends Error {
  constructor(
    readonly status: number,
    readonly errorType: string,
  ) {
    // Intentionally generic — no upstream message bodies (they could echo input).
    super(`Anthropic API error (${status}: ${errorType})`);
    this.name = "AnthropicError";
  }
}

function apiHeaders(): Record<string, string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");
  return {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "content-type": "application/json",
  };
}

async function throwApiError(res: Response): Promise<never> {
  let errorType = "api_error";
  try {
    const body = (await res.json()) as { error?: { type?: string } };
    if (body?.error?.type) errorType = body.error.type;
  } catch {
    // body unreadable — keep the generic type
  }
  throw new AnthropicError(res.status, errorType);
}

/** Single-shot (non-streaming) Messages API call. */
export async function createMessage(
  body: MessagesRequest,
  signal?: AbortSignal,
): Promise<MessagesResponse> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ ...body, stream: false }),
    signal: signal ?? null,
  });
  if (!res.ok) await throwApiError(res);
  return (await res.json()) as MessagesResponse;
}

/**
 * Streaming Messages API call. Yields parsed SSE events
 * (message_start, content_block_start/delta/stop, message_delta, message_stop, ping, error).
 */
export async function* streamMessage(
  body: MessagesRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ ...body, stream: true }),
    signal: signal ?? null,
  });
  if (!res.ok) await throwApiError(res);
  if (!res.body) throw new AnthropicError(502, "empty_stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line.
      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const event = parseSseEvent(rawEvent);
        if (event) yield event;
      }
    }
    // Flush any trailing event without a final blank line.
    const trailing = parseSseEvent(buffer);
    if (trailing) yield trailing;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // already closed
    }
  }
}

function parseSseEvent(raw: string): StreamEvent | null {
  const dataLines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  try {
    return JSON.parse(dataLines.join("\n")) as StreamEvent;
  } catch {
    return null; // ignore malformed keep-alive fragments
  }
}
