drop function if exists public.project_z_submit_mission_attempt(
  uuid, text[], text, text, text, jsonb, boolean, integer, text, text, text[], boolean, text, text
);

create or replace function public.project_z_submit_mission_attempt(
  p_pilot_session_id uuid,
  p_chapter_ids text[],
  p_first_chapter_id text,
  p_chapter_id text,
  p_mission_id text,
  p_required_previous_mission_ids text[],
  p_answer_json jsonb,
  p_is_correct boolean,
  p_score integer,
  p_content_version text,
  p_client_attempt_id text,
  p_encountered_trap_ids text[],
  p_is_chapter_boss boolean,
  p_next_chapter_id text,
  p_badge_name_snapshot text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pilot_sessions;
  v_learner public.learners;
  v_attempt public.mission_attempts;
  v_completion jsonb := null;
  v_completed_at timestamptz;
  v_completed_chapters integer := 0;
  v_badge_award_id uuid;
  v_chapter_status text;
  v_event_id text;
  v_missing_required_mission_ids text[];
  v_progress jsonb;
  v_trap_discoveries jsonb := '[]'::jsonb;
begin
  if nullif(btrim(coalesce(p_client_attempt_id, '')), '') is null then
    raise exception 'client_attempt_id_required' using errcode = '22023';
  end if;

  if p_score < 0 or p_score > 100 then
    raise exception 'invalid_score' using errcode = '22023';
  end if;

  v_session := public.project_z_assert_active_pilot_session(p_pilot_session_id);

  select *
  into v_learner
  from public.learners
  where pilot_session_id = v_session.id;

  if not found then
    raise exception 'learner_not_identified' using errcode = '28000';
  end if;

  perform public.project_z_ensure_learner_progress(
    v_learner.id,
    p_chapter_ids,
    p_first_chapter_id
  );

  select status
  into v_chapter_status
  from public.learner_chapter_progress
  where learner_id = v_learner.id
    and chapter_id = p_chapter_id;

  if coalesce(v_chapter_status, 'locked') not in ('open', 'completed') then
    raise exception 'chapter_not_open' using errcode = '28000';
  end if;

  if v_chapter_status <> 'completed' then
    with required_missions as (
      select required_mission_id, ordinality
      from unnest(coalesce(p_required_previous_mission_ids, array[]::text[]))
        with ordinality as item(required_mission_id, ordinality)
      where required_mission_id is not null and required_mission_id <> ''
    )
    select array_agg(required_missions.required_mission_id order by required_missions.ordinality)
    into v_missing_required_mission_ids
    from required_missions
    where not exists (
      select 1
      from public.completed_missions
      where completed_missions.learner_id = v_learner.id
        and completed_missions.chapter_id = p_chapter_id
        and completed_missions.mission_id = required_missions.required_mission_id
    );

    if coalesce(array_length(v_missing_required_mission_ids, 1), 0) > 0 then
      raise exception 'mission_not_open' using errcode = '28000';
    end if;
  end if;

  select *
  into v_attempt
  from public.mission_attempts
  where learner_id = v_learner.id
    and client_attempt_id = p_client_attempt_id;

  if found then
    if v_attempt.chapter_id <> p_chapter_id
      or v_attempt.mission_id <> p_mission_id
    then
      raise exception 'client_attempt_id_reused_for_different_mission'
        using errcode = '23505';
    end if;

    if p_is_chapter_boss and v_attempt.is_correct then
      select count(*) filter (where status = 'completed')
      into v_completed_chapters
      from public.learner_chapter_progress
      where learner_id = v_learner.id;

      select completed_at
      into v_completed_at
      from public.learner_chapter_progress
      where learner_id = v_learner.id
        and chapter_id = v_attempt.chapter_id
        and status = 'completed';

      if v_completed_at is not null then
        v_completion := jsonb_build_object(
          'learnerId', v_learner.id::text,
          'chapterId', v_attempt.chapter_id,
          'completedChapters', v_completed_chapters,
          'completedAt', v_completed_at
        );
      end if;
    end if;

    v_progress := public.project_z_progress_payload(v_learner.id, p_chapter_ids);

    return jsonb_build_object(
      'duplicate', true,
      'attempt', jsonb_build_object(
        'answer', v_attempt.answer_json,
        'chapterId', v_attempt.chapter_id,
        'missionId', v_attempt.mission_id,
        'isCorrect', v_attempt.is_correct,
        'score', v_attempt.score,
        'contentVersion', v_attempt.content_version,
        'clientAttemptId', v_attempt.client_attempt_id,
        'createdAt', v_attempt.created_at
      ),
      'completion', v_completion,
      'progress', v_progress -> 'progress',
      'completedMissionIds', v_progress -> 'completedMissionIds',
      'trapDiscoveries', v_trap_discoveries
    );
  end if;

  with requested_traps as (
    select distinct trap_id
    from unnest(coalesce(p_encountered_trap_ids, array[]::text[])) as trap_id
    where trap_id is not null and trap_id <> ''
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', requested_traps.trap_id,
        'isNew', trap_discoveries.trap_id is null
      )
      order by requested_traps.trap_id
    ),
    '[]'::jsonb
  )
  into v_trap_discoveries
  from requested_traps
  left join public.trap_discoveries
    on trap_discoveries.learner_id = v_learner.id
    and trap_discoveries.trap_id = requested_traps.trap_id;

  insert into public.mission_attempts (
    learner_id,
    chapter_id,
    mission_id,
    answer_json,
    is_correct,
    score,
    content_version,
    client_attempt_id,
    created_at
  )
  values (
    v_learner.id,
    p_chapter_id,
    p_mission_id,
    coalesce(p_answer_json, 'null'::jsonb),
    p_is_correct,
    p_score,
    p_content_version,
    p_client_attempt_id,
    now()
  )
  returning * into v_attempt;

  if p_is_correct then
    insert into public.completed_missions (
      learner_id,
      chapter_id,
      mission_id,
      first_completed_at
    )
    values (v_learner.id, p_chapter_id, p_mission_id, now())
    on conflict (learner_id, chapter_id, mission_id) do nothing;
  end if;

  insert into public.trap_discoveries (learner_id, trap_id, first_seen_at)
  select v_learner.id, trap_id, now()
  from unnest(coalesce(p_encountered_trap_ids, array[]::text[])) as trap_id
  where trap_id is not null and trap_id <> ''
  on conflict (learner_id, trap_id) do nothing;

  if p_is_correct and p_is_chapter_boss then
    update public.learner_chapter_progress
    set status = 'completed',
        completed_at = coalesce(completed_at, now())
    where learner_id = v_learner.id
      and chapter_id = p_chapter_id
    returning completed_at into v_completed_at;

    if not found then
      insert into public.learner_chapter_progress (
        learner_id,
        chapter_id,
        status,
        opened_at,
        completed_at,
        unlock_seen_at
      )
      values (
        v_learner.id,
        p_chapter_id,
        'completed',
        now(),
        now(),
        now()
      )
      returning completed_at into v_completed_at;
    end if;

    if nullif(btrim(coalesce(p_next_chapter_id, '')), '') is not null then
      insert into public.learner_chapter_progress (
        learner_id,
        chapter_id,
        status,
        opened_at,
        unlock_seen_at
      )
      values (v_learner.id, p_next_chapter_id, 'open', now(), null)
      on conflict (learner_id, chapter_id) do update
        set status = case
              when public.learner_chapter_progress.status = 'completed'
                then public.learner_chapter_progress.status
              else 'open'
            end,
            opened_at = coalesce(public.learner_chapter_progress.opened_at, now());
    end if;

    select count(*) filter (where status = 'completed')
    into v_completed_chapters
    from public.learner_chapter_progress
    where learner_id = v_learner.id;

    v_event_id := concat(
      'project-z:badge:',
      v_learner.id::text,
      ':',
      p_chapter_id
    );

    insert into public.badge_awards (
      learner_id,
      chapter_id,
      badge_name_snapshot,
      completed_chapters,
      awarded_at,
      event_id
    )
    values (
      v_learner.id,
      p_chapter_id,
      p_badge_name_snapshot,
      v_completed_chapters,
      coalesce(v_completed_at, now()),
      v_event_id
    )
    on conflict (learner_id, chapter_id) do nothing
    returning id into v_badge_award_id;

    if v_badge_award_id is not null then
      insert into public.announcement_deliveries (
        badge_award_id,
        channel,
        status,
        idempotency_key
      )
      values (
        v_badge_award_id,
        'pachca',
        'pending',
        concat('pachca:', v_event_id)
      )
      on conflict (idempotency_key) do nothing;
    end if;

    v_completion := jsonb_build_object(
      'learnerId', v_learner.id::text,
      'chapterId', p_chapter_id,
      'completedChapters', v_completed_chapters,
      'completedAt', v_completed_at
    );
  end if;

  v_progress := public.project_z_progress_payload(v_learner.id, p_chapter_ids);

  return jsonb_build_object(
    'duplicate', false,
    'attempt', jsonb_build_object(
      'answer', v_attempt.answer_json,
      'chapterId', v_attempt.chapter_id,
      'missionId', v_attempt.mission_id,
      'isCorrect', v_attempt.is_correct,
      'score', v_attempt.score,
      'contentVersion', v_attempt.content_version,
      'clientAttemptId', v_attempt.client_attempt_id,
      'createdAt', v_attempt.created_at
    ),
    'completion', v_completion,
    'progress', v_progress -> 'progress',
    'completedMissionIds', v_progress -> 'completedMissionIds',
    'trapDiscoveries', v_trap_discoveries
  );
end;
$$;

revoke all on function public.project_z_submit_mission_attempt(
  uuid, text[], text, text, text, text[], jsonb, boolean, integer, text, text, text[], boolean, text, text
) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.project_z_submit_mission_attempt(
      uuid, text[], text, text, text, text[], jsonb, boolean, integer, text, text, text[], boolean, text, text
    ) to service_role;
  end if;
end;
$$;
