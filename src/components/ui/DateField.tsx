import React, { useState } from "react";
import { Platform, Pressable, StyleProp, View, ViewStyle } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { edge, fonts, radius } from "@/constants/theme";
import { formatDateShort, isoDate, parseISODate } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { Text } from "./Text";

export interface DateFieldProps {
  /** ISO yyyy-mm-dd or null. */
  value: string | null;
  onChange: (next: string | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  clearable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Native date picker field (web has its own DateField.web.tsx). */
export function DateField({
  value,
  onChange,
  label,
  placeholder = "Pick a date",
  error,
  clearable = true,
  containerStyle,
}: DateFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(parseISODate(value) ?? new Date());

  const display = value ? formatDateShort(value) : placeholder;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" muted style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          setDraft(parseISODate(value) ?? new Date());
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={label ?? "Date"}
        style={{
          backgroundColor: theme.well,
          borderWidth: edge.borderWidth,
          borderColor: error ? theme.danger : theme.border,
          borderRadius: radius.input,
          height: 50,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.monoBold,
            fontSize: 14,
            color: value ? theme.ink : theme.inkFaint,
          }}
        >
          {display}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {clearable && value ? (
            <Pressable
              onPress={() => onChange(null)}
              hitSlop={8}
              accessibilityLabel="Clear date"
            >
              <Ionicons name="close-circle" size={18} color={theme.inkFaint} />
            </Pressable>
          ) : null}
          <Ionicons name="calendar" size={18} color={theme.inkMuted} />
        </View>
      </Pressable>
      {error ? (
        <Text variant="caption" color={theme.danger} style={{ marginTop: 5 }}>
          {error}
        </Text>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title={label ?? "Date"}>
        <View style={{ alignItems: "center" }}>
          <DateTimePicker
            value={draft}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_, picked) => {
              if (Platform.OS === "android") {
                setOpen(false);
                if (picked) onChange(isoDate(picked));
                return;
              }
              if (picked) setDraft(picked);
            }}
            themeVariant={theme.name}
            accentColor={theme.name === "light" ? theme.ink : theme.volt}
          />
        </View>
        {Platform.OS === "ios" ? (
          <Button
            label="Set date"
            block
            onPress={() => {
              onChange(isoDate(draft));
              setOpen(false);
            }}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}
