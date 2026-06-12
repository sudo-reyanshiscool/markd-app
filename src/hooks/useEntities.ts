import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";

import {
  InsertOf,
  PatchOf,
  RowMap,
  TableName,
  useBackend,
  useDataScope,
} from "@/lib/backend";
import { localId } from "@/utils/uuid";

export function entityKey(scope: string, table: TableName): [string, TableName] {
  return [scope, table];
}

/** All rows of a table for the active scope (guest or user). */
export function useEntityList<T extends TableName>(
  table: T,
): UseQueryResult<RowMap[T][]> {
  const backend = useBackend();
  const scope = useDataScope();
  return useQuery({
    queryKey: entityKey(scope, table),
    queryFn: () => backend.list(table),
  });
}

/**
 * add / update / remove / restore with optimistic cache updates and
 * rollback on error (spec §7.21). Inserted rows appear instantly with a
 * temporary id, then settle to the backend's row.
 */
export function useEntityMutations<T extends TableName>(table: T) {
  const backend = useBackend();
  const scope = useDataScope();
  const queryClient = useQueryClient();
  const key = entityKey(scope, table);

  type Row = RowMap[T];

  const add = useMutation({
    mutationFn: (row: InsertOf<T>) => backend.insert(table, row),
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Row[]>(key);
      const optimistic = {
        ...row,
        id: row.id ?? `tmp-${localId()}`,
        user_id: "optimistic",
        created_at: new Date().toISOString(),
      } as unknown as Row;
      queryClient.setQueryData<Row[]>(key, (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, _row, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchOf<T> }) =>
      backend.update(table, id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Row[]>(key);
      queryClient.setQueryData<Row[]>(key, (old) =>
        (old ?? []).map((r) => (r.id === id ? ({ ...r, ...patch } as Row) : r)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => backend.remove(table, id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Row[]>(key);
      queryClient.setQueryData<Row[]>(key, (old) =>
        (old ?? []).filter((r) => r.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({
        queryKey: entityKey(scope, "deletion_log"),
      });
    },
  });

  return { add, update, remove };
}

/** Restore / purge from Recently deleted (spec §7.16). */
export function useDeletionLog() {
  const backend = useBackend();
  const scope = useDataScope();
  const queryClient = useQueryClient();

  const entries = useEntityList("deletion_log");

  const restore = useMutation({
    mutationFn: (logEntryId: string) => backend.restore(logEntryId),
    onSettled: () => queryClient.invalidateQueries(), // restored row can be any table
  });

  const purge = useMutation({
    mutationFn: (logEntryId: string) => backend.purgeDeleted(logEntryId),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: entityKey(scope, "deletion_log") }),
  });

  return { entries, restore, purge };
}
