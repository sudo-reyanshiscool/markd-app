import React, { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { Slab, Text } from "@/components/ui";
import { subjectHex } from "@/constants/theme";
import { Subject, Task } from "@/db/schemas";
import { thud } from "@/lib/haptics";
import { useTheme } from "@/providers/theme";

import { DueBadge } from "@/features/home/components";

const COMPLETE_THRESHOLD = 72;

export interface TaskRowProps {
  task: Task;
  subject?: Subject;
  onComplete: (task: Task) => void;
  onUncomplete?: (task: Task) => void;
  onPress: (task: Task) => void;
}

/**
 * Swipe right to complete on touch devices (spec §7.3); the checkbox works
 * everywhere. Completion strikes the text, pops, then commits.
 */
export function TaskRow({ task, subject, onComplete, onUncomplete, onPress }: TaskRowProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const tx = useSharedValue(0);
  const [striking, setStriking] = useState(false);

  const commit = () => {
    thud();
    setStriking(true);
    setTimeout(() => onComplete(task), reducedMotion ? 60 : 420);
  };

  const pan = Gesture.Pan()
    .enabled(Platform.OS !== "web" && !task.done && !striking)
    .activeOffsetX([12, 9999])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      tx.value = Math.max(0, Math.min(e.translationX, 140));
    })
    .onEnd(() => {
      if (tx.value > COMPLETE_THRESHOLD) {
        tx.value = withTiming(0, { duration: 220 });
        runOnJS(commit)();
      } else {
        tx.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  const revealStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, tx.value / COMPLETE_THRESHOLD),
  }));

  const checked = task.done || striking;

  return (
    <View>
      {/* swipe reveal layer */}
      <Animated.View
        pointerEvents="none"
        style={[
          revealStyle,
          {
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 4,
            width: 130,
            borderRadius: 14,
            backgroundColor: theme.volt,
            borderWidth: 2,
            borderColor: theme.border,
            alignItems: "flex-start",
            justifyContent: "center",
            paddingLeft: 18,
          },
        ]}
      >
        <Ionicons name="checkmark-done" size={22} color={theme.onVolt} />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={slideStyle}>
          <Slab
            offset={3}
            radius={14}
            onPress={() => onPress(task)}
            haptic={false}
            accessibilityLabel={task.text}
            contentStyle={{
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              paddingHorizontal: 13,
              paddingVertical: 11,
            }}
          >
            <Pressable
              onPress={() => {
                if (checked && onUncomplete) {
                  onUncomplete(task);
                  setStriking(false);
                } else if (!checked) {
                  commit();
                }
              }}
              hitSlop={10}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={task.text}
              testID={`task-check-${task.id}`}
              style={{
                width: 26,
                height: 26,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: theme.border,
                backgroundColor: checked ? theme.volt : theme.well,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {checked ? <Ionicons name="checkmark" size={16} color={theme.onVolt} /> : null}
            </Pressable>

            {subject ? (
              <View
                style={{
                  width: 6,
                  alignSelf: "stretch",
                  borderRadius: 3,
                  backgroundColor: subjectHex(subject.color),
                  borderWidth: 1.2,
                  borderColor: theme.border,
                }}
              />
            ) : null}

            <View style={{ flex: 1, gap: 3 }}>
              <Text
                variant="bodyBold"
                numberOfLines={2}
                style={
                  checked
                    ? { textDecorationLine: "line-through", opacity: 0.45 }
                    : undefined
                }
              >
                {task.text}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {task.recurrence ? (
                  <Ionicons name="repeat" size={12} color={theme.inkMuted} />
                ) : null}
                {task.estimate_minutes ? (
                  <Text variant="monoSm" muted>
                    ~{task.estimate_minutes}M
                  </Text>
                ) : null}
                {task.priority !== 3 ? (
                  <Text
                    variant="monoSm"
                    color={task.priority >= 4 ? theme.danger : theme.inkFaint}
                  >
                    P{task.priority}
                  </Text>
                ) : null}
              </View>
            </View>

            {task.due_date && !checked ? <DueBadge dateISO={task.due_date} /> : null}
          </Slab>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
