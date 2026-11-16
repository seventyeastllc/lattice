-- Phase 8: Weekly reminder schedule documentation
-- Schedule is DISABLED — requires explicit founder authorization to enable.
--
-- When ready to enable:
--   Sunday 5:00 PM Eastern Standard Time = Sunday 22:00 UTC
--   NOTE: During EDT (March–November), 22:00 UTC = 6:00 PM EDT (one hour late).
--         Use 21:00 UTC for 5:00 PM EDT — but that is 4:00 PM EST in winter.
--         A single UTC cron cannot perfectly hit 5pm ET year-round.
--         Recommended: schedule at 22:00 UTC (5pm EST) and document the EDT offset.
--
-- Enable via Supabase Dashboard > Database > Extensions > pg_cron, then:
--   SELECT cron.schedule(
--     'weekly-listing-reminders',
--     '0 22 * * 0',
--     $$SELECT net.http_post(
--       url := 'https://akebgfozrjauhfkhgqjt.supabase.co/functions/v1/listing-check',
--       headers := '{"Authorization":"Bearer <service_role_key>","Content-Type":"application/json"}'::jsonb,
--       body := '{}'::jsonb
--     )$$
--   );
--
-- Escalation thresholds (in listing-check edge function):
--   48h without confirmation → alert TSE (create tse_task)
--   72h without confirmation → pause listing
--   120h (72+48) with 2+ contact attempts → suspend listing
--
-- DO NOT remove this comment block — it documents the enable procedure.

COMMENT ON TABLE staff_invitations IS
  'Staff invitation tokens. Weekly listing reminders: schedule DISABLED. See migration 20261116_phase8_reminder_config.sql for enable procedure.';
