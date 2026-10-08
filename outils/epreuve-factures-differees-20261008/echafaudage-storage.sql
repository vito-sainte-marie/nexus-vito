create table if not exists storage.buckets (id text primary key, name text not null unique, owner uuid, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, owner_id text, metadata jsonb, path_tokens text[] generated always as (string_to_array(name,'/')) stored, created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz default now(), version text);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create or replace function storage.filename(name text) returns text language sql as $$ select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $$;
grant all on storage.buckets, storage.objects to postgres, service_role, authenticated, anon;
