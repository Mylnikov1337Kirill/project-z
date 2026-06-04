create or replace function public.project_z_get_chapter_reflection(
  p_pilot_session_id uuid,
  p_chapter_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pilot_sessions;
  v_learner public.learners;
  v_reflection public.chapter_reflections;
begin
  v_session := public.project_z_assert_active_pilot_session(p_pilot_session_id);

  select *
  into v_learner
  from public.learners
  where pilot_session_id = v_session.id;

  if not found then
    raise exception 'learner_not_identified' using errcode = '28000';
  end if;

  select *
  into v_reflection
  from public.chapter_reflections
  where learner_id = v_learner.id
    and chapter_id = p_chapter_id;

  return jsonb_build_object(
    'reflection',
    case
      when v_reflection.chapter_id is null then null
      else jsonb_build_object(
        'chapterId', v_reflection.chapter_id,
        'optionId', v_reflection.option_id,
        'optionLabel', v_reflection.option_label,
        'note', v_reflection.note,
        'skipped', v_reflection.skipped,
        'updatedAt', v_reflection.updated_at
      )
    end
  );
end;
$$;

create or replace function public.project_z_save_chapter_reflection(
  p_pilot_session_id uuid,
  p_chapter_id text,
  p_option_id text,
  p_option_label text,
  p_note text,
  p_skipped boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pilot_sessions;
  v_learner public.learners;
  v_reflection public.chapter_reflections;
  v_option_id text := nullif(
    left(regexp_replace(btrim(coalesce(p_option_id, '')), '\s+', ' ', 'g'), 80),
    ''
  );
  v_option_label text := nullif(
    left(regexp_replace(btrim(coalesce(p_option_label, '')), '\s+', ' ', 'g'), 80),
    ''
  );
  v_note text := left(
    regexp_replace(btrim(coalesce(p_note, '')), '\s+', ' ', 'g'),
    180
  );
begin
  v_session := public.project_z_assert_active_pilot_session(p_pilot_session_id);

  select *
  into v_learner
  from public.learners
  where pilot_session_id = v_session.id;

  if not found then
    raise exception 'learner_not_identified' using errcode = '28000';
  end if;

  if p_skipped is true then
    v_option_id := null;
    v_option_label := null;
    v_note := '';
  end if;

  insert into public.chapter_reflections (
    learner_id,
    chapter_id,
    option_id,
    option_label,
    note,
    skipped,
    updated_at
  )
  values (
    v_learner.id,
    p_chapter_id,
    v_option_id,
    v_option_label,
    v_note,
    coalesce(p_skipped, false),
    now()
  )
  on conflict (learner_id, chapter_id) do update
    set option_id = excluded.option_id,
        option_label = excluded.option_label,
        note = excluded.note,
        skipped = excluded.skipped,
        updated_at = now()
  returning * into v_reflection;

  return jsonb_build_object(
    'reflection',
    jsonb_build_object(
      'chapterId', v_reflection.chapter_id,
      'optionId', v_reflection.option_id,
      'optionLabel', v_reflection.option_label,
      'note', v_reflection.note,
      'skipped', v_reflection.skipped,
      'updatedAt', v_reflection.updated_at
    )
  );
end;
$$;

create or replace function public.project_z_mark_unlock_seen(
  p_pilot_session_id uuid,
  p_chapter_id text,
  p_chapter_ids text[],
  p_first_chapter_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pilot_sessions;
  v_learner public.learners;
begin
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

  update public.learner_chapter_progress
  set unlock_seen_at = coalesce(unlock_seen_at, now())
  where learner_id = v_learner.id
    and chapter_id = p_chapter_id;

  return public.project_z_progress_payload(v_learner.id, p_chapter_ids);
end;
$$;

revoke all on function public.project_z_get_chapter_reflection(uuid, text) from public;
revoke all on function public.project_z_save_chapter_reflection(uuid, text, text, text, text, boolean) from public;
revoke all on function public.project_z_mark_unlock_seen(uuid, text, text[], text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.project_z_get_chapter_reflection(uuid, text) to service_role;
    grant execute on function public.project_z_save_chapter_reflection(uuid, text, text, text, text, boolean) to service_role;
    grant execute on function public.project_z_mark_unlock_seen(uuid, text, text[], text) to service_role;
  end if;
end;
$$;
