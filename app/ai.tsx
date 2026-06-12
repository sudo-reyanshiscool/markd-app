import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  Chip,
  IconButton,
  Input,
  Reveal,
  Screen,
  ScreenHeader,
  Sheet,
  Slab,
  Stamp,
  Text,
} from "@/components/ui";
import { AiMessage } from "@/db/schemas";
import { LiveToolRun, useChat } from "@/features/ai/useChat";
import { usePlan } from "@/hooks/useEntitlement";
import { PLAN_LIMITS } from "@/lib/entitlements";
import { useTheme } from "@/providers/theme";

function Bubble({ message }: { message: Pick<AiMessage, "role" | "content"> }) {
  const theme = useTheme();
  const isUser = message.role === "user";
  if (message.role === "tool") return null;
  return (
    <View
      style={{
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      <Slab
        color={isUser ? theme.ink : theme.surface}
        radius={18}
        offset={3}
        style={{ maxWidth: "88%" }}
        contentStyle={{ paddingHorizontal: 14, paddingVertical: 10 }}
      >
        <Text
          variant="body"
          color={isUser ? (theme.name === "light" ? "#FFFDF7" : "#16140F") : theme.ink}
        >
          {message.content}
        </Text>
      </Slab>
    </View>
  );
}

function ToolChips({ tools }: { tools: LiveToolRun[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (!tools.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
      {tools.map((tool) => (
        <View
          key={tool.name}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            borderWidth: 1.5,
            borderColor: theme.border,
            borderRadius: 999,
            paddingHorizontal: 9,
            height: 24,
            backgroundColor:
              tool.status === "ok"
                ? theme.volt
                : tool.status === "error"
                  ? theme.danger
                  : theme.well,
          }}
        >
          <Ionicons
            name={tool.status === "running" ? "sync" : tool.status === "ok" ? "checkmark" : "alert"}
            size={11}
            color="#16140F"
          />
          <Text variant="monoSm" style={{ fontSize: 10 }} color="#16140F">
            {t("ai.toolRan", { name: tool.name })}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function AiChat() {
  const { t } = useTranslation();
  const theme = useTheme();
  const chat = useChat();
  const plan = usePlan();
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [chat.messages.length, chat.liveText, chat.pendingUserText]);

  const submit = () => {
    const text = draft;
    setDraft("");
    void chat.send(text);
  };

  const empty = chat.messages.length === 0 && !chat.pendingUserText;

  return (
    <Screen>
      <ScreenHeader
        title={t("ai.title")}
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <IconButton icon="time" label={t("ai.history")} onPress={() => setHistoryOpen(true)} />
            <IconButton icon="add" label={t("ai.newChat")} onPress={() => chat.newChat()} />
          </View>
        }
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!chat.online ? (
          <Reveal>
            <Slab shadow={false} color={theme.well} contentStyle={{ padding: 12 }} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Stamp label={t("ai.offlineTitle")} size="sm" rotate={-2} />
              </View>
              <Text variant="caption" muted style={{ marginTop: 8 }}>
                {t("ai.offlineBody")}
              </Text>
            </Slab>
          </Reveal>
        ) : (
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 }}>
            <Text variant="monoSm" faint>
              {t("ai.model").toUpperCase()}: {PLAN_LIMITS[plan].aiModelLabel.toUpperCase()}
            </Text>
          </View>
        )}

        {empty ? (
          <Reveal delay={60} style={{ gap: 14, marginTop: 20 }}>
            <Text variant="display">{t("ai.emptyTitle")}</Text>
            <Text variant="body" muted style={{ maxWidth: 420 }}>
              {t("ai.emptySub")}
            </Text>
            <View style={{ gap: 8, marginTop: 6 }}>
              {[t("ai.suggestion1"), t("ai.suggestion2"), t("ai.suggestion3")].map((s) => (
                <Chip key={s} label={s} icon="sparkles" onPress={() => void chat.send(s)} />
              ))}
            </View>
          </Reveal>
        ) : (
          <>
            {chat.messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {chat.pendingUserText ? (
              <Bubble message={{ role: "user", content: chat.pendingUserText }} />
            ) : null}
            <ToolChips tools={chat.liveTools} />
            {chat.liveText ? (
              <Bubble message={{ role: "assistant", content: chat.liveText }} />
            ) : chat.streaming ? (
              <View style={{ flexDirection: "row", gap: 4, paddingLeft: 6, marginBottom: 12 }}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.inkFaint,
                    }}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}

        {chat.error ? (
          <Text variant="caption" color={theme.danger} style={{ marginBottom: 10 }}>
            {chat.error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingBottom: 8 }}>
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder={t("ai.placeholder")}
          onSubmitEditing={submit}
          returnKeyType="send"
          containerStyle={{ flex: 1 }}
          testID="ai-input"
        />
        <Slab
          color={chat.streaming ? theme.danger : theme.volt}
          onPress={chat.streaming ? chat.stop : submit}
          disabled={!chat.streaming && !draft.trim()}
          radius={14}
          accessibilityLabel={chat.streaming ? t("common.cancel") : t("ai.send")}
          contentStyle={{ width: 50, height: 50, alignItems: "center", justifyContent: "center" }}
          testID="ai-send"
        >
          <Ionicons
            name={chat.streaming ? "stop" : "arrow-up"}
            size={22}
            color={chat.streaming ? theme.onDanger : theme.onVolt}
          />
        </Slab>
      </View>
      <Text variant="monoSm" faint center style={{ paddingBottom: 6, fontSize: 9.5 }}>
        {t("ai.disclaimer")}
      </Text>

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title={t("ai.history")}>
        <View style={{ gap: 8, paddingBottom: 10 }}>
          {chat.conversations.length === 0 ? (
            <Text variant="caption" muted>
              —
            </Text>
          ) : (
            chat.conversations.map((conv) => (
              <Slab
                key={conv.id}
                shadow={false}
                color={conv.id === chat.conversationId ? theme.volt : theme.well}
                radius={12}
                onPress={() => {
                  chat.setConversationId(conv.id);
                  setHistoryOpen(false);
                }}
                contentStyle={{ padding: 12 }}
              >
                <Text
                  variant="bodyMedium"
                  color={conv.id === chat.conversationId ? theme.onVolt : theme.ink}
                  numberOfLines={1}
                >
                  {conv.title ?? "…"}
                </Text>
              </Slab>
            ))
          )}
        </View>
      </Sheet>
    </Screen>
  );
}
