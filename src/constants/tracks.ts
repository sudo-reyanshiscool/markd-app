import { ExamTrack } from "@/db/schemas";

/** Exam tracks + year-group options (spec §6 step 4–5). */
export const TRACKS: { value: ExamTrack; label: string }[] = [
  { value: "gcse", label: "GCSE" },
  { value: "igcse", label: "IGCSE" },
  { value: "ib", label: "IB" },
  { value: "alevel", label: "A-Level" },
  { value: "other", label: "Other" },
];

export const YEAR_GROUPS: Record<ExamTrack, string[]> = {
  gcse: ["Year 9", "Year 10", "Year 11"],
  igcse: ["Year 9", "Year 10", "Year 11"],
  ib: ["MYP4", "MYP5", "DP1", "DP2"],
  alevel: ["Lower Sixth", "Upper Sixth"],
  other: ["Year 9", "Year 10", "Year 11", "Year 12", "Year 13"],
};

export const STARTER_TASKS: { text: string; priority: number }[] = [
  { text: "Skim this week's lesson notes", priority: 3 },
  { text: "Plan your study schedule", priority: 4 },
  { text: "Try a past paper question", priority: 2 },
];
