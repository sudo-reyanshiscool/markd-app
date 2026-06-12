/**
 * Generated Supabase types land here (spec §4 "Generated types").
 *
 * Regenerate against a live project with:
 *   npm run db:typegen
 * (wraps: supabase gen types typescript --local > src/db/types.gen.ts)
 *
 * Until a live schema is linked, the app's single source of row types is
 * src/db/schemas.ts (Zod) — every query helper is typed against those.
 * After generating, this file exports the canonical `Database` type and
 * src/lib/supabase.ts can switch to `createClient<Database>(...)`.
 */
export type Database = Record<string, never>;
