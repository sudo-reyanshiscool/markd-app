import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { space } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

import { DotGrid } from "./DotGrid";

export interface ScreenProps {
  children: React.ReactNode;
  /** Wrap children in a ScrollView. */
  scroll?: boolean;
  /** Extra bottom padding so content clears the floating tab dock. */
  dock?: boolean;
  /** Pull-to-refresh handler (scroll only). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Disable the dot-grid texture (e.g. focus timer takeover). */
  plain?: boolean;
  /** Override background color. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edgesTop?: boolean;
  testID?: string;
}

const MAX_WIDTH = 768;

export function Screen({
  children,
  scroll = false,
  dock = false,
  onRefresh,
  refreshing = false,
  plain = false,
  color,
  style,
  contentStyle,
  edgesTop = true,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padTop = edgesTop ? insets.top + space.sm : space.sm;
  const padBottom = dock ? 118 + insets.bottom : insets.bottom + space.xl;

  const frame: ViewStyle = {
    flex: 1,
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: space.lg,
  };

  const body = scroll ? (
    <ScrollView
      style={frame}
      contentContainerStyle={[
        { paddingTop: padTop, paddingBottom: padBottom },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.ink}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        frame,
        { paddingTop: padTop, paddingBottom: dock ? 118 + insets.bottom : 0 },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View
      style={[{ flex: 1, backgroundColor: color ?? theme.bg }, style]}
      testID={testID}
    >
      {!plain ? <DotGrid /> : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </View>
  );
}
