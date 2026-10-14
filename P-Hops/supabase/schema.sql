-- Kolkata Durga Puja Guide - Supabase schema
-- Run once in the Supabase SQL editor (Project -> SQL Editor -> New query). Safe to re-run.
--
-- Security model
--   * The browser NEVER writes to the database. Every insert/update goes through the Next.js API routes,
--     which use the service-role key (server only) after validation, moderation and rate limiting.
--   * Anonymous (anon key) visitors may only READ non-hidden comments, and only the public columns
--     (device_hash is not readable).
--   * crowd_reports and comment_reports are not readable by anon at all; the API aggregates them.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- crowd reports
create table if not exists public.crowd_reports (
  id          uuid primary key default gen_random_uuid(),
  pandal_id   text        not null check (char_length(pandal_id) between 1 and 80),
  level       text        not null check (level in ('low', 'medium', 'high')),
  created_at  timestamptz not null default now(),
  device_hash text        not null check (char_length(device_hash) between 16 and 128)
);
create index if not exists crowd_reports_created_idx on public.crowd_reports (created_at desc);
create index if not exists crowd_reports_device_idx  on public.crowd_reports (device_hash, pandal_id, created_at desc);

-- ---------------------------------------------------------------- comments
create table if not exists public.comments (
  id             uuid primary key default gen_random_uuid(),
  pandal_id      text        not null check (char_length(pandal_id) between 1 and 80),
  name           text        not null default 'Visitor' check (char_length(name) between 1 and 40),
  text           text        not null check (char_length(text) between 1 and 300),
  created_at     timestamptz not null default now(),
  reported_count integer     not null default 0,
  hidden         boolean     not null default false,
  device_hash    text        not null check (char_length(device_hash) between 16 and 128)
);
create index if not exists comments_pandal_idx on public.comments (pandal_id, created_at desc) where hidden = false;
create index if not exists comments_device_idx on public.comments (device_hash, created_at desc);

-- one report per device per comment
create table if not exists public.comment_reports (
  comment_id  uuid        not null references public.comments (id) on delete cascade,
  device_hash text        not null,
  created_at  timestamptz not null default now(),
  primary key (comment_id, device_hash)
);

-- ---------------------------------------------------------------- Row Level Security
alter table public.crowd_reports   enable row level security;
alter table public.comments        enable row level security;
alter table public.comment_reports enable row level security;

-- Start from zero privileges for the public roles, then grant back the minimum.
revoke all on public.crowd_reports   from anon, authenticated;
revoke all on public.comments        from anon, authenticated;
revoke all on public.comment_reports from anon, authenticated;

-- Public read of visible comments, public columns only (device_hash stays private).
grant select (id, pandal_id, name, text, created_at, reported_count, hidden) on public.comments to anon, authenticated;

drop policy if exists "public can read visible comments" on public.comments;
create policy "public can read visible comments"
  on public.comments for select
  to anon, authenticated
  using (hidden = false);

-- Deliberately NO insert / update / delete policies for anon or authenticated:
-- with RLS enabled that means those operations are denied. The service role bypasses RLS.

-- ---------------------------------------------------------------- report_comment RPC
-- Atomically records a report (once per device) and hides the comment at the threshold.
create or replace function public.report_comment(p_comment_id uuid, p_device_hash text, p_threshold integer default 3)
returns table (reported_count integer, hidden boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.comment_reports (comment_id, device_hash)
  values (p_comment_id, p_device_hash)
  on conflict do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    update public.comments c
       set reported_count = c.reported_count + 1,
           hidden = (c.reported_count + 1) >= p_threshold or c.hidden
     where c.id = p_comment_id;
  end if;

  return query
    select c.reported_count, c.hidden from public.comments c where c.id = p_comment_id;
end;
$$;

revoke all on function public.report_comment(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.report_comment(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------- housekeeping (optional)
-- Old crowd reports are useless after an hour; keep a day for debugging, then purge.
-- Enable pg_cron (Database -> Extensions) and uncomment:
-- select cron.schedule('purge-crowd-reports', '17 * * * *',
--   $$ delete from public.crowd_reports where created_at < now() - interval '24 hours' $$);
