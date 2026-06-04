-- Clean-start Project Z schema for the own PostgreSQL backend.

create extension if not exists pgcrypto;

create table if not exists public.pilot_sessions (
  id uuid primary key default gen_random_uuid(),
  public_code text null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  last_seen_at timestamptz null
);

create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  pilot_session_id uuid not null references public.pilot_sessions(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  full_name text null check (full_name is null or char_length(full_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_session_id)
);

create table if not exists public.learner_chapter_progress (
  learner_id uuid not null references public.learners(id) on delete cascade,
  chapter_id text not null,
  status text not null check (status in ('locked', 'open', 'completed')),
  opened_at timestamptz null,
  completed_at timestamptz null,
  unlock_seen_at timestamptz null,
  primary key (learner_id, chapter_id)
);

create table if not exists public.mission_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  chapter_id text not null,
  mission_id text not null,
  answer_json jsonb not null,
  is_correct boolean not null,
  score integer not null check (score between 0 and 100),
  content_version text not null,
  client_attempt_id text null,
  created_at timestamptz not null default now(),
  unique (learner_id, client_attempt_id)
);

create table if not exists public.completed_missions (
  learner_id uuid not null references public.learners(id) on delete cascade,
  chapter_id text not null,
  mission_id text not null,
  first_completed_at timestamptz not null default now(),
  primary key (learner_id, chapter_id, mission_id)
);

create table if not exists public.badge_awards (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  chapter_id text not null,
  badge_name_snapshot text not null,
  completed_chapters integer not null check (completed_chapters >= 0),
  awarded_at timestamptz not null default now(),
  event_id text not null unique,
  unique (learner_id, chapter_id)
);

create table if not exists public.trap_discoveries (
  learner_id uuid not null references public.learners(id) on delete cascade,
  trap_id text not null,
  first_seen_at timestamptz not null default now(),
  primary key (learner_id, trap_id)
);

create table if not exists public.chapter_reflections (
  learner_id uuid not null references public.learners(id) on delete cascade,
  chapter_id text not null,
  option_id text null,
  option_label text null,
  note text not null default '',
  skipped boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (learner_id, chapter_id),
  check (char_length(coalesce(option_id, '')) <= 80),
  check (char_length(coalesce(option_label, '')) <= 80),
  check (char_length(note) <= 180)
);

create table if not exists public.announcement_deliveries (
  id uuid primary key default gen_random_uuid(),
  badge_award_id uuid not null references public.badge_awards(id) on delete cascade,
  channel text not null,
  status text not null check (status in ('pending', 'dry_run', 'sent', 'failed')),
  idempotency_key text not null unique,
  attempts_count integer not null default 0,
  provider_message_id text null,
  last_error text null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);

create index if not exists learners_pilot_session_id_idx
  on public.learners(pilot_session_id);

create index if not exists learner_chapter_progress_status_idx
  on public.learner_chapter_progress(learner_id, status);

create index if not exists mission_attempts_learner_created_idx
  on public.mission_attempts(learner_id, created_at desc);

create index if not exists badge_awards_learner_awarded_idx
  on public.badge_awards(learner_id, awarded_at desc);

create index if not exists announcement_deliveries_status_idx
  on public.announcement_deliveries(status, created_at);

create or replace function public.project_z_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists learners_touch_updated_at on public.learners;

create trigger learners_touch_updated_at
  before update on public.learners
  for each row
  execute function public.project_z_touch_updated_at();

create or replace view public.leaderboard_entries as
select
  learners.id as learner_id,
  learners.nickname,
  count(distinct learner_chapter_progress.chapter_id)
    filter (where learner_chapter_progress.status = 'completed')::integer as closed_chapters_count,
  max(badge_awards.awarded_at) as last_badge_date
from public.learners
left join public.learner_chapter_progress
  on learner_chapter_progress.learner_id = learners.id
left join public.badge_awards
  on badge_awards.learner_id = learners.id
group by learners.id, learners.nickname;
