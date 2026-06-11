import React from "react";
import {
  Text as RNText,
  StyleProp,
  TextProps as RNTextProps,
  TextStyle,
} from "react-native";

import { fonts } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

export type TextVariant =
  | "displayXL" // hero numerals, big moments
  | "display" // screen titles
  | "title" // card titles (Unbounded)
  | "heading" // section headings (Bricolage bold)
  | "body"
  | "bodyMedium"
  | "bodyBold"
  | "caption"
  | "label" // uppercase eyebrow
  | "mono" // stat digits
  | "monoSm";

const variantStyles: Record<TextVariant, TextStyle> = {
  displayXL: {
    fontFamily: fonts.displayHeavy,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  display: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  title: { fontFamily: fonts.display, fontSize: 16, lineHeight: 22 },
  heading: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15.5, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 22 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  mono: { fontFamily: fonts.monoBold, fontSize: 16, lineHeight: 22 },
  monoSm: { fontFamily: fonts.monoBold, fontSize: 12, lineHeight: 16 },
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** Explicit color; otherwise ink (or muted/faint shortcuts). */
  color?: string;
  muted?: boolean;
  faint?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Text({
  variant = "body",
  color,
  muted,
  faint,
  center,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const resolved =
    color ?? (faint ? theme.inkFaint : muted ? theme.inkMuted : theme.ink);
  return (
    <RNText
      {...rest}
      style={[
        variantStyles[variant],
        { color: resolved },
        center ? { textAlign: "center" } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
