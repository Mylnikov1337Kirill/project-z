create or replace function public.project_z_current_pilot_session_id()
returns uuid
language sql
stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'pilot_session_id',
    ''
  )::uuid;
$$;

alter table public.pilot_sessions enable row level security;
alter table public.learners enable row level security;
alter table public.learner_chapter_progress enable row level security;
alter table public.mission_attempts enable row level security;
alter table public.completed_missions enable row level security;
alter table public.badge_awards enable row level security;
alter table public.trap_discoveries enable row level security;
alter table public.chapter_reflections enable row level security;
alter table public.announcement_deliveries enable row level security;

drop policy if exists pilot_sessions_read_own on public.pilot_sessions;
create policy pilot_sessions_read_own
  on public.pilot_sessions
  for select
  using (id = public.project_z_current_pilot_session_id());

drop policy if exists learners_read_own on public.learners;
create policy learners_read_own
  on public.learners
  for select
  using (pilot_session_id = public.project_z_current_pilot_session_id());

drop policy if exists learners_insert_own on public.learners;
create policy learners_insert_own
  on public.learners
  for insert
  with check (pilot_session_id = public.project_z_current_pilot_session_id());

drop policy if exists learners_update_own_profile on public.learners;
create policy learners_update_own_profile
  on public.learners
  for update
  using (pilot_session_id = public.project_z_current_pilot_session_id())
  with check (pilot_session_id = public.project_z_current_pilot_session_id());

drop policy if exists learner_chapter_progress_read_own on public.learner_chapter_progress;
create policy learner_chapter_progress_read_own
  on public.learner_chapter_progress
  for select
  using (
    exists (
      select 1
      from public.learners
      where learners.id = learner_chapter_progress.learner_id
        and learners.pilot_session_id = public.project_z_current_pilot_session_id()
    )
  );

drop policy if exists mission_attempts_read_own on public.mission_attempts;
create policy mission_attempts_read_own
  on public.mission_attempts
  for select
  using (
    exists (
      select 1
      from public.learners
      where learners.id = mission_attempts.learner_id
        and learners.pilot_session_id = public.project_z_current_pilot_session_id()
    )
  );

drop policy if exists completed_missions_read_own on public.completed_missions;
create policy completed_missions_read_own
  on public.completed_missions
  for select
  using (
    exists (
      select 1
      from public.learners
      where learners.id = completed_missions.learner_id
        and learners.pilot_session_id = public.project_z_current_pilot_session_id()
    )
  );

drop policy if exists badge_awards_read_own on public.badge_awards;
create policy badge_awards_read_own
  on public.badge_awards
  for select
  using (
    exists (
      select 1
      from public.learners
      where learners.id = badge_awards.learner_id
        and learners.pilot_session_id = public.project_z_current_pilot_session_id()
    )
  );

drop policy if exists trap_discoveries_read_own on public.trap_discoveries;
create policy trap_discoveries_read_own
  on public.trap_discoveries
  for select
  using (
    exists (
      select 1
      from public.learners
      where learners.id = trap_discoveries.learner_id
        and learners.pilot_session_id = public.project_z_current_pilot_session_id()
    )
  );

drop policy if exists chapter_reflections_read_own on public.chapter_reflections;
create policy chapter_reflections_read_own
  on public.chapter_reflections
  for select
  using (
    exists (
      select 1
      from public.learners
      where learners.id = chapter_reflections.learner_id
        and learners.pilot_session_id = public.project_z_current_pilot_session_id()
    )
  );

drop policy if exists chapter_reflections_insert_own on public.chapter_reflections;
create policy chapter_reflections_insert_own
  on public.chapter_reflections
  for insert
  with check (
    exists (
      select 1
      from public.learners
      where learners.id = chapter_reflections.learner_id
        and learners.pilot_session_id = public.project_z_current_pilot_session_id()
    )
  );

drop policy if exists chapter_reflections_update_own on public.chapter_reflections;
create policy chapter_reflections_update_own
  on public.chapter_reflections
  for update
  using (
    exists (
      select 1
      from public.learners
      where learners.id = chapter_reflections.learner_id
        and learners.pilot_session_id = public.project_z_current_pilot_session_id()
    )
  )
  with check (
    exists (
      select 1
      from public.learners
      where learners.id = chapter_reflections.learner_id
        and learners.pilot_session_id = public.project_z_current_pilot_session_id()
    )
  );

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on public.pilot_sessions to authenticated;
    grant select, insert, update (nickname, full_name) on public.learners to authenticated;
    grant select on public.learner_chapter_progress to authenticated;
    grant select on public.mission_attempts to authenticated;
    grant select on public.completed_missions to authenticated;
    grant select on public.badge_awards to authenticated;
    grant select on public.trap_discoveries to authenticated;
    grant select, insert, update on public.chapter_reflections to authenticated;
    revoke all on public.announcement_deliveries from authenticated;
  end if;
end;
$$;
