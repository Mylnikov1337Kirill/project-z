-- AI-autopass telemetry and trusted leaderboard policy.

create table if not exists public.mission_starts (
  learner_id uuid not null references public.learners(id) on delete cascade,
  pilot_session_id uuid not null references public.pilot_sessions(id) on delete cascade,
  chapter_id text not null,
  mission_id text not null,
  started_at timestamptz not null default now(),
  primary key (learner_id, chapter_id, mission_id)
);

create table if not exists public.suspicious_events (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  pilot_session_id uuid not null references public.pilot_sessions(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 80),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mission_starts_learner_mission_idx
  on public.mission_starts(learner_id, mission_id);

create index if not exists suspicious_events_learner_created_idx
  on public.suspicious_events(learner_id, created_at desc);

create index if not exists suspicious_events_session_created_idx
  on public.suspicious_events(pilot_session_id, created_at desc);

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
where not exists (
  select 1
  from public.suspicious_events
  where suspicious_events.learner_id = learners.id
)
group by learners.id, learners.nickname;
