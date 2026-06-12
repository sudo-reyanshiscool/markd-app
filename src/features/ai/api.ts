import { Platform } from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/**
 * Client for the AI Edge Functions (contract: supabase/functions/SETUP.md).
 *
 * ai-chat streams SSE frames: `delta {text}` → `tool {name,status}` →
 * exactly one of `done {…}` / `error {message}`.
 */

export class AiUnavailableError extends Error {
  constructor() {
    super("AI backend not configured");
    this.name = "AiUnavailableError";
  }
}

export interface ChatCallbacks {
  onDelta: (text: string) => void;
  onTool: (name: string, status: "running" | "ok" | "error") => void;
  onDone: (meta: {
    conversation_id: string;
    message_id: string | null;
    tokens_in: number;
    tokens_out: number;
    model: string;
  }) => void;
  onError: (message: string) => void;
}

async function authHeader(): Promise<string> {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AiUnavailableError();
  return `Bearer ${token}`;
}

function functionUrl(name: string): string {
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/${name}`;
}

/** Streaming chat. Returns an abort function. */
export async function streamChat(
  message: string,
  conversationId: string | null,
  callbacks: ChatCallbacks,
): Promise<() => void> {
  if (!isSupabaseConfigured || !supabase) throw new AiUnavailableError();

  const controller = new AbortController();
  const auth = await authHeader();

  // expo/fetch supports streaming bodies on native; standard fetch on web.
  const fetchImpl: typeof fetch =
    Platform.OS === "web"
      ? fetch
      : ((require("expo/fetch") as { fetch: typeof fetch }).fetch ?? fetch);

  void (async () => {
    try {
      const res = await fetchImpl(functionUrl("ai-chat"), {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(
          conversationId ? { conversation_id: conversationId, message } : { message },
        ),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        callbacks.onError(body?.error?.message ?? `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawTerminal = false;

      const handleFrame = (frame: string) => {
        const eventMatch = /^event:\s*(.+)$/m.exec(frame);
        const dataMatch = /^data:\s*(.+)$/m.exec(frame);
        if (!eventMatch || !dataMatch) return;
        const event = eventMatch[1]?.trim();
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(dataMatch[1] ?? "{}") as Record<string, unknown>;
        } catch {
          return;
        }
        if (event === "delta" && typeof data.text === "string") {
          callbacks.onDelta(data.text);
        } else if (event === "tool" && typeof data.name === "string") {
          callbacks.onTool(
            data.name,
            (data.status as "running" | "ok" | "error") ?? "running",
          );
        } else if (event === "done") {
          sawTerminal = true;
          callbacks.onDone(data as Parameters<ChatCallbacks["onDone"]>[0]);
        } else if (event === "error") {
          sawTerminal = true;
          callbacks.onError(String(data.message ?? "AI error"));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep = buffer.indexOf("\n\n");
        while (sep >= 0) {
          handleFrame(buffer.slice(0, sep));
          buffer = buffer.slice(sep + 2);
          sep = buffer.indexOf("\n\n");
        }
      }
      if (!sawTerminal) callbacks.onError("Connection closed");
    } catch (e) {
      if (!controller.signal.aborted) {
        callbacks.onError(e instanceof Error ? e.message : "Network error");
      }
    }
  })();

  return () => controller.abort();
}

/** Pro: turn a syllabus into a topic tree (persists server-side for exams). */
export async function runSyllabusBreakdown(
  examId?: string,
  specId?: string,
): Promise<unknown> {
  if (!isSupabaseConfigured || !supabase) throw new AiUnavailableError();
  const auth = await authHeader();
  const res = await fetch(functionUrl("ai-syllabus-breakdown"), {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(examId ? { exam_id: examId } : { spec_id: specId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/** Pro: create/revoke the parent share link. */
export async function createShareLink(): Promise<{ slug: string; url: string; expires_at: string }> {
  if (!isSupabaseConfigured || !supabase) throw new AiUnavailableError();
  const auth = await authHeader();
  const res = await fetch(functionUrl("share-create"), {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ slug: string; url: string; expires_at: string }>;
}

export async function revokeShareLink(slug: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new AiUnavailableError();
  const auth = await authHeader();
  await fetch(functionUrl("share-create"), {
    method: "DELETE",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  });
}

/** GDPR export: triggers a zip download (web) / share sheet (native). */
export async function requestDataExport(): Promise<Blob> {
  if (!isSupabaseConfigured || !supabase) throw new AiUnavailableError();
  const auth = await authHeader();
  const res = await fetch(functionUrl("data-export"), {
    method: "POST",
    headers: { Authorization: auth },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

/** GDPR delete: removes the account + everything attached. */
export async function requestAccountDelete(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new AiUnavailableError();
  const auth = await authHeader();
  const res = await fetch(functionUrl("account-delete"), {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}

/** Calendar feed sync via the Edge Function. */
export async function syncCalendarFeed(
  input: { url: string; label?: string } | { feed_id: string },
): Promise<{ feed: { id: string; status: string; last_event_count: number | null }; imported: number }> {
  if (!isSupabaseConfigured || !supabase) throw new AiUnavailableError();
  const auth = await authHeader();
  const res = await fetch(functionUrl("calendar-import"), {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{
    feed: { id: string; status: string; last_event_count: number | null };
    imported: number;
  }>;
}
