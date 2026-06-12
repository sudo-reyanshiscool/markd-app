import {
  Activity,
  ActivityEvent,
  AiConversation,
  AiMessage,
  CalendarEvent,
  CalendarFeed,
  DailyMotivation,
  Deadline,
  DeletionLogEntry,
  Exam,
  Goal,
  Paper,
  PortfolioEntry,
  StudySession,
  Subject,
  SubjectSpec,
  Task,
  TopicConfidence,
} from "@/db/schemas";

/** Tables the app reads/writes through the data layer. */
export interface RowMap {
  subjects: Subject;
  tasks: Task;
  deadlines: Deadline;
  exams: Exam;
  papers: Paper;
  goals: Goal;
  portfolio_entries: PortfolioEntry;
  activities: Activity;
  activity_events: ActivityEvent;
  topic_confidence: TopicConfidence;
  study_sessions: StudySession;
  ai_conversations: AiConversation;
  ai_messages: AiMessage;
  daily_motivations: DailyMotivation;
  calendar_feeds: CalendarFeed;
  calendar_events: CalendarEvent;
  subject_specs: SubjectSpec;
  deletion_log: DeletionLogEntry;
}

export type TableName = keyof RowMap;

/** Tables whose deletes go through the 30-day deletion_log (spec §7.16). */
export const SOFT_DELETE_TABLES: ReadonlySet<TableName> = new Set([
  "subjects",
  "tasks",
  "deadlines",
  "exams",
  "papers",
  "goals",
  "portfolio_entries",
  "activities",
]);

/** What callers provide on insert — ids/ownership/timestamps are filled in. */
export type InsertOf<T extends TableName> = Omit<
  RowMap[T],
  "id" | "user_id" | "created_at" | "updated_at"
> & { id?: string };

export type PatchOf<T extends TableName> = Partial<
  Omit<RowMap[T], "id" | "user_id">
>;

/**
 * The single data-access seam. Guest mode runs LocalBackend (device only);
 * signed-in runs SupabaseBackend (RLS-enforced). Hooks never know which.
 */
export interface Backend {
  readonly kind: "local" | "supabase";
  list<T extends TableName>(table: T): Promise<RowMap[T][]>;
  get<T extends TableName>(table: T, id: string): Promise<RowMap[T] | null>;
  insert<T extends TableName>(table: T, row: InsertOf<T>): Promise<RowMap[T]>;
  update<T extends TableName>(
    table: T,
    id: string,
    patch: PatchOf<T>,
  ): Promise<RowMap[T]>;
  /** Hard delete, or soft (snapshot to deletion_log) for SOFT_DELETE_TABLES. */
  remove(table: TableName, id: string): Promise<void>;
  /** Re-insert a deletion_log snapshot and mark it restored. */
  restore(logEntryId: string): Promise<void>;
  /** Permanently purge a deletion_log entry. */
  purgeDeleted(logEntryId: string): Promise<void>;
}
