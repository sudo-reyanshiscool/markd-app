import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useBackend, useDataScope } from "@/lib/backend";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSessionStore } from "@/stores/session";
import { useEntityList } from "@/hooks/useEntities";
import { doNext } from "@/utils/ranking";

import { streamChat } from "./api";

export interface LiveToolRun {
  name: string;
  status: "running" | "ok" | "error";
}

/**
 * Chat state machine. Authed + configured → real streaming via the ai-chat
 * Edge Function. Guest / keyless dev → clearly-labelled offline demo
 * responder (no fake AI: it says exactly what it is).
 */
export function useChat() {
  const { t } = useTranslation();
  const backend = useBackend();
  const scope = useDataScope();
  const queryClient = useQueryClient();
  const mode = useSessionStore((s) => s.mode);

  const conversations = useEntityList("ai_conversations");
  const messages = useEntityList("ai_messages");
  const tasks = useEntityList("tasks");

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [liveText, setLiveText] = useState<string>("");
  const [liveTools, setLiveTools] = useState<LiveToolRun[]>([]);
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const online = isSupabaseConfigured && mode === "authed";

  const currentMessages = useMemo(() => {
    const all = (messages.data ?? []).filter(
      (m) => m.conversation_id === conversationId,
    );
    return all.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }, [messages.data, conversationId]);

  const sortedConversations = useMemo(
    () =>
      [...(conversations.data ?? [])].sort((a, b) =>
        (a.updated_at ?? a.created_at) > (b.updated_at ?? b.created_at) ? -1 : 1,
      ),
    [conversations.data],
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [scope, "ai_messages"] });
    void queryClient.invalidateQueries({ queryKey: [scope, "ai_conversations"] });
  }, [queryClient, scope]);

  /** Offline demo: persists a transparent scripted exchange locally. */
  const sendOffline = useCallback(
    async (text: string) => {
      let convId = conversationId;
      if (!convId) {
        const conv = await backend.insert("ai_conversations", {
          title: text.slice(0, 60),
        });
        convId = conv.id;
        setConversationId(convId);
      }
      await backend.insert("ai_messages", {
        conversation_id: convId,
        role: "user",
        content: text,
        tool_calls: null,
        tokens_in: null,
        tokens_out: null,
        model: null,
      });
      const top = doNext(tasks.data ?? []);
      const reply = top
        ? t("ai.offlineReply", { task: top.text })
        : t("ai.offlineReplyNoTasks");
      await backend.insert("ai_messages", {
        conversation_id: convId,
        role: "assistant",
        content: reply,
        tool_calls: null,
        tokens_in: null,
        tokens_out: null,
        model: "offline-demo",
      });
      invalidate();
    },
    [backend, conversationId, invalidate, t, tasks.data],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      setError(null);

      if (!online) {
        await sendOffline(trimmed);
        return;
      }

      setStreaming(true);
      setPendingUserText(trimmed);
      setLiveText("");
      setLiveTools([]);

      try {
        abortRef.current = await streamChat(trimmed, conversationId, {
          onDelta: (chunk) => setLiveText((prev) => prev + chunk),
          onTool: (name, status) =>
            setLiveTools((prev) => {
              const existing = prev.findIndex((tool) => tool.name === name);
              if (existing >= 0) {
                const next = [...prev];
                next[existing] = { name, status };
                return next;
              }
              return [...prev, { name, status }];
            }),
          onDone: (meta) => {
            setStreaming(false);
            setPendingUserText(null);
            setLiveText("");
            setLiveTools([]);
            setConversationId(meta.conversation_id);
            invalidate();
            // data mutations may have happened via tools
            void queryClient.invalidateQueries({ queryKey: [scope] });
          },
          onError: (message) => {
            setStreaming(false);
            setError(message);
          },
        });
      } catch (e) {
        setStreaming(false);
        setError(e instanceof Error ? e.message : "error");
      }
    },
    [conversationId, invalidate, online, queryClient, scope, sendOffline, streaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.();
    setStreaming(false);
  }, []);

  const newChat = useCallback(() => {
    stop();
    setConversationId(null);
    setLiveText("");
    setLiveTools([]);
    setError(null);
    setPendingUserText(null);
  }, [stop]);

  return {
    online,
    conversations: sortedConversations,
    conversationId,
    setConversationId,
    messages: currentMessages,
    pendingUserText,
    liveText,
    liveTools,
    streaming,
    error,
    send,
    stop,
    newChat,
  };
}
