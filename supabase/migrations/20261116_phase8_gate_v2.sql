-- Phase 8: Fix assert_staff_gate — remove invitation_id NULL exemption
-- Only org owners are exempt. All staff (invited or manually added) must pass the gate.

CREATE OR REPLACE FUNCTION assert_staff_gate(p_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gate jsonb;
BEGIN
  -- Org owners are always exempt
  IF EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id AND user_id = auth.uid()) THEN
    RETURN;
  END IF;
  -- Everyone else must pass the gate regardless of how they were added
  SELECT check_staff_gate(p_org_id) INTO v_gate;
  IF NOT (v_gate->>'can_use_tools')::boolean THEN
    RAISE EXCEPTION 'Orientation and Rules of Engagement must be completed before using coordination tools';
  END IF;
END;
$$;
