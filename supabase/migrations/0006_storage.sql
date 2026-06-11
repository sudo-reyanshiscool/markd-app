-- 0006_storage.sql
-- Storage buckets + storage.objects policies.
--
-- Path convention (enforced below, the client MUST follow it):
--   <user_id>/<filename>     e.g.  "5f8a.../physics-spec-2026.pdf"
-- (storage.foldername(name))[1] is the first path segment = the owner's uuid.
--
--  * syllabi — PRIVATE. Owner-only select/insert/update/delete. Downloads in
--    the app go through signed URLs (createSignedUrl), never public URLs.
--  * avatars — PUBLIC read (anyone can render an avatar), owner-prefixed write.
--
-- storage.objects already has RLS enabled by Supabase; we only add policies.

insert into storage.buckets (id, name, public)
values
  ('syllabi', 'syllabi', false),
  ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- ---------------------------------------------------------------------------
-- syllabi: owner-only everything
-- ---------------------------------------------------------------------------
create policy syllabi_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'syllabi' and (storage.foldername(name))[1] = auth.uid()::text);

create policy syllabi_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'syllabi' and (storage.foldername(name))[1] = auth.uid()::text);

create policy syllabi_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'syllabi' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'syllabi' and (storage.foldername(name))[1] = auth.uid()::text);

create policy syllabi_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'syllabi' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- avatars: public read, owner-prefixed write
-- ---------------------------------------------------------------------------
create policy avatars_public_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
