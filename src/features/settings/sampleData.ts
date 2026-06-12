import { Backend } from "@/lib/backend";
import { daysAgoISO, addDays, todayISO } from "@/utils/dates";

/**
 * Demo dataset: a believable revision week. Used from Settings in guest
 * mode (and harmless when signed in) so the dashboard can be explored
 * without typing twenty things first.
 */
export async function loadSampleData(backend: Backend): Promise<void> {
  const today = todayISO();
  const existing = await backend.list("subjects");

  /** Reuse a same-named subject (e.g. created during onboarding). */
  const ensureSubject = async (row: {
    name: string;
    board: string;
    target_grade: string;
    color: string;
    position: number;
  }) => {
    const found = existing.find(
      (s) => s.name.trim().toLowerCase() === row.name.toLowerCase(),
    );
    if (found) {
      return backend.update("subjects", found.id, {
        board: found.board ?? row.board,
        target_grade: found.target_grade ?? row.target_grade,
      });
    }
    return backend.insert("subjects", { ...row, archived_at: null });
  };

  const maths = await ensureSubject({
    name: "Mathematics",
    board: "Edexcel",
    target_grade: "8",
    color: "sky",
    position: 0,
  });
  const english = await ensureSubject({
    name: "English Literature",
    board: "AQA",
    target_grade: "7",
    color: "bubblegum",
    position: 1,
  });
  const physics = await ensureSubject({
    name: "Physics",
    board: "AQA",
    target_grade: "9",
    color: "volt",
    position: 2,
  });

  // tasks — a mix of due states and priorities
  const taskRows: {
    text: string;
    subject: string | null;
    due: string | null;
    priority: number;
    estimate: number | null;
    done?: boolean;
    doneDaysAgo?: number;
  }[] = [
    { text: "Finish quadratics worksheet", subject: maths.id, due: today, priority: 4, estimate: 40 },
    { text: "Annotate Macbeth Act 3", subject: english.id, due: addDays(today, 1), priority: 3, estimate: 60 },
    { text: "Forces past paper Q1–6", subject: physics.id, due: addDays(today, 2), priority: 5, estimate: 90 },
    { text: "Flashcards: circle theorems", subject: maths.id, due: addDays(today, 4), priority: 2, estimate: 25 },
    { text: "Plan poetry comparison essay", subject: english.id, due: addDays(today, 6), priority: 3, estimate: 45 },
    { text: "Sort folder + print specs", subject: null, due: null, priority: 1, estimate: 15 },
    { text: "Revise electricity formulas", subject: physics.id, due: null, priority: 3, estimate: 30, done: true, doneDaysAgo: 0 },
    { text: "Read Jekyll & Hyde ch. 4", subject: english.id, due: null, priority: 2, estimate: 30, done: true, doneDaysAgo: 1 },
    { text: "Trig practice set", subject: maths.id, due: null, priority: 3, estimate: 45, done: true, doneDaysAgo: 2 },
    { text: "Mind-map energy stores", subject: physics.id, due: null, priority: 2, estimate: 20, done: true, doneDaysAgo: 3 },
  ];
  for (const row of taskRows) {
    const completedAt =
      row.done && row.doneDaysAgo != null
        ? new Date(Date.now() - row.doneDaysAgo * 86_400_000 - 3_600_000).toISOString()
        : null;
    await backend.insert("tasks", {
      text: row.text,
      subject_id: row.subject,
      due_date: row.due,
      priority: row.priority,
      estimate_minutes: row.estimate,
      topic: null,
      recurrence: null,
      done: Boolean(row.done),
      snoozed_until: null,
      completed_at: completedAt,
    });
  }

  // study sessions — keep the streak warm
  for (const [daysAgo, minutes] of [
    [0, 25],
    [1, 45],
    [2, 25],
    [3, 60],
  ] as const) {
    await backend.insert("study_sessions", {
      subject_id: daysAgo % 2 === 0 ? maths.id : physics.id,
      task_id: null,
      minutes,
      started_at: new Date(Date.now() - daysAgo * 86_400_000 - minutes * 60_000).toISOString(),
      completed_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    });
  }

  // deadlines + exams
  await backend.insert("deadlines", {
    title: "Biology coursework draft",
    subject_id: null,
    date: addDays(today, 3),
    notes: "Email to Dr. Shah by 4pm",
  });
  await backend.insert("deadlines", {
    title: "UCAS personal statement v1",
    subject_id: english.id,
    date: addDays(today, 9),
    notes: null,
  });
  await backend.insert("exams", {
    name: "Maths Paper 1 (Non-calc)",
    subject_id: maths.id,
    board: "Edexcel",
    date: addDays(today, 18),
    location: "Sports hall",
    description: "Bring spare pens. No calculator!",
    syllabus_text: null,
    syllabus_storage_path: null,
    ai_breakdown_json: null,
  });
  await backend.insert("exams", {
    name: "Physics Paper 2",
    subject_id: physics.id,
    board: "AQA",
    date: addDays(today, 25),
    location: null,
    description: null,
    syllabus_text: null,
    syllabus_storage_path: null,
    ai_breakdown_json: null,
  });

  // papers with an upward trend
  const paperScores: [string, number, number, string, number][] = [
    [maths.id, 52, 80, "P1", 30],
    [maths.id, 58, 80, "P2", 21],
    [maths.id, 66, 80, "P1", 9],
    [physics.id, 60, 100, "P1", 14],
    [physics.id, 72, 100, "P2", 5],
    [english.id, 24, 40, "P1", 12],
  ];
  for (const [subjectId, scored, total, num, daysAgo] of paperScores) {
    await backend.insert("papers", {
      subject_id: subjectId,
      title: null,
      year: 2025,
      paper_number: num,
      scored,
      total,
      taken_on: daysAgoISO(daysAgo),
      notes: null,
    });
  }

  // confidence
  for (const [subjectId, topic, confidence] of [
    [maths.id, "Algebra", 75],
    [maths.id, "Geometry", 55],
    [maths.id, "Probability", 40],
    [physics.id, "Forces", 80],
    [physics.id, "Electricity", 45],
    [english.id, "Macbeth", 65],
    [english.id, "Unseen poetry", 35],
  ] as const) {
    await backend.insert("topic_confidence", {
      subject_id: subjectId,
      topic,
      confidence,
    });
  }

  // goals + portfolio + activities
  await backend.insert("goals", {
    text: "Hit grade 8 in Maths mocks",
    horizon: "3m",
    subject_id: maths.id,
    done: false,
    completed_at: null,
  });
  await backend.insert("goals", {
    text: "Read 5 books beyond the syllabus",
    horizon: "6m",
    subject_id: null,
    done: false,
    completed_at: null,
  });
  await backend.insert("portfolio_entries", {
    title: "Won regional robotics challenge",
    type: "competition",
    description: "Team captain — designed the drive system.",
    tags: ["robotics", "teamwork"],
    subject_id: physics.id,
  });
  const debate = await backend.insert("activities", {
    name: "Debate Society",
    role: "Vice captain",
    organisation: "School",
    hours_per_week: 2,
    description: null,
    color: "lilac",
    tags: ["public-speaking"],
  });
  await backend.insert("activity_events", {
    activity_id: debate.id,
    title: "Regional semi-finals",
    date: addDays(today, 12),
    description: null,
  });
}
