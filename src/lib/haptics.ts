import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const canBuzz = Platform.OS === "ios" || Platform.OS === "android";

/** Light tick — presses, toggles, selections. */
export function tap(): void {
  if (!canBuzz) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium thud — completing things, drops. */
export function thud(): void {
  if (!canBuzz) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Celebration — streak saved, level up, timer done. */
export function cheer(): void {
  if (!canBuzz) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
}

export function buzzWarn(): void {
  if (!canBuzz) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
    () => {},
  );
}
