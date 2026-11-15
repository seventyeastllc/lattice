import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_KEY    = Deno.env.get("RESEND_API_KEY")!;
const SUPA_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONFIRM_URL   = Deno.env.get("CONFIRM_URL") ?? `${SUPA_URL}/functions/v1/confirm-listing`;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") ?? "https://membership.seedxga.com/dashboard";
const FROM          = "Lattice Network <team@seedxga.com>";
const REPLY_TO      = "team@seedxga.com";

// Days without a confirmation before a location transitions to 'overdue'.
// (One missed weekly check = 7 days.)
const OVERDUE_DAYS = 7;

// Hours in the 'overdue' state before transitioning to 'paused'.
const PAUSE_AFTER_OVERDUE_HOURS = 72;

// Hours in the 'paused' state before suspension becomes eligible
// (also requires ≥ 2 TSE contact attempts, enforced by admin_suspend_location).
const SUSPEND_AFTER_PAUSE_HOURS = 48;

interface LocationRow {
  id: string;
  org_id: string;
  name: string;
  location_type: string | null;
  county: string | null;
  listing_status: string;
  last_confirmed_at: string | null;
  last_login_confirm_at: string | null;
  overdue_at: string | null;
  paused_at: string | null;
  tse_contact_attempts: number;
  org: {
    name: string;
    org_type: string | null;
    description: string | null;
    membership_tier: string | null;
  };
  services: { name: string; category: string }[];
  contacts: {
    full_name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    is_primary: boolean;
  }[];
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Optional test params: restrict to one location and override recipient email
  let testLocationId: string | null = null;
  let testEmailOverride: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      testLocationId   = body.test_location_id   ?? null;
      testEmailOverride = body.test_email_override ?? null;
    } catch { /* no body */ }
  }

  const supabase = createClient(SUPA_URL, SUPA_SERVICE, {
    auth: { persistSession: false },
  });

  // Fetch active, verified locations that are not yet suspended
  let query = supabase
    .from("locations")
    .select(`
      id, org_id, name, location_type, county,
      listing_status, last_confirmed_at, last_login_confirm_at,
      overdue_at, paused_at, tse_contact_attempts,
      org:organizations!inner(name, org_type, description, membership_tier),
      services(name, category),
      contacts(full_name, title, email, phone, is_primary)
    `)
    .eq("is_active", true)
    .eq("is_verified", true)
    .not("listing_status", "eq", "suspended");

  if (testLocationId) query = query.eq("id", testLocationId);

  const { data: locations, error } = await query;

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const now = new Date();
  let sent = 0, skipped = 0, statusUpdates = 0, reviewsCreated = 0;

  for (const loc of (locations as LocationRow[])) {
    // ── 1. Find this location's primary POC ──────────────────────────────────
    const primary = loc.contacts.find(c => c.is_primary) ?? loc.contacts[0];
    if (!primary?.email) { skipped++; continue; }

    // ── 2. Status transitions ────────────────────────────────────────────────
    const daysSinceConfirm = loc.last_confirmed_at
      ? (now.getTime() - new Date(loc.last_confirmed_at).getTime()) / 86_400_000
      : 999;

    const hoursSinceOverdue = loc.overdue_at
      ? (now.getTime() - new Date(loc.overdue_at).getTime()) / 3_600_000
      : null;

    const hoursSincePause = loc.paused_at
      ? (now.getTime() - new Date(loc.paused_at).getTime()) / 3_600_000
      : null;

    // paused → suspension eligible (manual via admin_suspend_location)
    if (
      loc.listing_status === "paused" &&
      hoursSincePause !== null &&
      hoursSincePause >= SUSPEND_AFTER_PAUSE_HOURS
    ) {
      // Create TSE task if not already open; actual suspension is manual
      await supabase.rpc("create_location_review", {
        p_location_id: loc.id,
        p_org_id:      loc.org_id,
        p_review_type: "suspension_pending",
        p_priority:    "urgent",
        p_notes:       `Location has been paused for ${Math.round(hoursSincePause)}h. ` +
                       `${loc.tse_contact_attempts}/2 contact attempts logged. ` +
                       `Admin must log ≥2 contact attempts and then call admin_suspend_location.`,
        p_due_hours:   24,
      });
      reviewsCreated++;
    }

    // overdue → paused (time-based)
    if (
      loc.listing_status === "overdue" &&
      hoursSinceOverdue !== null &&
      hoursSinceOverdue >= PAUSE_AFTER_OVERDUE_HOURS
    ) {
      const patch = { listing_status: "paused", paused_at: now.toISOString() };
      await supabase.from("locations").update(patch).eq("id", loc.id);
      loc.listing_status = "paused";
      statusUpdates++;

      // Open high-priority review for TSE
      await supabase.rpc("create_location_review", {
        p_location_id: loc.id,
        p_org_id:      loc.org_id,
        p_review_type: "pause_notice",
        p_priority:    "high",
        p_notes:       `Location paused after ${Math.round(hoursSinceOverdue)}h overdue. Email reminder sent to POC.`,
        p_due_hours:   48,
      });
      reviewsCreated++;
    }

    // active → overdue (missed one weekly check)
    if (loc.listing_status === "active" && daysSinceConfirm >= OVERDUE_DAYS) {
      const patch: Record<string, string> = {
        listing_status: "overdue",
        overdue_at:     now.toISOString(),
      };
      await supabase.from("locations").update(patch).eq("id", loc.id);
      loc.listing_status = "overdue";
      statusUpdates++;

      // Create TSE outreach alert (due in 48 hours)
      await supabase.rpc("create_location_review", {
        p_location_id: loc.id,
        p_org_id:      loc.org_id,
        p_review_type: "overdue_outreach",
        p_priority:    "normal",
        p_notes:       `Listing confirmation overdue by ${Math.round(daysSinceConfirm - OVERDUE_DAYS * 24)}h. ` +
                       `POC: ${primary.full_name} <${primary.email}>. Location will be paused in ~72h if no response.`,
        p_due_hours:   48,
      });
      reviewsCreated++;
    }

    // Don't send emails to suspended locations
    if (loc.listing_status === "suspended") { skipped++; continue; }

    // ── 3. Determine if this send requires sign-in ───────────────────────────
    const daysSinceLoginConfirm = loc.last_login_confirm_at
      ? (now.getTime() - new Date(loc.last_login_confirm_at).getTime()) / 86_400_000
      : 999;
    // Require login once a month; spread randomly so not every location lands same day
    const requiresLogin = daysSinceLoginConfirm > 30 && Math.random() < 0.4;

    // ── 4. Create a location-scoped token ────────────────────────────────────
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("listing_tokens")
      .insert({ org_id: loc.org_id, location_id: loc.id, requires_login: requiresLogin })
      .select("token")
      .single();

    if (tokenErr || !tokenRow) {
      console.error(`Token creation failed for location ${loc.name}:`, tokenErr);
      skipped++;
      continue;
    }

    const confirmLink = `${CONFIRM_URL}?token=${tokenRow.token}`;
    const updateLink  = `${DASHBOARD_URL}?update=listing&location=${loc.id}`;

    // ── 5. Build and send the email ──────────────────────────────────────────
    const html = buildEmail(loc, primary, confirmLink, updateLink, requiresLogin);

    const emailSubject = requiresLogin
      ? `Monthly verification required — ${loc.name}`
      : loc.listing_status === "paused"
        ? `Action needed: ${loc.name} listing is paused`
        : loc.listing_status === "overdue"
          ? `Reminder: confirm your Lattice listing for ${loc.name}`
          : `Is your Lattice listing still accurate? Quick check needed`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:     FROM,
        to:       [testEmailOverride ?? primary.email],
        reply_to: REPLY_TO,
        subject:  testEmailOverride ? `[TEST] ${emailSubject}` : emailSubject,
        html,
      }),
    });

    if (res.ok) {
      sent++;
      if (requiresLogin) {
        await supabase
          .from("locations")
          .update({ last_login_confirm_at: now.toISOString() })
          .eq("id", loc.id);
      }
    } else {
      const err = await res.text();
      console.error(`Resend failed for ${loc.name}:`, err);
    }
  }

  return new Response(
    JSON.stringify({
      sent,
      skipped,
      statusUpdates,
      reviewsCreated,
      total: (locations as LocationRow[]).length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ORG_TYPE_LABELS: Record<string, string> = {
  nonprofit:   "Nonprofit",
  faith_based: "Faith-Based",
  school:      "School / Education",
  medical:     "Medical / Health",
  housing:     "Housing",
  government:  "Government",
  other:       "Organization",
};
const ORG_TYPE_COLORS: Record<string, string> = {
  nonprofit:   "#2A9D8F",
  faith_based: "#7B68C8",
  school:      "#E07A3A",
  medical:     "#3A8FE0",
  housing:     "#4A7C6F",
  government:  "#5C7380",
  other:       "#5C7380",
};

function buildEmail(
  loc: LocationRow,
  primary: LocationRow["contacts"][number],
  confirmLink: string,
  updateLink: string,
  requiresLogin: boolean,
): string {
  const firstName   = primary.full_name.split(" ")[0];
  const orgName     = loc.org.name;
  const orgType     = loc.org.org_type ?? "other";
  const typeColor   = ORG_TYPE_COLORS[orgType] ?? "#5C7380";
  const typeLabel   = ORG_TYPE_LABELS[orgType] ?? "Organization";
  const services    = loc.services?.slice(0, 4) ?? [];
  const extraSvcs   = (loc.services?.length ?? 0) - 4;

  const serviceTags = services.map(s =>
    `<span style="display:inline-block;background:#F7F9F8;border:1px solid #E2E8E6;color:#5C7380;font-size:11px;font-weight:500;padding:3px 8px;border-radius:4px;margin:2px 3px 2px 0;">${s.name || s.category}</span>`
  ).join("") + (extraSvcs > 0
    ? `<span style="display:inline-block;background:#F7F9F8;border:1px solid #E2E8E6;color:#5C7380;font-size:11px;padding:3px 8px;border-radius:4px;margin:2px 0;">+${extraSvcs} more</span>`
    : "");

  const questions = [
    { q: "Is your primary contact still the right person?", current: primary.full_name },
    { q: "Still the best phone number?",                    current: primary.phone ?? "None on file" },
    { q: "Still the best email?",                           current: primary.email ?? "None on file" },
  ];

  const questionRows = questions.map(({ q, current }) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F0F4F3;">
        <div style="font-size:12px;color:#5C7380;margin-bottom:3px;">${q}</div>
        <div style="font-size:13px;font-weight:600;color:#1A2B35;">${current}</div>
      </td>
    </tr>`).join("");

  const isPaused  = loc.listing_status === "paused";
  const isOverdue = loc.listing_status === "overdue";

  // ── Paused-location urgent variant ─────────────────────────────────────────
  if (isPaused) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Action needed — ${loc.name}</title></head>
<body style="margin:0;padding:0;background:#F7F9F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9F8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:#8B1F1F;border-radius:10px 10px 0 0;padding:32px 36px 28px;">
    <div style="font-size:22px;font-weight:800;color:#fff;">Lattice</div>
    <div style="font-size:11px;font-weight:600;color:#F4A36A;letter-spacing:0.2em;text-transform:uppercase;margin-top:2px;">Action Required</div>
    <div style="margin-top:20px;font-size:26px;font-weight:700;color:#fff;line-height:1.25;">Your listing is paused,<br>${firstName}.</div>
  </td></tr>

  <tr><td style="background:#fff;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;padding:28px 36px;">
    <p style="font-size:14px;color:#5C7380;line-height:1.7;margin:0 0 20px;">
      Your listing for <strong style="color:#1A2B35;">${loc.name}</strong> (${orgName}) has been paused because we haven't received a confirmation recently. Paused listings are hidden from the public directory until confirmed.
    </p>
    ${cardPreview(loc, primary, typeColor, typeLabel, serviceTags)}
    <div style="text-align:center;margin-top:28px;">
      <a href="${confirmLink}" style="display:inline-block;background:#8B1F1F;color:#fff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;">
        ✓ &nbsp;Confirm and restore my listing →
      </a>
      <div style="font-size:12px;color:#5C7380;margin-top:12px;">
        Your listing will go live again immediately after confirmation.<br>
        <a href="${updateLink}" style="color:#2A9D8F;text-decoration:none;">Need to update something first?</a>
      </div>
    </div>
  </td></tr>

  ${footer(loc.name, orgName)}
</table>
</td></tr>
</table>
</body></html>`;
  }

  // ── Monthly login-required variant ─────────────────────────────────────────
  if (requiresLogin) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Monthly Verification — ${loc.name}</title></head>
<body style="margin:0;padding:0;background:#F7F9F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9F8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:#1E3A4A;border-radius:10px 10px 0 0;padding:32px 36px 28px;">
    <div style="font-size:22px;font-weight:800;color:#fff;">Lattice</div>
    <div style="font-size:11px;font-weight:600;color:#2A9D8F;letter-spacing:0.2em;text-transform:uppercase;margin-top:2px;">Coordination Network</div>
    <div style="margin-top:20px;font-size:26px;font-weight:700;color:#fff;line-height:1.25;">Monthly verification<br>required, ${firstName}.</div>
  </td></tr>

  <tr><td style="background:#fff;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;padding:28px 36px;">
    <p style="font-size:14px;color:#5C7380;line-height:1.7;margin:0 0 20px;">
      Once a month we ask you to sign in and confirm your listing for <strong style="color:#1A2B35;">${loc.name}</strong> is accurate. This keeps the Lattice network trustworthy for everyone. It only takes a minute.
    </p>
    ${cardPreview(loc, primary, typeColor, typeLabel, serviceTags)}
    <div style="text-align:center;margin-top:28px;">
      <a href="${updateLink.replace("?update=listing", "?verify=listing").replace(`&location=${loc.id}`, ``)}&location=${loc.id}" style="display:inline-block;background:#1E3A4A;color:#fff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;">
        Sign in to verify my listing →
      </a>
      <div style="font-size:12px;color:#5C7380;margin-top:12px;">Takes less than 60 seconds. Any questions? Reply to this email.</div>
    </div>
  </td></tr>

  ${footer(loc.name, orgName)}
</table>
</td></tr>
</table>
</body></html>`;
  }

  // ── Standard weekly check variant ──────────────────────────────────────────
  const overdueNotice = isOverdue
    ? `<tr><td style="background:#FEF3C7;border-left:3px solid #D97706;padding:12px 16px;border-radius:4px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:#92400E;">Confirmation overdue</div>
        <div style="font-size:12px;color:#92400E;margin-top:2px;">Your listing will be paused if not confirmed soon.</div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quick listing check — ${loc.name}</title></head>
<body style="margin:0;padding:0;background:#F7F9F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9F8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:#1E3A4A;border-radius:10px 10px 0 0;padding:32px 36px 28px;">
    <div style="font-size:22px;font-weight:800;color:#fff;">Lattice</div>
    <div style="font-size:11px;font-weight:600;color:#2A9D8F;letter-spacing:0.2em;text-transform:uppercase;margin-top:2px;">Coordination Network</div>
    <div style="margin-top:20px;">
      <div style="font-size:13px;color:rgba(255,255,255,0.55);">Quick listing check</div>
      <div style="font-size:26px;font-weight:700;color:#fff;margin-top:4px;line-height:1.25;">Hey ${firstName}, is your<br>listing still accurate?</div>
    </div>
  </td></tr>

  <tr><td style="background:#fff;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;padding:28px 36px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0">${overdueNotice}</table>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5C7380;margin-bottom:14px;">Your current listing</div>
    ${cardPreview(loc, primary, typeColor, typeLabel, serviceTags)}
  </td></tr>

  <tr><td style="background:#fff;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;padding:0 36px 8px;">
    <div style="border-top:1px solid #F0F4F3;padding-top:20px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5C7380;margin-bottom:4px;">Quick questions</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${questionRows}
        <tr><td style="padding:10px 0;">
          <div style="font-size:12px;color:#5C7380;margin-bottom:3px;">Any services or resources you'd like to add?</div>
          <div style="font-size:13px;color:#5C7380;font-style:italic;">Reply to this email or tap "Update something" below.</div>
        </td></tr>
      </table>
    </div>
  </td></tr>

  <tr><td style="background:#fff;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;padding:20px 36px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:8px;">
        <a href="${confirmLink}" style="display:block;text-align:center;background:#2A9D8F;color:#fff;font-size:14px;font-weight:700;padding:14px 20px;border-radius:8px;text-decoration:none;">
          ✓ &nbsp;Yes, this is correct
        </a>
        <div style="font-size:11px;color:#5C7380;text-align:center;margin-top:6px;">Keeps your listing active for another week</div>
      </td>
      <td style="padding-left:8px;">
        <a href="${updateLink}" style="display:block;text-align:center;background:#fff;color:#1E3A4A;font-size:14px;font-weight:700;padding:14px 20px;border-radius:8px;text-decoration:none;border:1.5px solid #E2E8E6;">
          ✏️ &nbsp;Update something
        </a>
        <div style="font-size:11px;color:#5C7380;text-align:center;margin-top:6px;">Or just reply to this email</div>
      </td>
    </tr></table>
  </td></tr>

  ${footer(loc.name, orgName)}
</table>
</td></tr>
</table>
</body></html>`;
}

function cardPreview(
  loc: LocationRow,
  primary: LocationRow["contacts"][number],
  typeColor: string,
  typeLabel: string,
  serviceTags: string,
): string {
  const orgName = loc.org.name;
  const locLabel = loc.name !== orgName ? `<div style="font-size:11px;color:#5C7380;margin-top:2px;">${loc.name}</div>` : "";
  return `
    <div style="border:1px solid #E2E8E6;border-top:3px solid ${typeColor};border-radius:8px;overflow:hidden;background:#fff;">
      <div style="padding:16px 18px;">
        <div style="font-size:15px;font-weight:700;color:#1A2B35;margin-bottom:4px;">${orgName}</div>
        ${locLabel}
        <span style="display:inline-block;background:${typeColor}18;color:${typeColor};font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:2px 7px;border-radius:3px;">${typeLabel}</span>
        <div style="font-size:12px;color:#5C7380;margin-top:6px;font-weight:500;">${loc.county ? loc.county + " County" : ""}</div>
        ${loc.org.description ? `<div style="font-size:12px;color:#1A2B35;line-height:1.55;margin-top:8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${loc.org.description}</div>` : ""}
        ${serviceTags ? `<div style="margin-top:10px;">${serviceTags}</div>` : ""}
      </div>
      <div style="height:1px;background:#E2E8E6;margin:0 18px;"></div>
      <div style="padding:12px 18px;">
        <div style="font-size:13px;font-weight:700;color:#1A2B35;">${primary.full_name}</div>
        ${primary.title ? `<div style="font-size:11px;color:#5C7380;margin-top:1px;">${primary.title}</div>` : ""}
        ${primary.phone ? `<div style="font-size:13px;font-weight:700;color:#1E3A4A;margin-top:4px;">${primary.phone}</div>` : ""}
      </div>
    </div>`;
}

function footer(locName: string, orgName: string): string {
  const label = locName !== orgName ? `${orgName} · ${locName}` : orgName;
  return `
    <tr><td style="background:#F7F9F8;border:1px solid #E2E8E6;border-top:none;border-radius:0 0 10px 10px;padding:18px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:11px;color:#5C7380;line-height:1.6;">
          Sent to the primary contact for <strong style="color:#1A2B35;">${label}</strong> on Lattice.<br>
          The Seed Exchange · Northwest Georgia · <a href="mailto:team@seedxga.com" style="color:#2A9D8F;text-decoration:none;">team@seedxga.com</a>
        </td>
      </tr></table>
    </td></tr>`;
}
