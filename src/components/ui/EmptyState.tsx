import React from "react";
import { View } from "react-native";

import { space } from "@/constants/theme";

import { Button } from "./Button";
import { Doodle, DoodleKind } from "./Doodle";
import { Reveal } from "./Reveal";
import { Text } from "./Text";

export interface EmptyStateProps {
  title: string;
  body?: string;
  doodle?: DoodleKind;
  cta?: string;
  onCta?: () => void;
  compact?: boolean;
}

export function EmptyState({
  title,
  body,
  doodle = "star",
  cta,
  onCta,
  compact = false,
}: EmptyStateProps) {
  return (
    <Reveal
      from="bottom"
      style={{
        alignItems: "center",
        paddingVertical: compact ? space.xl : space.jumbo,
        paddingHorizontal: space.xl,
        gap: space.md,
      }}
    >
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Doodle kind={doodle} size={34} rotate={-12} />
        <Doodle kind={doodle} size={22} rotate={18} style={{ marginTop: 14 }} />
      </View>
      <Text variant="display" center>
        {title}
      </Text>
      {body ? (
        <Text variant="body" muted center style={{ maxWidth: 320 }}>
          {body}
        </Text>
      ) : null}
      {cta && onCta ? (
        <Button label={cta} onPress={onCta} style={{ marginTop: space.sm }} />
      ) : null}
    </Reveal>
  );
}
