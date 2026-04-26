/**
 * Data shapes — kept compatible with the original Markd `app_data` JSONB
 * so a user's existing Supabase profile rolls forward without migration.
 */

export type Priority = "urgent" | "soon" | "later";
export type Confidence = "weak" | "okay" | "strong";
export type Theme = "light" | "dark" | "system";

export interface Subject {
  id: string;
  name: string;
  board: string;
  color: string;
  curriculum: "GCSE" | "A-Level" | "IB" | "IGCSE" | "Other";
  targetGrade?: string;
  predictedGrade?: string;
  topics?: string[];
}

export interface Task {
  id: string;
  title: string;
  subjectId?: string;
  due?: string;          // ISO date
  priority: Priority;
  estimateMin?: number;
  done: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface Deadline {
  id: string;
  title: string;
  subjectId?: string;
  due: string;
  notes?: string;
}

export interface Exam {
  id: string;
  subjectId?: string;
  title: string;
  date: string;          // ISO date
  durationMin?: number;
  paper?: string;
  location?: string;
}

export interface Goal {
  id: string;
  title: string;
  horizon: "3 months" | "6 months" | "9 months" | "12 months";
  subjectId?: string;
  done: boolean;
  notes?: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  type: "Project" | "Achievement" | "Competition" | "Leadership";
  date?: string;
  description?: string;
}

export interface StudySession {
  id: string;
  startedAt: string;
  minutes: number;
  subjectId?: string;
  taskId?: string;
}

export interface TopicConfidence {
  topic: string;
  subjectId?: string;
  confidence: Confidence;
  updatedAt: string;
}

export interface AppData {
  subjects: Subject[];
  tasks: Task[];
  deadlines: Deadline[];
  exams: Exam[];
  goals: Goal[];
  portfolio: PortfolioItem[];
  studySessions: StudySession[];
  topicConfidence: TopicConfidence[];
  papers: unknown[];
  activities: unknown[];
  deleted: unknown[];
  theme: "light" | "dark";
  revisionMode: boolean;
  mockMode: boolean;
  notificationsEnabled: boolean;
  outlookCalendarUrl: string;
  calendarLastSync: string | null;
}

export const emptyAppData = (): AppData => ({
  subjects: [],
  tasks: [],
  deadlines: [],
  exams: [],
  goals: [],
  portfolio: [],
  studySessions: [],
  topicConfidence: [],
  papers: [],
  activities: [],
  deleted: [],
  theme: "dark",
  revisionMode: false,
  mockMode: false,
  notificationsEnabled: false,
  outlookCalendarUrl: "",
  calendarLastSync: null,
});
