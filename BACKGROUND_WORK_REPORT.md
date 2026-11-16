# Background Work Report — Phase 8 Final
**Completed:** 2026-11-16  
**Commits:** 513cd03 → a84e93e  
**Deployed:** https://membership.seedxga.com (Netlify deploy 6afa62f2e25fd616f9fd99e6)

---

## Baseline (at start of this session)

- Last committed: 513cd03 (report update), f118a70 (email trigger), 0a8cb95 (phase 8 main)
- Invitation email confirmed working via pg_net + Vault trigger
- seedxga.com verified in Resend
- Task 5 (POC-change trigger): already complete — `contacts_poc_change()` handles INSERT/UPDATE/DELETE on the contacts table

---

## Completed

### Task 1 — Staff gate hardening
**Migration:** `20261116_phase8_gate_v2.sql`

- `assert_staff_gate` no longer exempts users with `invitation_id IS NULL`
- Only org owners (`organizations.user_id = auth.uid()`) bypass the gate
- All invited and manually-added staff must pass orientation + ROE
- Verified: `invitation_id` string absent from new function body; org-owner exemption present

### Task 2 — Multi-location staff
**Migration:** `20261116_phase8_multilocation.sql`

- `org_members` role check updated: `CHECK (role IN ('org_admin', 'staff'))` — was incorrectly `('owner','admin','member')` from pre-Phase-8 schema
- Unique constraint changed: `org_members_org_id_user_id_key` → `org_members_unique_per_location UNIQUE (org_id, location_id, user_id) DEFERRABLE INITIALLY DEFERRED`
- `org_invite_staff` updated: FOR UPDATE lock on location row; raises exception on duplicate pending invitation (instead of silently cancelling)
- `accept_staff_invitation` updated: duplicate check is per-location (allows same user at different location in same org)
- `org_assign_existing_staff(org_id, location_id, user_id, role)` — new RPC for assigning existing org member to additional location
- `org_get_staff` updated: returns all assignments per user with `location_name`, `can_use_tools`; return type changed (required DROP FUNCTION first)

**Frontend (DashboardPage.tsx):**
- `myMembership` query replaced with `myMemberships` (array) fetching all active org_members rows
- `myMembership` derived as `myMemberships[0]` for org-level lookups (backward-compatible)
- Gate banner uses `myMemberships.length > 0` instead of `myMembership.invitation_id`
- **My Account section**: shows org name, onboarding status (orientation ✓/○, ROE ✓/○), and all location assignments with role and join date

### Task 3 — Invitation and seat enforcement
Folded into Task 2 migration:
- `org_invite_staff` now holds a FOR UPDATE lock on the location row before capacity check (serializes concurrent invitations)
- Duplicate pending invitation raises an exception — prevents re-inviting without waiting for expiry or resending

### Task 4 — Invitation delivery reconciliation
**Migration:** `20261116_phase8_resend_rpc.sql`  
**Frontend (AdminPage.tsx):**

- `admin_resend_invitation(p_invitation_id uuid)` — new RPC; validates admin role, checks invitation is pending and not expired, reads Resend key from Vault, sends HTML email via `net.http_post`, logs delivery attempt to `invitation_delivery_log`
- AdminPage Resend button now calls `supabase.rpc('admin_resend_invitation', ...)` — eliminates call to undeployed `send-invitation-email` edge function
- Edge function file kept in repo for reference but no longer called

### Task 5 — POC-change and location-hold interactions
**Already complete** (implemented earlier in Phase 8):
- `trg_contacts_poc_change` trigger covers INSERT, UPDATE, DELETE on `contacts` table
- `contacts_poc_change()` handles: DELETE of primary contact, INSERT of new primary when another exists, UPDATE that changes primary flag or material fields (name/email/phone)
- Pauses location, creates `poc_change_review` task (urgent, 24h SLA)
- `trg_staff_removal_poc_check` handles staff removal → poc pause + provider followup tasks

### Task 6 — Extra-seat billing fix
**Migration:** `20261116_phase8_billing_fix.sql`

- `admin_get_seat_billing_preview` now uses `billing_records.coverage_end` (most recent) as renewal anchor for the org, not location enrollment anniversary
- Falls back to enrollment anniversary if no billing records exist
- Both advance past today in a WHILE loop to get next upcoming renewal

### Task 7 — Content administration UI
**Frontend (AdminPage.tsx):**

- `ContentAdmin` component added — tab-switched Orientation / Rules of Engagement
- Left panel: lists existing versions with Active and Test badges
- Right panel: form with version string, title, HTML textarea, is_test checkbox, Preview toggle, Publish button
- Publish calls `admin_upsert_orientation` or `admin_upsert_roe` RPC
- Preview: `dangerouslySetInnerHTML` with inline `<script>` strip (no external sanitizer)
- Added "Content" nav item (📄) to AdminPage sidebar

### Task 8 — Weekly reminders configuration
**Migration:** `20261116_phase8_reminder_config.sql`

- Schedule remains DISABLED
- Documented enable procedure: `cron.schedule('weekly-listing-reminders', '0 22 * * 0', ...)`
- Sunday 22:00 UTC = 5:00 PM EST / 6:00 PM EDT (single UTC cron cannot track DST)
- Escalation thresholds documented: 48h alert TSE, 72h pause listing, 120h (with 2+ contact attempts) suspend
- Enable steps: Supabase Dashboard → Database → Extensions → pg_cron → run documented SQL

---

## Test Results (headless DB)

| Test | Result |
|------|--------|
| All 11 expected functions present | PASS |
| `org_members_unique_per_location` constraint exists | PASS |
| `org_members_role_check` allows 'org_admin'/'staff' | PASS |
| `trg_send_invitation_email` trigger on staff_invitations | PASS |
| `trg_contacts_poc_change` trigger covers INSERT/UPDATE/DELETE on contacts | PASS |
| `trg_staff_removal_poc_check` trigger on org_members | PASS |
| `assert_staff_gate` has no invitation_id exemption | PASS |
| `assert_staff_gate` has org-owner exemption | PASS |
| Build: `npm run build` | PASS (clean, no TS errors) |
| Netlify deploy to production | PASS |

---

## Browser-Testable Items (Cannot be verified headlessly)

| Flow | How to Test |
|------|-------------|
| Invite + accept | Create org, invite staff, open `/invite/{token}` as invitee, sign in with matching email, complete orientation + ROE, verify DashboardPage shows My Account section with location assignment |
| Multi-location accept | Invite same user to a second location, accept second invite, verify My Account shows two location rows |
| Duplicate pending invite | Try inviting same email to same location twice — verify error "A pending invitation already exists" |
| Gate banner | Accept invite but skip orientation — verify gate banner appears on DashboardPage |
| Org owner bypass | Log in as org owner — verify no gate banner |
| Resend button | Admin > Invitations → Resend a pending invitation → verify "Sent ✓" and email received |
| Content editor | Admin > Content → publish a test orientation version → verify it appears in version list |
| Billing preview | Admin > Billing → preview extra seats for a location with billing records — verify renewal date matches billing_records.coverage_end anniversary |
| Staff removal → POC pause | Add staff whose email matches a contact → remove staff → verify location paused and poc_change_review task created |
| Cross-location staff panel | Invite org_admin to location → org_admin logs in → StaffPanel shows for their location |

---

## Production Verified

- Invite email delivery: tested in prior session (f118a70), confirmed working
- Supabase pg_net + Vault: operational (resend_api_key in vault)
- seedxga.com domain: verified in Resend account

---

## Security Constraints Maintained

- `.env` in `.gitignore` — no keys committed
- Resend API key stays in Supabase Vault
- `invitation_delivery_log` RLS: admin-only SELECT; no authenticated INSERT
- Invite token never logged
- No HMIS/PHI in public-facing fields
- Stripe disconnected; no Calendly
- Weekly reminder schedule DISABLED
- Test emails confined to controlled inboxes

---

## Founder Inputs Required Before Launch

- Final orientation content (replace [TEST] placeholder — use Content editor in Admin)
- Final Rules of Engagement (legal review required)
- Fractional service allowance rounding policy
- Seat-reduction over-capacity enforcement policy (what happens if headcount exceeds seats at reduction?)
- Weekly reminder schedule authorization (Sunday 22:00 UTC / 5pm EST — explicit sign-off needed to enable)
- Cross-location staff: org_assign_existing_staff RPC available but no UI for it in StaffPanel yet

## Remaining Work / Not Implemented

- **StaffPanel multi-location UI**: currently uses `locationId` from first membership row; a location selector for org admins with staff at multiple locations would require extending StaffPanel with a dropdown
- **InvitePage sign-in hint for existing users**: current InvitePage shows sign-up form; a "Sign in instead" link with password recovery is noted in the directive but not implemented — the existing flow handles it via auth.signIn and auto-accept
- **Connection request gate enforcement (Task 1a)**: `assert_staff_gate` exists and is correctly implemented; it must be explicitly called inside any coordination RPC that creates connection requests. `trg_connection_request_followup` does NOT call `assert_staff_gate` — this is a TSE-side trigger, not a user-facing gate. The user-side RPCs that create connection requests should call `assert_staff_gate` before inserting. This wiring has not been verified — check `create_connection_request` or equivalent RPC.
- **Weekly reminder edge function endpoint**: the cron job SQL in reminder_config references a placeholder URL — the actual `listing-check` edge function URL needs to be confirmed before enabling

## Recovery Instructions

If a migration needs to be rolled back:
- `assert_staff_gate`: restore `invitation_id IS NULL → RETURN` branch
- Unique constraint: `ALTER TABLE org_members DROP CONSTRAINT org_members_unique_per_location; ALTER TABLE org_members ADD CONSTRAINT org_members_org_id_user_id_key UNIQUE (org_id, user_id);`
- `admin_resend_invitation`: simply DROP FUNCTION; restore AdminPage edge function call
- Billing fix: replace renewal anchor logic with `v_loc.enrolled_at`

No data was migrated; all changes are logic-only. Rollback is safe.
