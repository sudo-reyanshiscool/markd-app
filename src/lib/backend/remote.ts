import { SupabaseClient } from "@supabase/supabase-js";

import {
  Backend,
  InsertOf,
  PatchOf,
  RowMap,
  SOFT_DELETE_TABLES,
  TableName,
} from "./types";

/** Sensible default ordering per table (hooks may re-sort). */
const ORDER: Partial<Record<TableName, { column: string; ascending: boolean }>> = {
  subjects: { column: "position", ascending: true },
  tasks: { column: "created_at", ascending: false },
  deadlines: { column: "date", ascending: true },
  exams: { column: "date", ascending: true },
  papers: { column: "created_at", ascending: false },
  goals: { column: "created_at", ascending: false },
  portfolio_entries: { column: "created_at", ascending: false },
  activities: { column: "created_at", ascending: false },
  activity_events: { column: "date", ascending: true },
  study_sessions: { column: "completed_at", ascending: false },
  ai_conversations: { column: "updated_at", ascending: false },
  ai_messages: { column: "created_at", ascending: true },
  calendar_events: { column: "starts_at", ascending: true },
  deletion_log: { column: "deleted_at", ascending: false },
};

/**
 * Supabase-backed implementation. RLS owns isolation — every query runs as
 * the signed-in user; user_id columns are filled server-side by RLS-checked
 * inserts (we still set them for explicitness).
 */
export class SupabaseBackend implements Backend {
  readonly kind = "supabase" as const;

  constructor(
    private client: SupabaseClient,
    private userId: string,
  ) {}

  async list<T extends TableName>(table: T): Promise<RowMap[T][]> {
    let query = this.client.from(table).select("*");
    const order = ORDER[table];
    if (order) query = query.order(order.column, { ascending: order.ascending });
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as RowMap[T][];
  }

  async get<T extends TableName>(table: T, id: string): Promise<RowMap[T] | null> {
    const { data, error } = await this.client
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as RowMap[T] | null) ?? null;
  }

  async insert<T extends TableName>(table: T, row: InsertOf<T>): Promise<RowMap[T]> {
    const { id: _dropLocalId, ...rest } = row as { id?: string };
    const { data, error } = await this.client
      .from(table)
      .insert({ ...rest, user_id: this.userId })
      .select("*")
      .single();
    if (error) throw error;
    return data as RowMap[T];
  }

  async update<T extends TableName>(
    table: T,
    id: string,
    patch: PatchOf<T>,
  ): Promise<RowMap[T]> {
    const { data, error } = await this.client
      .from(table)
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as RowMap[T];
  }

  async remove(table: TableName, id: string): Promise<void> {
    if (SOFT_DELETE_TABLES.has(table)) {
      const row = await this.get(table, id);
      if (row) {
        const { error: logError } = await this.client.from("deletion_log").insert({
          user_id: this.userId,
          entity_type: table,
          entity_id: id,
          snapshot: row,
        });
        if (logError) throw logError;
      }
    }
    const { error } = await this.client.from(table).delete().eq("id", id);
    if (error) throw error;
  }

  async restore(logEntryId: string): Promise<void> {
    const { data, error } = await this.client
      .from("deletion_log")
      .select("*")
      .eq("id", logEntryId)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.restored_at) return;
    const table = data.entity_type as TableName;
    const { error: insertError } = await this.client
      .from(table)
      .upsert(data.snapshot as never, { onConflict: "id" });
    if (insertError) throw insertError;
    const { error: markError } = await this.client
      .from("deletion_log")
      .update({ restored_at: new Date().toISOString() })
      .eq("id", logEntryId);
    if (markError) throw markError;
  }

  async purgeDeleted(logEntryId: string): Promise<void> {
    const { error } = await this.client
      .from("deletion_log")
      .delete()
      .eq("id", logEntryId);
    if (error) throw error;
  }
}
