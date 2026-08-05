-- ---------------------------------------------------------------------
-- Supporting documents on a sponsor Expression of Interest.
--
-- Four columns and a private Storage bucket. The columns describe the
-- object; the object itself lives in Storage, because a 10 MB company deck
-- in a Postgres column is a 10 MB row that every `select *` on the table
-- then has to carry.
--
-- WHAT IS STORED HERE IS THE SERVER'S OBSERVATION, NOT THE CLIENT'S CLAIM.
-- `document_size` and `document_type` are read back out of Storage by
-- api/partner-interest.ts after the upload lands, never taken from the
-- browser. `document_name` is the only field that comes from the sender,
-- and it is display text — the object is addressed by `document_path`.
--
-- Safe to run more than once.
-- ---------------------------------------------------------------------

alter table public.partner_interest
  add column if not exists document_name text,
  add column if not exists document_path text,
  add column if not exists document_size bigint,
  add column if not exists document_type text;

comment on column public.partner_interest.document_name is
  'Filename as the sender gave it. Display only; never used to address the object.';
comment on column public.partner_interest.document_path is
  'Object key within the private partner-documents bucket: <uuid>/<safe-name>.';
comment on column public.partner_interest.document_size is
  'Size in bytes, read from Storage after upload. Never the browser''s claim.';
comment on column public.partner_interest.document_type is
  'Content type, read from Storage after upload. One of the five accepted types.';

-- An attachment is either fully described or absent. A row carrying a path
-- with no size is a half-finished upload that was recorded anyway, which is
-- exactly the state the verification step exists to prevent — this makes it
-- unrepresentable rather than merely unlikely.
alter table public.partner_interest
  drop constraint if exists partner_interest_document_complete;
alter table public.partner_interest
  add constraint partner_interest_document_complete check (
    (document_path is null
      and document_name is null
      and document_size is null
      and document_type is null)
    or (document_path is not null
      and document_name is not null
      and document_size is not null
      and document_size > 0
      and document_size <= 10485760
      and document_type is not null)
  );

-- The desk's realistic question is "which approaches came with something to
-- read", so the index is on the presence of a document rather than on the
-- column itself.
create index if not exists partner_interest_with_document_idx
  on public.partner_interest (created_at desc)
  where document_path is not null;

-- ---------------------------------------------------------------------
-- The bucket.
--
-- PRIVATE, and the two limits are set ON THE BUCKET rather than only in the
-- application. That matters: the browser uploads straight to Storage with a
-- signed URL, so between issuing that URL and the file landing there is no
-- code of ours in the path. The bucket's own file_size_limit and
-- allowed_mime_types are what stops a signed URL being used to put a 2 GB
-- file, or an executable, into the project. The API's checks are the good
-- error message; these are the enforcement.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-documents',
  'partner-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Storage policies: there are none, and that is the policy.
--
-- storage.objects has RLS on by default in a Supabase project. With no
-- policy naming this bucket, `anon` and `authenticated` can neither read,
-- write, list nor delete in it. Everything that touches these objects goes
-- through api/partner-interest.ts with SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS by design — and the only write the public can perform is via
-- a signed upload URL for one path the server chose.
--
-- The lines below remove any policy an earlier hand-run may have left on
-- this bucket. They are safe on a clean project (nothing matches).
-- ---------------------------------------------------------------------
do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and qual like '%partner-documents%'
  loop
    execute format('drop policy %I on storage.objects', policy_name);
  end loop;
end;
$$;

-- Verify after running:
--
--   -- the four columns exist
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'partner_interest'
--     and column_name like 'document%';
--
--   -- the bucket is private and capped
--   select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'partner-documents';
--
--   -- no policy exposes it (should come back empty)
--   select policyname from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and qual like '%partner-documents%';
