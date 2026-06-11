import React from "react";
import { View } from "react-native";

import { fonts } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

import { Slab } from "./Slab";
import { Text } from "./Text";

/** The MARKD logotype: ink letters with the final D on a tilted volt sticker. */
export function Wordmark({ size = 28 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel="Markd"
      style={{ flexDirection: "row", alignItems: "center" }}
    >
      <Text
        style={{
          fontFamily: fonts.displayBlack,
          fontSize: size,
          letterSpacing: -1,
          color: theme.ink,
        }}
      >
        MARK
      </Text>
      <Slab
        color={theme.volt}
        rotate={6}
        offset={Math.max(2, Math.round(size / 12))}
        radius={Math.round(size / 4)}
        style={{ marginLeft: 2, marginTop: -2 }}
        contentStyle={{
          paddingHorizontal: Math.round(size / 4.5),
          paddingVertical: Math.round(size / 14),
        }}
      >
        <Text
          style={{
            fontFamily: fonts.displayBlack,
            fontSize: size,
            color: theme.onVolt,
          }}
        >
          D
        </Text>
      </Slab>
    </View>
  );
}
