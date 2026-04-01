-- Supabase Storage: proof-images bucket setup
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)

-- 1) Create the bucket (private, not public)
insert into storage.buckets (id, name, public)
values ('proof-images', 'proof-images', false)
on conflict (id) do nothing;

-- 2) RLS: authenticated users can upload to their own folder
create policy "Users upload own proof images"
on storage.objects for insert
with check (
  bucket_id = 'proof-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 3) RLS: users can read their own images + friends' images
-- (simplified: same-room members or own images)
create policy "Users read own proof images"
on storage.objects for select
using (
  bucket_id = 'proof-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 4) RLS: users can overwrite (upsert) their own images
create policy "Users update own proof images"
on storage.objects for update
using (
  bucket_id = 'proof-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
