do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on public.badge_awards to service_role;
    grant select on public.learners to service_role;
    grant select, update on public.announcement_deliveries to service_role;
  end if;
end;
$$;
