import React, { useEffect } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { Subject } from "@/db/schemas";
import { thud } from "@/lib/haptics";
import { useTheme } from "@/providers/theme";

export const ROW_HEIGHT = 92;
const GAP = 12;
const SLOT = ROW_HEIGHT + GAP;

function clampWorklet(value: number, min: number, max: number): number {
  "worklet";
  return Math.max(min, Math.min(max, value));
}

function DragRow({
  subject,
  index,
  count,
  positions,
  draggingId,
  onCommit,
  renderCard,
}: {
  subject: Subject;
  index: number;
  count: number;
  positions: SharedValue<Record<string, number>>;
  draggingId: SharedValue<string | null>;
  onCommit: (order: Record<string, number>) => void;
  renderCard: (subject: Subject, dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const theme = useTheme();
  const dragY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // keep shared position in sync when the list re-sorts from data
  useEffect(() => {
    positions.value = { ...positions.value, [subject.id]: index };
  }, [index, positions, subject.id]);

  const pan = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      isDragging.value = true;
      draggingId.value = subject.id;
      runOnJS(thud)();
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      const myPos = positions.value[subject.id] ?? index;
      const target = clampWorklet(
        Math.round((myPos * SLOT + e.translationY) / SLOT),
        0,
        count - 1,
      );
      if (target !== myPos) {
        const next = { ...positions.value };
        for (const id in next) {
          if (id === subject.id) continue;
          const p = next[id] ?? 0;
          if (myPos < target && p > myPos && p <= target) next[id] = p - 1;
          else if (myPos > target && p >= target && p < myPos) next[id] = p + 1;
        }
        next[subject.id] = target;
        positions.value = next;
        dragY.value = e.translationY - (target - myPos) * SLOT;
      }
    })
    .onEnd(() => {
      dragY.value = withSpring(0, { damping: 24, stiffness: 320 });
      isDragging.value = false;
      draggingId.value = null;
      runOnJS(onCommit)(positions.value);
    });

  const style = useAnimatedStyle(() => {
    const myPos = positions.value[subject.id] ?? index;
    const baseY = myPos * SLOT;
    return {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      zIndex: isDragging.value ? 10 : 1,
      transform: [
        {
          translateY: isDragging.value
            ? baseY + dragY.value
            : withTiming(baseY, { duration: 180 }),
        },
        { scale: withTiming(isDragging.value ? 1.03 : 1, { duration: 140 }) },
        { rotate: withTiming(isDragging.value ? "-1deg" : "0deg", { duration: 140 }) },
      ],
    };
  });

  const handle = (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={{
          width: 38,
          height: 38,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: theme.border,
          backgroundColor: theme.well,
        }}
        accessible
        accessibilityLabel={`Reorder ${subject.name}`}
        accessibilityHint="Long-press and drag"
      >
        <Ionicons name="reorder-three" size={20} color={theme.inkMuted} />
      </Animated.View>
    </GestureDetector>
  );

  return (
    <Animated.View style={style}>{renderCard(subject, handle)}</Animated.View>
  );
}

/** Long-press-drag reorder list (spec §7.2) — persists via onCommit. */
export function SubjectDragList({
  subjects,
  onReorder,
  renderCard,
}: {
  subjects: Subject[];
  onReorder: (orderedIds: string[]) => void;
  renderCard: (subject: Subject, dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(subjects.map((s, i) => [s.id, i])),
  );
  const draggingId = useSharedValue<string | null>(null);

  const commit = (order: Record<string, number>) => {
    const ids = Object.entries(order)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id)
      .filter((id) => subjects.some((s) => s.id === id));
    const current = subjects.map((s) => s.id);
    if (JSON.stringify(ids) !== JSON.stringify(current)) onReorder(ids);
  };

  return (
    <View style={{ height: subjects.length * SLOT, position: "relative" }}>
      {subjects.map((subject, index) => (
        <DragRow
          key={subject.id}
          subject={subject}
          index={index}
          count={subjects.length}
          positions={positions}
          draggingId={draggingId}
          onCommit={commit}
          renderCard={renderCard}
        />
      ))}
    </View>
  );
}
