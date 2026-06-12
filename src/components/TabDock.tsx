import React from "react";
import { Pressable, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { fonts } from "@/constants/theme";
import { tap } from "@/lib/haptics";
import { useTheme } from "@/providers/theme";
import { Text } from "@/components/ui";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "flash",
  tasks: "checkmark-done",
  timeline: "calendar",
  subjects: "library",
  more: "ellipsis-horizontal",
};

function DockTab({
  label,
  icon,
  focused,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const active = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    active.value = reducedMotion
      ? focused
        ? 1
        : 0
      : withSpring(focused ? 1 : 0, { damping: 16, stiffness: 260 });
  }, [focused, active, reducedMotion]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 0.7 + active.value * 0.3 },
      { rotate: `${active.value * -4}deg` },
    ],
    opacity: active.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: active.value * -1.5 }],
  }));

  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: "100%" }}
    >
      <View style={{ width: 40, height: 32, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={[
            bubbleStyle,
            {
              pointerEvents: "none",
              position: "absolute",
              width: 40,
              height: 32,
              borderRadius: 10,
              backgroundColor: theme.volt,
              borderWidth: 1.5,
              borderColor: theme.border,
            },
          ]}
        />
        <Animated.View style={iconStyle}>
          <Ionicons
            name={icon}
            size={19}
            color={focused ? theme.onVolt : theme.inkMuted}
          />
        </Animated.View>
      </View>
      <Text
        style={{
          fontFamily: fonts.bodyBold,
          fontSize: 8.5,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: focused ? theme.ink : theme.inkFaint,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Floating dock — the app's bottom navigation. */
export function TabDock({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        pointerEvents: "box-none",
        position: "absolute",
        left: 0,
        right: 0,
        bottom: Math.max(insets.bottom, 10) + 4,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: "92%",
          maxWidth: 560,
          height: 68,
          flexDirection: "row",
          backgroundColor: theme.surface,
          borderWidth: 2,
          borderColor: theme.border,
          borderRadius: 22,
          // hard offset shadow
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 8,
          paddingHorizontal: 4,
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key] ?? {};
          const label =
            typeof options?.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options?.title ?? route.name);
          const focused = state.index === index;
          return (
            <DockTab
              key={route.key}
              label={label}
              icon={ICONS[route.name] ?? "ellipse"}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
