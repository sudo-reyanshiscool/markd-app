import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, space } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

import { IconButton } from "./IconButton";
import { Reveal } from "./Reveal";
import { Text } from "./Text";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Max content height ratio on phones. */
  maxRatio?: number;
}

/**
 * Bottom sheet on phones, centered dialog on wide screens.
 * Scrim tap + close button both dismiss.
 */
export function Sheet({ open, onClose, title, children, maxRatio = 0.86 }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;

  if (!open) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Reveal from="fade" distance={0} style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: theme.scrim }}
          onPress={onClose}
          accessibilityLabel="Close sheet"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[
            {
              pointerEvents: "box-none",
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
            },
            wide
              ? { alignItems: "center", justifyContent: "center" }
              : { justifyContent: "flex-end" },
          ]}
        >
          <Pressable
            // swallow taps on the panel so they don't hit the scrim
            onPress={() => {}}
            style={wide ? undefined : { width: "100%" }}
          >
            <Reveal from={wide ? "scale" : "bottom"} distance={48}>
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderWidth: 2,
                  borderTopLeftRadius: radius.sheet,
                  borderTopRightRadius: radius.sheet,
                  borderBottomLeftRadius: wide ? radius.sheet : 0,
                  borderBottomRightRadius: wide ? radius.sheet : 0,
                  width: wide ? 520 : "100%",
                  maxHeight: height * maxRatio,
                  paddingBottom: wide ? space.xl : Math.max(insets.bottom, space.lg),
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: space.xl,
                    paddingTop: space.xl,
                    paddingBottom: space.md,
                  }}
                >
                  {title ? (
                    <Text variant="display" style={{ flex: 1, marginRight: 12 }}>
                      {title}
                    </Text>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}
                  <IconButton icon="close" onPress={onClose} label="Close" size={38} />
                </View>
                <ScrollView
                  contentContainerStyle={{
                    paddingHorizontal: space.xl,
                    paddingBottom: space.md,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
              </View>
            </Reveal>
          </Pressable>
        </KeyboardAvoidingView>
      </Reveal>
    </Modal>
  );
}
