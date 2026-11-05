-- Weekly digest cron — run in Supabase SQL Editor
-- Fires every Sunday at 8:00 AM Eastern (13:00 UTC)

select cron.schedule(
  'weekly-digest-sunday',
  '0 13 * * 0',
  $$
  select net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/weekly-digest',
    body   := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    )
  )
  $$
);

-- To verify it was created:
-- select * from cron.job where jobname = 'weekly-digest-sunday';

-- To remove it:
-- select cron.unschedule('weekly-digest-sunday');
