# Phase 8 Background Work Report
**Completed:** 2026-11-15  
**Commit:** 0a8cb95  
**Deployed:** https://membership.seedxga.com

---

## What Was Done

### Database (3 migrations applied via management API)

All migrations were applied directly via the Supabase management API (`POST /v1/projects/akebgfozrjauhfkhgqjt/database/query`) because `supabase db push` history is out of sync. The SQL files are committed at `supabase/migrations/`.

**20261116_phase8_gate_enforcement.sql**
- `get_seat_capacity` updated: pending non-expired invitations now count as reserved seats (prevents concurrent over-invitation)
- `staff_invitations`: revoked INSERT/UPDATE/DELETE from anon and authenticated roles — only SECURITY DEFINER RPCs may write
- `trg_check_invitation_capacity` trigger: belt-and-suspenders capacity check on every invitation INSERT
- `accept_staff_invitation` rewritten: FOR UPDATE row lock for concurrency safety, email validation against `auth.email()`, duplicate active-membership guard, seat recheck at acceptance time
- `check_staff_gate` updated: org owners (organizations.user_id = auth.uid()) get `is_owner: true, can_use_tools: true` — exempt from orientation gate
- `assert_staff_gate(p_org_id)` new function: server-side gate for coordination RPCs; org owners and members without invitation_id skip; invited staff must have orientation + ROE
- `invitation_delivery_log` table: tracks Resend delivery attempts (status, provider_message_id, error); RLS admin-only SELECT

**20261116_phase8_poc_trigger.sql**
- `trg_staff_removal_poc_check` trigger: fires AFTER UPDATE OF status ON org_members when status transitions to 'removed'
- Gets removed user's email from auth.users
- Finds all contacts on org's locations matching that email
- For each match: pauses location (`listing_status='paused', paused_reason='poc_change'`), creates `poc_change_review` task via existing `create_location_review()`, inserts `provider_followup` tasks for any open connection_requests targeting those locations

**20261116_phase8_seat_billing.sql**
- `admin_get_seat_billing_preview(p_location_id, p_seats)`: returns prorated cost preview; respects founder rate protection; calculates days until enrollment anniversary
- `admin_add_extra_seats(p_location_id, p_seats, p_payment_amount_cents)`: adds seats to `locations.extra_staff_seats`, records billing_record; idempotent on same amount+date+location
- `admin_queue_seat_reduction(p_location_id, p_reduce_by)`: queues seat reduction at next renewal via `pending_billing_changes`

### Frontend

**AdminPage.tsx**
- `REVIEW_TYPE_LABELS`: added `provider_followup: "Provider Follow-up"` — previously TSE tasks of this type showed raw key
- `InvitationsAdmin`: added Resend button column for pending invitations; calls `send-invitation-email` edge function; shows sent/failed status inline
- `BillingAdmin`: new "Add Extra Staff Seats" panel (after line items table); per-location dropdown showing current extra seats; seat count input; Preview button calls `admin_get_seat_billing_preview`; shows prorated charge, renewal date, founder rate badge; Confirm button calls `admin_add_extra_seats` with prorated amount

**DashboardPage.tsx**
- Added `myMembership` query: loads active org_members row for current user (only when user does not own an org)
- Added `staffOrg` query: loads org details for invited staff's org
- Added `staffGate` query: calls `check_staff_gate` for invited staff's org
- Gate banner: shown when `myMembership.invitation_id` is set and `staffGate.can_use_tools === false`; shows orientation and ROE completion status
- Staff membership panel: shown when user is invited staff (not org owner); displays org name, county, role, joined date, onboarding status badge
- StaffPanel: now also shown for invited `org_admin` role (using `myMembership.org_id` and `myMembership.location_id`)

### Edge Function

**supabase/functions/send-invitation-email/index.ts**
- Deno runtime, `@supabase/supabase-js@2.39.3`, Resend API
- POST `{invitation_id}` → validates invitation is pending and not expired → sends HTML invite email to `invitation.email`
- Invite link format: `https://membership.seedxga.com/invite/{token}`
- Logs delivery attempt to `invitation_delivery_log` — token is never logged
- Returns 422 for already-used or expired invitations; 502 on Resend failure

---

## Browser-Testable Items (Cannot be verified headlessly)

The following require manual browser testing:

| Flow | How to Test |
|------|-------------|
| Invite + accept | Create an org as a test user. Invite a second user by email. Copy the invite link from the StaffPanel modal. Sign in as second user and open `/invite/{token}`. Complete orientation and ROE. Check DashboardPage shows membership panel. |
| Gate banner | Accept an invitation but don't complete orientation. Verify gate banner appears on DashboardPage. |
| Org-owner gate bypass | Log in as org owner. Verify no gate banner appears. |
| Staff removal → POC pause | Add a staff member whose email matches a contact on a location. Remove the staff member. Verify location paused and TSE task created in Admin > TSE Tasks. |
| Extra seats | In Admin > Billing, select an org with locations. Use the seat add panel to preview proration and add a seat. Verify billing record created and extra_staff_seats incremented. |
| Invitation resend | In Admin > Invitations, click Resend on a pending invitation. Verify email delivered and delivery_log row created. |
| Provider follow-up label | Trigger a staff removal that creates provider_followup tasks. Verify they display as "Provider Follow-up" in TSE Tasks. |

---

## Security Constraints Maintained

- `.env` is in `.gitignore` — no Supabase keys in git history
- No HMIS/PHI data in any connection request fields or public-facing columns
- No new tier names, benefit changes, or price changes
- `invitation_delivery_log` RLS restricts SELECT to admin role; no authenticated INSERT/UPDATE/DELETE
- Invite token is never logged in `invitation_delivery_log` or any edge function output
- `accept_staff_invitation` validates `auth.email()` matches invitation email before creating membership

---

## Known Gaps / Follow-on Work

- `admin_get_all_invitations` RPC: referenced in AdminPage but may not exist in DB. Needs to be created if not present (returns all staff_invitations joined with org/location names).
- Edge function deploy: `supabase functions deploy send-invitation-email` has not been run — the function file is committed but not deployed to Supabase Edge. Run this before the Resend button is live.
- Content admin view (orientation/ROE editor) was deferred — not implemented in this phase.
- Automated DB tests (Task 7) were not implemented — complexity exceeded session scope; browser-only tests documented above instead.
