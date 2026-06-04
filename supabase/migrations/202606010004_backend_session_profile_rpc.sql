create or replace function public.project_z_assert_active_pilot_session(
  p_pilot_session_id uuid
)
returns public.pilot_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pilot_sessions;
begin
  select *
  into v_session
  from public.pilot_sessions
  where id = p_pilot_session_id
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'invalid_pilot_session' using errcode = '28000';
  end if;

  update public.pilot_sessions
  set last_seen_at = now()
  where id = v_session.id
  returning * into v_session;

  return v_session;
end;
$$;

create or replace function public.project_z_ensure_learner_progress(
  p_learner_id uuid,
  p_chapter_ids text[],
  p_first_chapter_id text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.learner_chapter_progress (
    learner_id,
    chapter_id,
    status,
    opened_at,
    unlock_seen_at
  )
  select
    p_learner_id,
    chapter_id,
    case when chapter_id = p_first_chapter_id then 'open' else 'locked' end,
    case when chapter_id = p_first_chapter_id then now() else null end,
    case when chapter_id = p_first_chapter_id then now() else null end
  from unnest(coalesce(p_chapter_ids, array[]::text[])) as chapter_id
  on conflict (learner_id, chapter_id) do nothing;
$$;

create or replace function public.project_z_create_pilot_session(
  p_public_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_public_code text := nullif(btrim(p_public_code), '');
  v_session public.pilot_sessions;
begin
  if v_public_code is not null then
    select *
    into v_session
    from public.pilot_sessions
    where public_code = v_public_code
      and revoked_at is null
      and (expires_at is null or expires_at > now());

    if found then
      update public.pilot_sessions
      set last_seen_at = now()
      where id = v_session.id
      returning * into v_session;

      return jsonb_build_object(
        'pilotSession',
        public.project_z_session_json(v_session)
      );
    end if;
  end if;

  insert into public.pilot_sessions (public_code, last_seen_at)
  values (v_public_code, now())
  returning * into v_session;

  return jsonb_build_object(
    'pilotSession',
    public.project_z_session_json(v_session)
  );
end;
$$;

create or replace function public.project_z_get_me(
  p_pilot_session_id uuid
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

  return jsonb_build_object(
    'pilotSession', public.project_z_session_json(v_session),
    'learner',
      case
        when v_learner.id is null then null
        else public.project_z_learner_json(v_learner)
      end
  );
end;
$$;

create or replace function public.project_z_identify_learner(
  p_pilot_session_id uuid,
  p_nickname text,
  p_full_name text,
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
  v_nickname text := left(
    regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g'),
    40
  );
  v_full_name text := nullif(
    left(regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g'), 120),
    ''
  );
begin
  if v_nickname = '' then
    raise exception 'nickname_required' using errcode = '22023';
  end if;

  v_session := public.project_z_assert_active_pilot_session(p_pilot_session_id);

  insert into public.learners (pilot_session_id, nickname, full_name)
  values (v_session.id, v_nickname, v_full_name)
  on conflict (pilot_session_id) do update
    set nickname = excluded.nickname,
        full_name = excluded.full_name
  returning * into v_learner;

  perform public.project_z_ensure_learner_progress(
    v_learner.id,
    p_chapter_ids,
    p_first_chapter_id
  );

  return jsonb_build_object(
    'learner',
    public.project_z_learner_json(v_learner)
  );
end;
$$;

create or replace function public.project_z_get_progress(
  p_pilot_session_id uuid,
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
  v_progress jsonb;
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

  v_progress := public.project_z_progress_payload(v_learner.id, p_chapter_ids);

  return v_progress || jsonb_build_object(
    'learner',
    public.project_z_learner_json(v_learner)
  );
end;
$$;

revoke all on function public.project_z_assert_active_pilot_session(uuid) from public;
revoke all on function public.project_z_ensure_learner_progress(uuid, text[], text) from public;
revoke all on function public.project_z_create_pilot_session(text) from public;
revoke all on function public.project_z_get_me(uuid) from public;
revoke all on function public.project_z_identify_learner(uuid, text, text, text[], text) from public;
revoke all on function public.project_z_get_progress(uuid, text[], text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.project_z_create_pilot_session(text) to service_role;
    grant execute on function public.project_z_get_me(uuid) to service_role;
    grant execute on function public.project_z_identify_learner(uuid, text, text, text[], text) to service_role;
    grant execute on function public.project_z_get_progress(uuid, text[], text) to service_role;
  end if;
end;
$$;
