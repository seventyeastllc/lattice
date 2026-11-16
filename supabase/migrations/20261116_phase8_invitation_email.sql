-- Phase 8: Invitation email via pg_net + Vault
-- Requires: pg_net extension, resend_api_key in vault.secrets

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger function: fires after every staff invitation INSERT
-- Reads Resend API key from vault, sends HTML email, logs delivery attempt
CREATE OR REPLACE FUNCTION send_invitation_email_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_key       text;
  v_org_name  text;
  v_role_lbl  text;
  v_expires   text;
  v_url       text;
  v_greeting  text;
  v_subject   text;
  v_html      text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;

  IF v_key IS NULL THEN
    RAISE WARNING 'resend_api_key not in vault — skipping email for invitation %', NEW.id;
    RETURN NEW;
  END IF;

  SELECT name INTO v_org_name FROM organizations WHERE id = NEW.org_id;
  v_org_name := COALESCE(v_org_name, 'the organization');
  v_role_lbl := CASE WHEN NEW.role = 'org_admin' THEN 'Organization Administrator' ELSE 'Staff Member' END;
  v_expires  := to_char(NEW.expires_at AT TIME ZONE 'America/New_York', 'Month DD, YYYY');
  v_url      := 'https://membership.seedxga.com/invite/' || NEW.token::text;
  v_greeting := CASE WHEN NEW.full_name IS NOT NULL THEN 'Hi ' || NEW.full_name || ', ' ELSE '' END;
  v_subject  := 'You''ve been invited to join ' || v_org_name || ' on Lattice Network';

  v_html :=
    '<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#F0F4F3;margin:0;padding:2rem 1rem">'
    '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">'
    '<div style="background:#1E3A4A;padding:1.5rem 2rem">'
    '<p style="color:#2A9D8F;font-weight:700;font-size:.875rem;letter-spacing:.08em;text-transform:uppercase;margin:0 0 .25rem">Lattice Network</p>'
    '<h1 style="color:#fff;font-size:1.375rem;font-weight:700;margin:0">You have been invited</h1>'
    '</div>'
    '<div style="padding:2rem">'
    '<p style="color:#1A2B35;font-size:.9375rem;margin:0 0 1.25rem">' || v_greeting ||
    'You have been invited to join <strong>' || v_org_name || '</strong> as a <strong>' || v_role_lbl || '</strong> on the Lattice Network.</p>'
    '<p style="color:#5C7380;font-size:.875rem;margin:0 0 1.5rem">Sign in or create an account using the email address this was sent to: <strong>' || NEW.email || '</strong>. You will complete a brief orientation and acknowledge the Rules of Engagement before accessing coordination tools.</p>'
    '<a href="' || v_url || '" style="display:inline-block;background:#2A9D8F;color:#fff;font-weight:700;font-size:.9375rem;padding:.75rem 2rem;border-radius:8px;text-decoration:none">Accept Invitation</a>'
    '<p style="color:#5C7380;font-size:.78rem;margin:1.5rem 0 0">This invitation expires on ' || v_expires || '. Reply to this email with any questions.</p>'
    '</div>'
    '<div style="background:#F0F4F3;padding:1rem 2rem;border-top:1px solid #E2E8E6">'
    '<p style="color:#5C7380;font-size:.75rem;margin:0">The Seed Exchange</p>'
    '</div></div></body></html>';

  PERFORM net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization','Bearer ' || v_key,'Content-Type','application/json'),
    body    := jsonb_build_object('from','Lattice Network <team@seedxga.com>','to',NEW.email,'subject',v_subject,'html',v_html)
  );

  INSERT INTO invitation_delivery_log(invitation_id, status)
  VALUES (NEW.id, 'queued');

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_send_invitation_email ON staff_invitations;
CREATE TRIGGER trg_send_invitation_email
AFTER INSERT ON staff_invitations
FOR EACH ROW EXECUTE FUNCTION send_invitation_email_trigger();
