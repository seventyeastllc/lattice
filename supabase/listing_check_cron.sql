-- Listing check emails — Mon / Wed / Fri at 9:00 AM Eastern (14:00 UTC)
-- Run in Supabase SQL Editor AFTER deploying the listing-check function

select cron.schedule(
  'listing-check-monday',
  '0 14 * * 1',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/listing-check',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    )
  )
  $$
);

select cron.schedule(
  'listing-check-wednesday',
  '0 14 * * 3',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/listing-check',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    )
  )
  $$
);

select cron.schedule(
  'listing-check-friday',
  '0 14 * * 5',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/listing-check',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    )
  )
  $$
);

-- Verify:
-- select jobname, schedule from cron.job where jobname like 'listing-check%';

-- Remove all three:
-- select cron.unschedule('listing-check-monday');
-- select cron.unschedule('listing-check-wednesday');
-- select cron.unschedule('listing-check-friday');
