import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";

import { fonts } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

export interface TrendPoint {
  /** 0..100 */
  value: number;
  label?: string;
}

/**
 * Hand-rolled score-trend chart (papers): hard grid, chunky volt line,
 * ink dots. Deliberately simple — no chart-lib config drift across
 * platforms, fully theme-aware.
 */
export function TrendChart({
  points,
  height = 140,
  color,
}: {
  points: TrendPoint[];
  height?: number;
  color?: string;
}) {
  const theme = useTheme();
  const stroke = color ?? theme.volt;
  const W = 320;
  const H = height;
  const PAD = { top: 12, right: 10, bottom: 22, left: 30 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xs = points.map((_, i) =>
    points.length === 1
      ? PAD.left + innerW / 2
      : PAD.left + (i / (points.length - 1)) * innerW,
  );
  const ys = points.map((p) => PAD.top + (1 - Math.max(0, Math.min(100, p.value)) / 100) * innerH);
  const poly = xs.map((x, i) => `${x},${ys[i]}`).join(" ");

  return (
    <View accessible accessibilityLabel={`Score trend across ${points.length} papers`}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {[0, 25, 50, 75, 100].map((g) => {
          const y = PAD.top + (1 - g / 100) * innerH;
          return (
            <React.Fragment key={g}>
              <Line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke={theme.inkFaint}
                strokeWidth={g === 0 ? 1.6 : 0.7}
                strokeDasharray={g === 0 ? undefined : "3 5"}
                opacity={0.5}
              />
              <SvgText
                x={PAD.left - 6}
                y={y + 3.5}
                fontSize={8.5}
                fontFamily={fonts.monoBold}
                fill={theme.inkFaint}
                textAnchor="end"
              >
                {g}
              </SvgText>
            </React.Fragment>
          );
        })}
        {points.length > 1 ? (
          <Polyline
            points={poly}
            fill="none"
            stroke={stroke}
            strokeWidth={3.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {xs.map((x, i) => (
          <React.Fragment key={i}>
            <Circle
              cx={x}
              cy={ys[i]}
              r={5}
              fill={stroke}
              stroke={theme.border}
              strokeWidth={2}
            />
            {points[i]?.label ? (
              <SvgText
                x={x}
                y={H - 6}
                fontSize={8}
                fontFamily={fonts.monoBold}
                fill={theme.inkMuted}
                textAnchor="middle"
              >
                {points[i]?.label}
              </SvgText>
            ) : null}
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}
