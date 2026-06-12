import { ExamTrack } from "@/db/schemas";
import { readJSON, writeJSON } from "@/lib/storage";
import { localId } from "@/utils/uuid";

import {
  Backend,
  InsertOf,
  PatchOf,
  RowMap,
  SOFT_DELETE_TABLES,
  TableName,
} from "./types";

const GUEST_USER_ID = "guest";
const keyFor = (table: TableName) => `markd.local.${table}`;
const PROFILE_KEY = "markd.local.profile";

/** Guest-mode profile equivalent (no auth.users row exists). */
export interface LocalProfile {
  name: string | null;
  school_name: string | null;
  country: string | null;
  exam_track: ExamTrack | null;
  year_group: string | null;
}

/**
 * Device-only backend powering demo/guest mode (spec §7.18): no Supabase
 * writes, no credentials. Tables are JSON arrays in storage with an
 * in-memory cache; every operation is async to mirror the remote backend.
 */
export class LocalBackend implements Backend {
  readonly kind = "local" as const;
  private cache = new Map<TableName, RowMap[TableName][]>();

  private async load<T extends TableName>(table: T): Promise<RowMap[T][]> {
    if (!this.cache.has(table)) {
      const rows = (await readJSON<RowMap[T][]>(keyFor(table))) ?? [];
      this.cache.set(table, rows);
    }
    return this.cache.get(table) as RowMap[T][];
  }

  private async save<T extends TableName>(table: T, rows: RowMap[T][]) {
    this.cache.set(table, rows);
    await writeJSON(keyFor(table), rows);
  }

  async list<T extends TableName>(table: T): Promise<RowMap[T][]> {
    return [...(await this.load(table))];
  }

  async get<T extends TableName>(table: T, id: string): Promise<RowMap[T] | null> {
    const rows = await this.load(table);
    return rows.find((r) => r.id === id) ?? null;
  }

  async insert<T extends TableName>(table: T, row: InsertOf<T>): Promise<RowMap[T]> {
    const rows = await this.load(table);
    const full = {
      ...row,
      id: row.id ?? localId(),
      user_id: GUEST_USER_ID,
      created_at: new Date().toISOString(),
    } as unknown as RowMap[T];
    await this.save(table, [...rows, full]);
    return full;
  }

  async update<T extends TableName>(
    table: T,
    id: string,
    patch: PatchOf<T>,
  ): Promise<RowMap[T]> {
    const rows = await this.load(table);
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0) throw new Error(`${table}/${id} not found`);
    const next = { ...rows[index], ...patch } as RowMap[T];
    const copy = [...rows];
    copy[index] = next;
    await this.save(table, copy);
    return next;
  }

  async remove(table: TableName, id: string): Promise<void> {
    const rows = await this.load(table);
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (SOFT_DELETE_TABLES.has(table)) {
      const log = await this.load("deletion_log");
      await this.save("deletion_log", [
        ...log,
        {
          id: localId(),
          user_id: GUEST_USER_ID,
          entity_type: table,
          entity_id: id,
          snapshot: row as unknown as Record<string, unknown>,
          deleted_at: new Date().toISOString(),
          restored_at: null,
        },
      ]);
    }
    await this.save(table, rows.filter((r) => r.id !== id) as never);
    await this.cascade(table, id);
  }

  /** Mirror the database's FK cascade/set-null behaviour locally. */
  private async cascade(table: TableName, id: string): Promise<void> {
    if (table === "subjects") {
      const setNull = [
        "tasks",
        "deadlines",
        "exams",
        "papers",
        "goals",
        "portfolio_entries",
      ] as const;
      for (const t of setNull) {
        const rows = await this.load(t);
        const touched = rows.map((r) =>
          "subject_id" in r && r.subject_id === id ? { ...r, subject_id: null } : r,
        );
        await this.save(t, touched as never);
      }
      // topic_confidence + subject_specs cascade-delete with the subject
      const conf = await this.load("topic_confidence");
      await this.save(
        "topic_confidence",
        conf.filter((c) => c.subject_id !== id),
      );
      const specs = await this.load("subject_specs");
      await this.save(
        "subject_specs",
        specs.filter((s) => s.subject_id !== id),
      );
    }
    if (table === "activities") {
      const events = await this.load("activity_events");
      await this.save(
        "activity_events",
        events.filter((e) => e.activity_id !== id),
      );
    }
    if (table === "ai_conversations") {
      const msgs = await this.load("ai_messages");
      await this.save(
        "ai_messages",
        msgs.filter((m) => m.conversation_id !== id),
      );
    }
  }

  async restore(logEntryId: string): Promise<void> {
    const log = await this.load("deletion_log");
    const entry = log.find((e) => e.id === logEntryId);
    if (!entry || entry.restored_at) return;
    const table = entry.entity_type as TableName;
    const rows = await this.load(table);
    if (!rows.some((r) => r.id === entry.entity_id)) {
      await this.save(table, [...rows, entry.snapshot as never]);
    }
    await this.save(
      "deletion_log",
      log.map((e) =>
        e.id === logEntryId ? { ...e, restored_at: new Date().toISOString() } : e,
      ),
    );
  }

  async purgeDeleted(logEntryId: string): Promise<void> {
    const log = await this.load("deletion_log");
    await this.save(
      "deletion_log",
      log.filter((e) => e.id !== logEntryId),
    );
  }

  // ----- guest profile ------------------------------------------------
  async getProfile(): Promise<LocalProfile> {
    return (
      (await readJSON<LocalProfile>(PROFILE_KEY)) ?? {
        name: null,
        school_name: null,
        country: null,
        exam_track: null,
        year_group: null,
      }
    );
  }

  async setProfile(patch: Partial<LocalProfile>): Promise<LocalProfile> {
    const current = await this.getProfile();
    const next = { ...current, ...patch };
    await writeJSON(PROFILE_KEY, next);
    return next;
  }

  /** Everything, for sign-up migration (spec §7.18). */
  async exportAll(): Promise<Partial<Record<TableName, RowMap[TableName][]>>> {
    const out: Partial<Record<TableName, RowMap[TableName][]>> = {};
    const tables: TableName[] = [
      "subjects",
      "tasks",
      "deadlines",
      "exams",
      "papers",
      "goals",
      "portfolio_entries",
      "activities",
      "activity_events",
      "topic_confidence",
      "study_sessions",
    ];
    for (const t of tables) {
      const rows = await this.load(t);
      if (rows.length) out[t] = rows;
    }
    return out;
  }

  async hasAnyData(): Promise<boolean> {
    const all = await this.exportAll();
    return Object.keys(all).length > 0;
  }

  async wipe(): Promise<void> {
    const tables: TableName[] = [
      "subjects", "tasks", "deadlines", "exams", "papers", "goals",
      "portfolio_entries", "activities", "activity_events", "topic_confidence",
      "study_sessions", "ai_conversations", "ai_messages", "daily_motivations",
      "calendar_feeds", "calendar_events", "subject_specs", "deletion_log",
    ];
    for (const t of tables) await this.save(t, []);
    await writeJSON(PROFILE_KEY, {
      name: null, school_name: null, country: null, exam_track: null, year_group: null,
    });
  }
}

export const localBackend = new LocalBackend();
