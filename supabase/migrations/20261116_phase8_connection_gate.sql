-- Phase 8: enforce staff orientation gate on connection_requests INSERT
-- connection_requests are inserted directly (no RPC wrapper), so gate is enforced via trigger

CREATE OR REPLACE FUNCTION trg_connection_request_gate_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org_id uuid;
BEGIN
  SELECT o.id INTO v_org_id
  FROM locations l
  JOIN organizations o ON o.id = l.organization_id
  WHERE l.id = NEW.location_id
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    PERFORM assert_staff_gate(v_org_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_connection_request_gate ON connection_requests;
CREATE TRIGGER trg_connection_request_gate
BEFORE INSERT ON connection_requests
FOR EACH ROW EXECUTE FUNCTION trg_connection_request_gate_fn();
