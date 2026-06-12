import { z } from "zod";

/**
 * Zod schemas mirroring every entity (spec §4). These are the single source
 * of validation truth: forms, the data layer, and the local backend all
 * parse through them. Database snake_case is preserved so rows round-trip
 * with Supabase untouched.
 */

const uuid = z.string().min(1); // local backend uses non-RFC ids; Supabase uses uuids
const isoTimestamp = z.string().min(1);
const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected yyyy-mm-dd");

export const examTrackSchema = z.enum(["gcse", "igcse", "ib", "alevel", "other"]);
export type ExamTrack = z.infer<typeof examTrackSchema>;

export const planSchema = z.enum(["free", "pro", "family"]);
export type Plan = z.infer<typeof planSchema>;

export const themePrefSchema = z.enum(["system", "light", "dark"]);

// ---------------------------------------------------------------- profiles
export const profileSchema = z.object({
  id: uuid,
  email: z.string().email(),
  name: z.string().trim().min(1).max(80).nullable(),
  school_id: uuid.nullable(),
  country: z.string().trim().max(80).nullable(),
  year_group: z.string().trim().max(40).nullable(),
  exam_track: examTrackSchema.nullable(),
  onboarded_at: isoTimestamp.nullable(),
  plan: planSchema.default("free"),
  theme: themePrefSchema.default("system"),
  revision_mode: z.boolean().default(false),
  locale: z.string().default("en"),
  created_at: isoTimestamp,
  updated_at: isoTimestamp.nullable().optional(),
});
export type Profile = z.infer<typeof profileSchema>;

// ----------------------------------------------------------------- schools
export const schoolSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(160),
  domain: z.string().trim().max(160).nullable(),
  country: z.string().trim().max(80).nullable(),
  verified: z.boolean().default(false),
  created_by: uuid.nullable(),
  created_at: isoTimestamp,
});
export type School = z.infer<typeof schoolSchema>;

// ---------------------------------------------------------------- subjects
export const subjectSchema = z.object({
  id: uuid,
  user_id: uuid,
  name: z.string().trim().min(1).max(80),
  board: z.string().trim().max(60).nullable(),
  target_grade: z.string().trim().max(12).nullable(),
  color: z.string().trim().max(24).nullable(),
  position: z.number().int().default(0),
  archived_at: isoTimestamp.nullable(),
  created_at: isoTimestamp,
  updated_at: isoTimestamp.nullable().optional(),
});
export type Subject = z.infer<typeof subjectSchema>;

export const subjectInsertSchema = subjectSchema.pick({
  name: true,
  board: true,
  target_grade: true,
  color: true,
  position: true,
});

// ------------------------------------------------------------ subject_specs
export const subjectSpecSchema = z.object({
  id: uuid,
  subject_id: uuid,
  user_id: uuid,
  year: z.string().trim().max(20).nullable(),
  storage_path: z.string().min(1),
  file_name: z.string().min(1).max(200),
  mime: z.string().min(1).max(120),
  size_bytes: z.number().int().nonnegative(),
  created_at: isoTimestamp,
});
export type SubjectSpec = z.infer<typeof subjectSpecSchema>;

// ------------------------------------------------------------------- tasks
export const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(30).default(1),
  byweekday: z.array(z.number().int().min(0).max(6)).optional(),
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

export const taskSchema = z.object({
  id: uuid,
  user_id: uuid,
  subject_id: uuid.nullable(),
  text: z.string().trim().min(1).max(500),
  done: z.boolean().default(false),
  priority: z.number().int().min(1).max(5).default(3),
  estimate_minutes: z.number().int().positive().max(24 * 60).nullable(),
  topic: z.string().trim().max(120).nullable(),
  due_date: isoDateString.nullable(),
  recurrence: recurrenceSchema.nullable(),
  snoozed_until: isoTimestamp.nullable(),
  created_at: isoTimestamp,
  completed_at: isoTimestamp.nullable(),
});
export type Task = z.infer<typeof taskSchema>;

export const taskInsertSchema = taskSchema.pick({
  subject_id: true,
  text: true,
  priority: true,
  estimate_minutes: true,
  topic: true,
  due_date: true,
  recurrence: true,
});

// --------------------------------------------------------------- deadlines
export const deadlineSchema = z.object({
  id: uuid,
  user_id: uuid,
  subject_id: uuid.nullable(),
  title: z.string().trim().min(1).max(160),
  date: isoDateString,
  notes: z.string().trim().max(2000).nullable(),
  created_at: isoTimestamp,
});
export type Deadline = z.infer<typeof deadlineSchema>;

// ------------------------------------------------------------------- exams
export const examSchema = z.object({
  id: uuid,
  user_id: uuid,
  subject_id: uuid.nullable(),
  name: z.string().trim().min(1).max(160),
  board: z.string().trim().max(60).nullable(),
  date: isoDateString,
  location: z.string().trim().max(160).nullable(),
  description: z.string().trim().max(4000).nullable(),
  syllabus_text: z.string().max(200_000).nullable(),
  syllabus_storage_path: z.string().nullable(),
  ai_breakdown_json: z.unknown().nullable(),
  created_at: isoTimestamp,
});
export type Exam = z.infer<typeof examSchema>;

/** Shape of the AI syllabus breakdown (spec §8.2). */
export const aiBreakdownSchema = z.object({
  topics: z.array(
    z.object({
      name: z.string(),
      subtopics: z.array(z.string()).default([]),
      key_skills: z.array(z.string()).default([]),
      estimated_hours: z.number().nonnegative().default(0),
    }),
  ),
});
export type AiBreakdown = z.infer<typeof aiBreakdownSchema>;

// ------------------------------------------------------------------ papers
export const paperSchema = z.object({
  id: uuid,
  user_id: uuid,
  subject_id: uuid.nullable(),
  title: z.string().trim().max(160).nullable(),
  year: z.number().int().min(1990).max(2100).nullable(),
  paper_number: z.string().trim().max(40).nullable(),
  scored: z.number().nonnegative().nullable(),
  total: z.number().positive().nullable(),
  taken_on: isoDateString.nullable(),
  notes: z.string().trim().max(2000).nullable(),
  created_at: isoTimestamp,
});
export type Paper = z.infer<typeof paperSchema>;

// ------------------------------------------------------------------- goals
export const goalHorizonSchema = z.enum(["3m", "6m", "9m", "12m"]);
export const goalSchema = z.object({
  id: uuid,
  user_id: uuid,
  subject_id: uuid.nullable(),
  text: z.string().trim().min(1).max(300),
  horizon: goalHorizonSchema,
  done: z.boolean().default(false),
  completed_at: isoTimestamp.nullable(),
  created_at: isoTimestamp,
});
export type Goal = z.infer<typeof goalSchema>;

// -------------------------------------------------------- portfolio_entries
export const portfolioTypeSchema = z.enum([
  "project",
  "achievement",
  "competition",
  "leadership",
]);
export const portfolioEntrySchema = z.object({
  id: uuid,
  user_id: uuid,
  subject_id: uuid.nullable(),
  title: z.string().trim().min(1).max(160),
  type: portfolioTypeSchema,
  description: z.string().trim().max(4000).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
  created_at: isoTimestamp,
});
export type PortfolioEntry = z.infer<typeof portfolioEntrySchema>;

// -------------------------------------------------------------- activities
export const activitySchema = z.object({
  id: uuid,
  user_id: uuid,
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).nullable(),
  organisation: z.string().trim().max(160).nullable(),
  hours_per_week: z.number().nonnegative().max(168).nullable(),
  description: z.string().trim().max(4000).nullable(),
  color: z.string().trim().max(24).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
  created_at: isoTimestamp,
});
export type Activity = z.infer<typeof activitySchema>;

export const activityEventSchema = z.object({
  id: uuid,
  activity_id: uuid,
  user_id: uuid,
  title: z.string().trim().min(1).max(160),
  date: isoDateString.nullable(),
  description: z.string().trim().max(2000).nullable(),
  created_at: isoTimestamp,
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;

// --------------------------------------------------------- topic_confidence
export const topicConfidenceSchema = z.object({
  id: uuid,
  user_id: uuid,
  subject_id: uuid,
  topic: z.string().trim().min(1).max(160),
  confidence: z.number().int().min(0).max(100),
  updated_at: isoTimestamp.nullable().optional(),
});
export type TopicConfidence = z.infer<typeof topicConfidenceSchema>;

// ----------------------------------------------------------- study_sessions
export const studySessionSchema = z.object({
  id: uuid,
  user_id: uuid,
  subject_id: uuid.nullable(),
  task_id: uuid.nullable(),
  minutes: z.number().int().positive().max(24 * 60),
  started_at: isoTimestamp.nullable(),
  completed_at: isoTimestamp,
});
export type StudySession = z.infer<typeof studySessionSchema>;

// -------------------------------------------------------------------- AI
export const aiConversationSchema = z.object({
  id: uuid,
  user_id: uuid,
  title: z.string().trim().max(160).nullable(),
  created_at: isoTimestamp,
  updated_at: isoTimestamp.nullable().optional(),
});
export type AiConversation = z.infer<typeof aiConversationSchema>;

export const aiMessageSchema = z.object({
  id: uuid,
  user_id: uuid,
  conversation_id: uuid,
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string().min(1),
  tool_calls: z.unknown().nullable(),
  tokens_in: z.number().int().nonnegative().nullable(),
  tokens_out: z.number().int().nonnegative().nullable(),
  model: z.string().max(120).nullable(),
  created_at: isoTimestamp,
});
export type AiMessage = z.infer<typeof aiMessageSchema>;

export const dailyMotivationSchema = z.object({
  id: uuid,
  user_id: uuid,
  date: isoDateString,
  text: z.string().trim().min(1).max(280),
  model: z.string().max(120).nullable(),
});
export type DailyMotivation = z.infer<typeof dailyMotivationSchema>;

// ---------------------------------------------------------- calendar feeds
export const calendarFeedSchema = z.object({
  id: uuid,
  user_id: uuid,
  url: z.string().url().startsWith("https://", "https only"),
  label: z.string().trim().max(120).nullable(),
  last_synced_at: isoTimestamp.nullable(),
  last_event_count: z.number().int().nonnegative().nullable(),
  status: z.enum(["ok", "error", "pending"]).default("pending"),
  last_error: z.string().max(500).nullable(),
  created_at: isoTimestamp,
});
export type CalendarFeed = z.infer<typeof calendarFeedSchema>;

/** Documented spec extension — imported events need a home (see supabase/README). */
export const calendarEventSchema = z.object({
  id: uuid,
  user_id: uuid,
  feed_id: uuid,
  uid: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  starts_at: isoTimestamp,
  ends_at: isoTimestamp.nullable(),
  location: z.string().trim().max(300).nullable(),
  description: z.string().trim().max(4000).nullable(),
  all_day: z.boolean().default(false),
  created_at: isoTimestamp,
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

// ------------------------------------------------------------ deletion_log
export const deletionLogSchema = z.object({
  id: uuid,
  user_id: uuid,
  entity_type: z.string().min(1).max(60),
  entity_id: uuid,
  snapshot: z.record(z.string(), z.unknown()),
  deleted_at: isoTimestamp,
  restored_at: isoTimestamp.nullable(),
});
export type DeletionLogEntry = z.infer<typeof deletionLogSchema>;

// ------------------------------------------------------------- share_links
export const shareLinkSchema = z.object({
  id: uuid,
  user_id: uuid,
  slug: z.string().min(6).max(24),
  payload: z.record(z.string(), z.unknown()),
  expires_at: isoTimestamp,
  view_count: z.number().int().nonnegative().default(0),
  created_at: isoTimestamp,
});
export type ShareLink = z.infer<typeof shareLinkSchema>;

// ----------------------------------------------------------- device_tokens
export const deviceTokenSchema = z.object({
  id: uuid,
  user_id: uuid,
  expo_push_token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]),
  created_at: isoTimestamp,
});
export type DeviceToken = z.infer<typeof deviceTokenSchema>;

// ----------------------------------------------------------- subscriptions
export const subscriptionSchema = z.object({
  id: uuid,
  user_id: uuid,
  source: z.enum(["revenuecat", "stripe"]),
  product_id: z.string().max(160).nullable(),
  status: z.enum(["active", "trialing", "past_due", "canceled", "expired"]),
  period_start: isoTimestamp.nullable(),
  period_end: isoTimestamp.nullable(),
  raw_event: z.unknown().nullable(),
  updated_at: isoTimestamp.nullable().optional(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;
