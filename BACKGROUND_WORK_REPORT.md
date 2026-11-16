# Background Work Report — Phase 9 Final
**Completed:** 2026-11-16  
**Commits:** 3d5f3b2 → b894426  
**Deployed:** https://membership.seedxga.com (Netlify deploy 6afb473d153a8fea481c856f)

---

## Changes This Session

### 1 — CEIL Proration for Service Allowances
**Migration:** `20261116_phase9_service_allowances.sql`

- `billing_config` gains `annual_request_reviews`, `annual_curated_intros`, `annual_facilitated_sessions` columns (DEFAULT 0)
- Provisional test values: Collaborator 12/6/4, Strategic 24/12/8, Anchor 0/0/0 — marked [TEST]
- `admin_enroll_location_service_allowances(p_location_id)` — SECURITY DEFINER; inserts/top-ups three allowance rows per location with `CEIL(annual × days_remaining / 365)`; never reduces; idempotent
- `admin_grant_upgrade_allowances(p_org_id, p_old_tier, p_new_tier)` — adds only the incremental CEIL-prorated delta per location; additive; retry-safe
- `admin_enroll_location` now auto-calls `admin_enroll_location_service_allowances` after enrollment
- AdminPage: "Grant Mid-Year Upgrade Allowances" panel with tier selects + Grant button

### 2 — 2-Business-Day Acknowledgment Deadline
**Migration:** `20261116_phase9_ack_deadline.sql`

- `connection_requests` gains `acknowledged_at`, `resolved_at`, `ack_deadline` columns
- `next_business_day_deadline(p_start, p_days=2, p_tz='America/New_York')` — IMMUTABLE PostgreSQL function; skips weekends; deadline is 5pm ET on business day N
- Trigger `trg_set_ack_deadline` BEFORE INSERT sets `ack_deadline` automatically
- `acknowledge_connection_request(p_request_id)` — idempotent; restricted to target org members or admin
- `get_incoming_connection_requests(p_org_id)` — provider-facing view with `is_ack_overdue`
- `admin_get_connection_requests(p_status)` — TSE admin view with deadline/overdue
- RLS: "Target org members can view incoming requests" policy
- DashboardPage: "Ack. Overdue" stat tile; "Ack. by <deadline>" per row; Acknowledge button; Incoming Requests panel
- AdminPage: deadline column in connection requests table; overdue banner

### 3 — Dashboard Onboarding & Staff Improvements
**Migration:** None (frontend only)
**Commit:** b894426

- `OnboardingModal` — inline modal for completing OR re-reading orientation/ROE from the dashboard. No longer requires finding the original invite URL.
- Gate banner: "Complete onboarding →" button opens modal at correct phase (orientation or ROE depending on what's pending)
- My Account section: "re-read" links for completed phases; "complete now" for pending phases
- Location assignments now display location name (joins `locations.name`) instead of UUID
- Multi-location org_admin: location dropdown selector drives StaffPanel when user has admin roles at multiple locations

---

## Full Migration Order (all applied)

1. `20261115_phase6_locations.sql`
2. `20261115_phase6b_billing_listing.sql`
3. `20261115_phase6c_activation_workflow.sql`
4. `20261115_phase6d_gate_tiers_activation.sql`
5. `20261115_phase6e_confirmation_workflow.sql`
6. `20261115_phase7_membership_billing.sql`
7. `20261115_phase8_staff_accounts.sql`
8. `20261116_phase8_billing_fix.sql`
9. `20261116_phase8_connection_gate.sql`
10. `20261116_phase8_gate_enforcement.sql`
11. `20261116_phase8_gate_v2.sql`
12. `20261116_phase8_invitation_email.sql`
13. `20261116_phase8_multilocation.sql`
14. `20261116_phase8_poc_trigger.sql`
15. `20261116_phase8_reminder_config.sql` (comment/documentation only — no schema change)
16. `20261116_phase8_resend_rpc.sql`
17. `20261116_phase8_seat_billing.sql`
18. `20261116_phase9_ack_deadline.sql`
19. `20261116_phase9_seat_reduction.sql`
20. `20261116_phase9_service_allowances.sql`

---

## Key Function Inventory

| Function | Purpose |
|----------|---------|
| `assert_staff_gate` | SECURITY DEFINER; raises exception if caller hasn't completed orientation + ROE |
| `check_staff_gate` | Returns gate status JSON for UI display |
| `staff_complete_orientation` | Idempotent — ON CONFLICT DO NOTHING |
| `staff_acknowledge_roe` | Idempotent — ON CONFLICT DO NOTHING |
| `org_invite_staff` | FOR UPDATE lock on location; raises on duplicate pending invite |
| `accept_staff_invitation` | Per-location idempotent accept |
| `admin_resend_invitation` | Validates + sends via Resend; logs delivery attempt |
| `admin_add_extra_seats` | Records payment, expands seat capacity; idempotent |
| `admin_get_seat_billing_preview` | Prorated charge preview with founder-rate awareness |
| `org_schedule_seat_reduction` | Queues reduction with selected staff removals |
| `admin_enroll_location_service_allowances` | CEIL-prorated allowance grant; never reduces |
| `admin_grant_upgrade_allowances` | Incremental tier-upgrade allowance delta |
| `next_business_day_deadline` | IMMUTABLE; skips Sat/Sun; returns 5pm ET |
| `acknowledge_connection_request` | Idempotent acknowledgment; RLS-enforced |
| `get_incoming_connection_requests` | Provider-facing with `is_ack_overdue` |
| `admin_get_connection_requests` | Admin view; all statuses with deadline |
| `contacts_poc_change` | Trigger fn; pauses listing + creates poc_change_review task |

---

## Production-Verified

- Invite email delivery via pg_net + Vault (Resend) — tested prior session
- Supabase pg_net + Vault: operational
- seedxga.com domain verified in Resend
- All migrations applied; build clean (155 modules)
- Deploy confirmed at https://membership.seedxga.com (6afb473d153a8fea481c856f)
- Business-day deadline tests: all 6 test cases passed (Mon, Thu, Fri, Sat, Sun, Fri-after-5pm → correct weekday deadlines)

---

## Browser-Testable Items (authenticated)

| Flow | How to Test |
|------|-------------|
| Invite + accept | Create org, invite staff, open `/invite/{token}` as invitee, sign in with matching email, complete orientation + ROE, verify DashboardPage shows My Account section |
| Multi-location accept | Invite same user to second location, accept second invite, verify My Account shows two location rows with names; org_admin sees location selector in StaffPanel |
| Gate banner → inline onboarding | Accept invite but skip orientation → verify gate banner has "Complete onboarding →" button → click → modal opens → complete inline |
| Re-read content | From My Account section, click "Orientation — re-read" link → modal opens in read-only mode |
| Duplicate pending invite | Invite same email to same location twice — verify error "A pending invitation already exists" |
| Org owner bypass | Log in as org owner — verify no gate banner |
| Resend button | Admin > Invitations → Resend a pending invitation → verify "Sent ✓" and email received |
| Content editor | Admin > Content → publish a test orientation version → verify it appears in version list |
| Billing preview | Admin > Billing → preview extra seats → verify renewal date, prorated charge, founder rate badge if applicable |
| Connection request ack | As provider: receive connection request, verify "Ack. by <date>" shows, click Acknowledge, verify banner clears |
| Ack overdue stat | Let ack deadline pass (or test with manual DB update) → verify "Ack. Overdue" stat tile increments |

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
- `assert_staff_gate`: org owner exemption; invited/added staff must complete orientation + ROE

---

## Founder Inputs Required Before Launch

1. **Final orientation content** — replace [TEST] placeholder via Admin > Content
2. **Final Rules of Engagement** — pending legal review; replace [TEST] via Admin > Content  
3. **Service allowance quantities** — provisional: Collaborator 12/6/4, Strategic 24/12/8, Anchor 0/0/0; configure in `billing_config` via Admin > Billing or direct DB
4. **Weekly reminder schedule authorization** — documented procedure in `20261116_phase8_reminder_config.sql`; founder must explicitly authorize enabling at Sunday 22:00 UTC
5. **Fractional service allowance rounding policy** — currently CEIL; if a different policy is required, update `admin_enroll_location_service_allowances`

---

## Remaining Work / Explicitly Deferred

- **StaffPanel copy-link fallback visible to org_admin**: the generated invite link is shown in the UI on invite success; no additional changes needed
- **InvitePage sign-in hint for existing users**: sign-up/sign-in tabs are present in InvitePage; no additional changes needed
- **Weekly reminder edge function endpoint**: cron SQL uses placeholder bearer token; replace with actual `service_role` key before enabling
- **Over-capacity enforcement policy**: current behavior is soft-block (flag "No seats available", disable invite button, do not remove staff); no change made — policy decision remains with founder
- **org_assign_existing_staff UI**: RPC exists; no StaffPanel UI for it yet — deferred until multi-location staff management needs expand

---

## Recovery Instructions

| Component | Rollback Action |
|-----------|----------------|
| `assert_staff_gate` | Restore `invitation_id IS NULL → RETURN` branch |
| `org_members_unique_per_location` | `DROP CONSTRAINT; ADD CONSTRAINT org_members_org_id_user_id_key UNIQUE(org_id, user_id)` |
| `admin_resend_invitation` | `DROP FUNCTION; restore AdminPage edge function call` |
| Service allowances | Allowance rows are additive; no rollback needed for data; DROP migration functions if logic must be reverted |
| Ack deadline | `ALTER TABLE connection_requests DROP COLUMN ack_deadline, acknowledged_at, resolved_at` |

No data was migrated or removed in Phase 9. All changes are logic-only or additive columns.
