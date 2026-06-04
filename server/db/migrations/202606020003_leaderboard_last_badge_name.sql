-- Add the latest badge display name to the public trusted leaderboard view.

create or replace view public.leaderboard_entries as
select
  learners.id as learner_id,
  learners.nickname,
  count(distinct learner_chapter_progress.chapter_id)
    filter (where learner_chapter_progress.status = 'completed')::integer as closed_chapters_count,
  latest_badge.awarded_at as last_badge_date,
  latest_badge.badge_name_snapshot as last_badge_name
from public.learners
left join public.learner_chapter_progress
  on learner_chapter_progress.learner_id = learners.id
left join lateral (
  select
    badge_awards.awarded_at,
    badge_awards.badge_name_snapshot
  from public.badge_awards
  where badge_awards.learner_id = learners.id
  order by badge_awards.awarded_at desc, badge_awards.completed_chapters desc
  limit 1
) latest_badge on true
where not exists (
  select 1
  from public.suspicious_events
  where suspicious_events.learner_id = learners.id
)
group by
  learners.id,
  learners.nickname,
  latest_badge.awarded_at,
  latest_badge.badge_name_snapshot;
