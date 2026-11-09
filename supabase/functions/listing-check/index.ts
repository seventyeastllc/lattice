import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_KEY    = Deno.env.get("RESEND_API_KEY")!;
const SUPA_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONFIRM_URL   = Deno.env.get("CONFIRM_URL") ?? `${SUPA_URL}/functions/v1/confirm-listing`;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") ?? "https://membership.seedxga.com/dashboard";
const FROM          = "Lattice Network <team@seedxga.com>";
const REPLY_TO      = "team@seedxga.com";

interface OrgRow {
  id: string;
  name: string;
  org_type: string | null;
  county: string | null;
  description: string | null;
  website: string | null;
  membership_tier: string | null;
  last_confirmed_at: string | null;
  last_login_confirm_at: string | null;
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

  const supabase = createClient(SUPA_URL, SUPA_SERVICE, {
    auth: { persistSession: false },
  });

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select(`
      id, name, org_type, county, description, website,
      membership_tier, last_confirmed_at, last_login_confirm_at,
      services:org_services(name, category),
      contacts(full_name, title, email, phone, is_primary)
    `)
    .eq("is_active", true)
    .eq("is_verified", true);

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const now = new Date();
  let sent = 0, skipped = 0;

  for (const org of (orgs as OrgRow[])) {
    const primary = org.contacts.find(c => c.is_primary) ?? org.contacts[0];
    if (!primary?.email) { skipped++; continue; }

    // Determine if this send should require login
    // Logic: require login if it's been > 30 days since last login-confirm
    //        AND a random roll passes (spreads the requirement across the month
    //        so not every org gets it on the same day)
    const daysSinceLoginConfirm = org.last_login_confirm_at
      ? (now.getTime() - new Date(org.last_login_confirm_at).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    const requiresLogin = daysSinceLoginConfirm > 30 && Math.random() < 0.4;

    // Create a fresh token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("listing_tokens")
      .insert({ org_id: org.id, requires_login: requiresLogin })
      .select("token")
      .single();

    if (tokenErr || !tokenRow) {
      console.error(`Token creation failed for ${org.name}:`, tokenErr);
      skipped++;
      continue;
    }

    const confirmLink = `${CONFIRM_URL}?token=${tokenRow.token}`;
    const updateLink  = `${DASHBOARD_URL}?update=listing`;

    const html = buildEmail(org, primary, confirmLink, updateLink, requiresLogin);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:     FROM,
        to:       [primary.email],
        reply_to: REPLY_TO,
        subject:  requiresLogin
          ? `Monthly verification required — ${org.name}`
          : `Is your Lattice listing still accurate? Quick check needed`,
        html,
      }),
    });

    if (res.ok) {
      sent++;
      // If login-required, record it so we don't send another for 30 days
      if (requiresLogin) {
        await supabase
          .from("organizations")
          .update({ last_login_confirm_at: now.toISOString() })
          .eq("id", org.id);
      }
    } else {
      const err = await res.text();
      console.error(`Resend failed for ${org.name}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ sent, skipped, total: (orgs as OrgRow[]).length }),
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
  org: OrgRow,
  primary: OrgRow["contacts"][number],
  confirmLink: string,
  updateLink: string,
  requiresLogin: boolean,
): string {
  const firstName   = primary.full_name.split(" ")[0];
  const typeColor   = ORG_TYPE_COLORS[org.org_type ?? "other"] ?? "#5C7380";
  const typeLabel   = ORG_TYPE_LABELS[org.org_type ?? "other"] ?? "Organization";
  const services    = org.services?.slice(0, 4) ?? [];
  const extraSvcs   = (org.services?.length ?? 0) - 4;

  const serviceTags = services.map(s =>
    `<span style="display:inline-block;background:#F7F9F8;border:1px solid #E2E8E6;color:#5C7380;font-size:11px;font-weight:500;padding:3px 8px;border-radius:4px;margin:2px 3px 2px 0;">${s.name || s.category}</span>`
  ).join("") + (extraSvcs > 0
    ? `<span style="display:inline-block;background:#F7F9F8;border:1px solid #E2E8E6;color:#5C7380;font-size:11px;padding:3px 8px;border-radius:4px;margin:2px 0;">+${extraSvcs} more</span>`
    : "");

  const questions = [
    { q: "Is your primary contact still the right person?", field: "contact_name", current: primary.full_name },
    { q: "Still the best phone number?",                    field: "phone",         current: primary.phone ?? "None on file" },
    { q: "Still the best email?",                           field: "email",         current: primary.email ?? "None on file" },
  ];

  const questionRows = questions.map(({ q, current }) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F0F4F3;">
        <div style="font-size:12px;color:#5C7380;margin-bottom:3px;">${q}</div>
        <div style="font-size:13px;font-weight:600;color:#1A2B35;">${current}</div>
      </td>
    </tr>`).join("");

  if (requiresLogin) {
    // Monthly login-required version
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Monthly Verification — Lattice</title></head>
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
      Once a month we ask you to sign in and confirm your listing is accurate. This keeps the Lattice network trustworthy for everyone. It only takes a minute.
    </p>
    ${cardPreview(org, primary, typeColor, typeLabel, serviceTags)}
    <div style="text-align:center;margin-top:28px;">
      <a href="${updateLink}" style="display:inline-block;background:#1E3A4A;color:#fff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;">
        Sign in to verify my listing →
      </a>
      <div style="font-size:12px;color:#5C7380;margin-top:12px;">Takes less than 60 seconds. Any questions? Reply to this email.</div>
    </div>
  </td></tr>

  ${footer(org.name)}
</table>
</td></tr>
</table>
</body></html>`;
  }

  // Standard 3-4x/week version
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quick listing check — Lattice</title></head>
<body style="margin:0;padding:0;background:#F7F9F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9F8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#1E3A4A;border-radius:10px 10px 0 0;padding:32px 36px 28px;">
    <div style="font-size:22px;font-weight:800;color:#fff;">Lattice</div>
    <div style="font-size:11px;font-weight:600;color:#2A9D8F;letter-spacing:0.2em;text-transform:uppercase;margin-top:2px;">Coordination Network</div>
    <div style="margin-top:20px;">
      <div style="font-size:13px;color:rgba(255,255,255,0.55);">Quick listing check</div>
      <div style="font-size:26px;font-weight:700;color:#fff;margin-top:4px;line-height:1.25;">Hey ${firstName}, is your<br>listing still accurate?</div>
    </div>
  </td></tr>

  <!-- Card preview -->
  <tr><td style="background:#fff;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;padding:28px 36px 20px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5C7380;margin-bottom:14px;">Your current listing</div>
    ${cardPreview(org, primary, typeColor, typeLabel, serviceTags)}
  </td></tr>

  <!-- Questions -->
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

  <!-- CTAs -->
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

  ${footer(org.name)}
</table>
</td></tr>
</table>
</body></html>`;
}

function cardPreview(
  org: OrgRow,
  primary: OrgRow["contacts"][number],
  typeColor: string,
  typeLabel: string,
  serviceTags: string,
): string {
  return `
    <div style="border:1px solid #E2E8E6;border-top:3px solid ${typeColor};border-radius:8px;overflow:hidden;background:#fff;">
      <div style="padding:16px 18px;">
        <div style="font-size:15px;font-weight:700;color:#1A2B35;margin-bottom:4px;">${org.name}</div>
        <span style="display:inline-block;background:${typeColor}18;color:${typeColor};font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:2px 7px;border-radius:3px;">${typeLabel}</span>
        <div style="font-size:12px;color:#5C7380;margin-top:6px;font-weight:500;">${org.county ? org.county + " County" : ""}</div>
        ${org.description ? `<div style="font-size:12px;color:#1A2B35;line-height:1.55;margin-top:8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${org.description}</div>` : ""}
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

function footer(orgName: string): string {
  return `
    <tr><td style="background:#F7F9F8;border:1px solid #E2E8E6;border-top:none;border-radius:0 0 10px 10px;padding:18px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:11px;color:#5C7380;line-height:1.6;">
          Sent to the primary contact for <strong style="color:#1A2B35;">${orgName}</strong> on Lattice.<br>
          The Seed Exchange · Northwest Georgia · <a href="mailto:team@seedxga.com" style="color:#2A9D8F;text-decoration:none;">team@seedxga.com</a>
        </td>
      </tr></table>
    </td></tr>`;
}
