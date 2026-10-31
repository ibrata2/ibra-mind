-- Run this migration in the Supabase SQL Editor for the IBRA MIND project.
-- All client requests use the user's JWT and are limited by these RLS policies.
create table if not exists public.ibra_projects (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null check (char_length(title) between 1 and 160),
  kind text not null check (kind in ('mindmap', 'flowchart', 'whiteboard')),
  content jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.ibra_project_versions (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  title text not null,
  kind text not null check (kind in ('mindmap', 'flowchart', 'whiteboard')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ibra_project_versions_owner_project_date
  on public.ibra_project_versions (owner_id, project_id, created_at desc);

alter table public.ibra_projects enable row level security;
alter table public.ibra_project_versions enable row level security;

drop policy if exists "Owners manage their projects" on public.ibra_projects;
create policy "Owners manage their projects" on public.ibra_projects
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners read their project versions" on public.ibra_project_versions;
create policy "Owners read their project versions" on public.ibra_project_versions
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Owners add their project versions" on public.ibra_project_versions;
create policy "Owners add their project versions" on public.ibra_project_versions
  for insert to authenticated with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.ibra_projects to authenticated;
grant select, insert on public.ibra_project_versions to authenticated;
grant usage, select on sequence public.ibra_project_versions_id_seq to authenticated;

create or replace function public.save_ibra_project(
  p_project_id text,
  p_title text,
  p_kind text,
  p_content jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  insert into public.ibra_projects (owner_id, id, title, kind, content, updated_at)
  values (auth.uid(), p_project_id, p_title, p_kind, p_content, now())
  on conflict (owner_id, id) do update set
    title = excluded.title,
    kind = excluded.kind,
    content = excluded.content,
    updated_at = excluded.updated_at;

  insert into public.ibra_project_versions (owner_id, project_id, title, kind, content)
  values (auth.uid(), p_project_id, p_title, p_kind, p_content);
end;
$$;

revoke all on function public.save_ibra_project(text, text, text, jsonb) from public;
grant execute on function public.save_ibra_project(text, text, text, jsonb) to authenticated;
