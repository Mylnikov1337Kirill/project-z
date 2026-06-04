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

create or replace function public.project_z_session_json(
  session_row public.pilot_sessions
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', session_row.id::text,
    'publicCode', session_row.public_code,
    'createdAt', session_row.created_at,
    'expiresAt', session_row.expires_at,
    'revokedAt', session_row.revoked_at,
    'lastSeenAt', session_row.last_seen_at
  );
$$;

create or replace function public.project_z_learner_json(
  learner_row public.learners
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', learner_row.id::text,
    'nickname', learner_row.nickname,
    'fullName', coalesce(learner_row.full_name, '')
  );
$$;

create or replace function public.project_z_progress_payload(
  p_learner_id uuid,
  p_chapter_ids text[]
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ordered_chapters as (
    select chapter_id, ordinality
    from unnest(coalesce(p_chapter_ids, array[]::text[]))
      with ordinality as item(chapter_id, ordinality)
  ),
  progress_rows as (
    select
      ordered_chapters.chapter_id,
      ordered_chapters.ordinality,
      coalesce(learner_chapter_progress.status, 'locked') as status
    from ordered_chapters
    left join public.learner_chapter_progress
      on learner_chapter_progress.learner_id = p_learner_id
      and learner_chapter_progress.chapter_id = ordered_chapters.chapter_id
  ),
  progress_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'chapterId', progress_rows.chapter_id,
          'status', progress_rows.status,
          'completedMissionIds', coalesce(
            (
              select jsonb_agg(
                completed_missions.mission_id
                order by completed_missions.first_completed_at,
                         completed_missions.mission_id
              )
              from public.completed_missions
              where completed_missions.learner_id = p_learner_id
                and completed_missions.chapter_id = progress_rows.chapter_id
            ),
            '[]'::jsonb
          )
        )
        order by progress_rows.ordinality
      ),
      '[]'::jsonb
    ) as value
    from progress_rows
  ),
  completed_missions_json as (
    select coalesce(
      jsonb_agg(
        completed_missions.mission_id
        order by completed_missions.first_completed_at,
                 completed_missions.mission_id
      ),
      '[]'::jsonb
    ) as value
    from public.completed_missions
    where completed_missions.learner_id = p_learner_id
  ),
  traps_json as (
    select coalesce(
      jsonb_agg(
        trap_discoveries.trap_id
        order by trap_discoveries.first_seen_at, trap_discoveries.trap_id
      ),
      '[]'::jsonb
    ) as value
    from public.trap_discoveries
    where trap_discoveries.learner_id = p_learner_id
  ),
  pending_unlock as (
    select learner_chapter_progress.chapter_id
    from public.learner_chapter_progress
    where learner_chapter_progress.learner_id = p_learner_id
      and learner_chapter_progress.status = 'open'
      and learner_chapter_progress.opened_at is not null
      and learner_chapter_progress.unlock_seen_at is null
      and learner_chapter_progress.chapter_id <> coalesce(p_chapter_ids[1], '')
    order by array_position(p_chapter_ids, learner_chapter_progress.chapter_id)
    limit 1
  )
  select jsonb_build_object(
    'progress', progress_json.value,
    'completedMissionIds', completed_missions_json.value,
    'encounteredTrapIds', traps_json.value,
    'pendingUnlockChapterId', (select chapter_id from pending_unlock)
  )
  from progress_json, completed_missions_json, traps_json;
$$;

revoke all on function public.project_z_progress_payload(uuid, text[]) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on public.leaderboard_entries to service_role;
    grant execute on function public.project_z_progress_payload(uuid, text[]) to service_role;
  end if;
end;
$$;
