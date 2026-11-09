import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const SUPA_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM         = "Lattice Network <team@seedxga.com>";
const REPLY_TO     = "team@seedxga.com";
const DASHBOARD    = Deno.env.get("DASHBOARD_URL") ?? "https://membership.seedxga.com/dashboard";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrgRow {
  id: string;
  name: string;
  membership_tier: string | null;
  contacts: { full_name: string; email: string | null }[];
}

interface RequestStats {
  pending: number;
  active: number;
  overdue: number;   // pending > 48hr
  resolved: number;  // resolved in last 7 days
  recent: { from_org: string; status: string; created_at: string }[];
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Allow manual trigger via POST as well as cron
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPA_URL, SUPA_SERVICE, {
    auth: { persistSession: false },
  });

  // 1. Load all active orgs with their primary contact email
  const { data: orgs, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name, membership_tier, contacts(full_name, email)")
    .eq("is_active", true)
    .eq("is_verified", true);

  if (orgErr) {
    console.error("org query failed:", orgErr);
    return new Response(JSON.stringify({ error: orgErr.message }), { status: 500 });
  }

  const now    = new Date();
  const ago48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const ago7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let sent = 0, skipped = 0;

  for (const org of (orgs as OrgRow[])) {
    const primaryContact = org.contacts.find(c => c.email) ?? org.contacts[0];
    if (!primaryContact?.email) { skipped++; continue; }

    // 2. Pull this org's connection request stats
    const { data: reqs } = await supabase
      .from("connection_requests")
      .select("id, notes, status, created_at")
      .eq("target_organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const all = reqs ?? [];

    const stats: RequestStats = {
      pending:  all.filter(r => r.status === "pending").length,
      active:   all.filter(r => r.status === "active").length,
      overdue:  all.filter(r => r.status === "pending" && r.created_at < ago48h).length,
      resolved: all.filter(r => r.status === "resolved" && r.created_at > ago7d).length,
      recent:   all.slice(0, 3).map(r => ({
        from_org:   parseFromOrg(r.notes),
        status:     r.status,
        created_at: r.created_at,
      })),
    };

    // 3. Skip if nothing to report (no activity this week)
    if (stats.pending + stats.active + stats.overdue + stats.resolved === 0) {
      skipped++;
      continue;
    }

    // 4. Send email
    const html = buildEmail(org.name, primaryContact.full_name, stats, org.membership_tier);
    const res  = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:     FROM,
        to:       [primaryContact.email],
        reply_to: REPLY_TO,
        subject:  `Your Lattice snapshot — ${fmtDate(now)}`,
        html,
      }),
    });

    if (res.ok) sent++;
    else {
      const err = await res.text();
      console.error(`Failed for ${org.name}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ sent, skipped, total: (orgs as OrgRow[]).length }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseFromOrg(notes: string | null): string {
  if (!notes) return "Unknown organization";
  const line = notes.split("\n").find(l => l.startsWith("FROM: "));
  if (!line) return "Unknown organization";
  return line.replace("FROM: ", "").split(" at ")[1] ?? "Unknown organization";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs  = Math.floor(diff / (1000 * 60 * 60));
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_LABEL: Record<string, string> = {
  pending:      "Pending",
  active:       "Active",
  resolved:     "Resolved",
  unresponsive: "Unresponsive",
};
const STATUS_COLOR: Record<string, string> = {
  pending:      "#D97706",
  active:       "#2A9D8F",
  resolved:     "#166534",
  unresponsive: "#991B1B",
};

// ─── Email template ───────────────────────────────────────────────────────────
function buildEmail(orgName: string, contactName: string, stats: RequestStats, tier: string | null): string {
  const firstName = contactName.split(" ")[0];
  const tierLabel = tier ? tier.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()) : "";
  const hasOverdue = stats.overdue > 0;

  const statCard = (value: number, label: string, accent: string, urgent = false) => `
    <td style="padding:0 8px;">
      <div style="background:#ffffff;border:1px solid #E2E8E6;border-top:3px solid ${accent};border-radius:8px;padding:18px 20px;min-width:120px;text-align:center;">
        <div style="font-size:32px;font-weight:800;color:#1A2B35;line-height:1;">${value}</div>
        <div style="font-size:11px;font-weight:600;color:${urgent && value > 0 ? accent : "#5C7380"};margin-top:6px;text-transform:uppercase;letter-spacing:0.06em;">${label}</div>
      </div>
    </td>`;

  const recentRows = stats.recent.map(r => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F0F4F3;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;color:#1A2B35;font-weight:500;">${r.from_org}</td>
          <td align="right" style="white-space:nowrap;">
            <span style="background:${STATUS_COLOR[r.status] ?? "#5C7380"}18;color:${STATUS_COLOR[r.status] ?? "#5C7380"};font-size:11px;font-weight:700;padding:3px 8px;border-radius:9999px;">
              ${STATUS_LABEL[r.status] ?? r.status}
            </span>
            <span style="font-size:11px;color:#5C7380;margin-left:8px;">${fmtRelative(r.created_at)}</span>
          </td>
        </tr></table>
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lattice Weekly Snapshot</title></head>
<body style="margin:0;padding:0;background:#F7F9F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9F8;padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- Header -->
    <tr><td style="background:#1E3A4A;border-radius:10px 10px 0 0;padding:32px 36px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Lattice</div>
          <div style="font-size:11px;font-weight:600;color:#2A9D8F;letter-spacing:0.2em;text-transform:uppercase;margin-top:2px;">Coordination Network</div>
        </td>
        <td align="right">
          ${tierLabel ? `<span style="background:rgba(42,157,143,0.2);color:#2A9D8F;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:0.06em;text-transform:uppercase;">${tierLabel}</span>` : ""}
        </td>
      </tr></table>
      <div style="margin-top:20px;">
        <div style="font-size:13px;color:rgba(255,255,255,0.55);font-weight:500;">Weekly snapshot</div>
        <div style="font-size:26px;font-weight:700;color:#ffffff;margin-top:4px;line-height:1.2;">Hey ${firstName}, here's<br>where things stand.</div>
      </div>
    </td></tr>

    <!-- Overdue alert -->
    ${hasOverdue ? `
    <tr><td style="background:#FEF3C7;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;padding:14px 36px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:16px;padding-right:10px;">⚠️</td>
        <td style="font-size:13px;font-weight:600;color:#92400E;">
          ${stats.overdue} request${stats.overdue > 1 ? "s are" : " is"} past 48 hours with no response — action needed.
        </td>
      </tr></table>
    </td></tr>` : ""}

    <!-- Stat cards -->
    <tr><td style="background:#ffffff;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;padding:28px 28px 24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5C7380;margin-bottom:16px;">Your dashboard</div>
      <table cellpadding="0" cellspacing="0" style="margin:0 -8px;">
        <tr>
          ${statCard(stats.pending,  "Pending",        "#D97706")}
          ${statCard(stats.active,   "Active",         "#2A9D8F")}
          ${statCard(stats.overdue,  "Needs Action",   "#DC2626", true)}
          ${statCard(stats.resolved, "Resolved (7d)",  "#4A7C6F")}
        </tr>
      </table>
    </td></tr>

    <!-- Recent activity -->
    ${stats.recent.length > 0 ? `
    <tr><td style="background:#ffffff;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;padding:0 36px 24px;">
      <div style="border-top:1px solid #F0F4F3;padding-top:20px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5C7380;margin-bottom:4px;">Recent requests</div>
        <table width="100%" cellpadding="0" cellspacing="0">${recentRows}</table>
      </div>
    </td></tr>` : ""}

    <!-- CTA -->
    <tr><td style="background:#ffffff;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;padding:8px 36px 32px;text-align:center;">
      <a href="${DASHBOARD}" style="display:inline-block;background:#1E3A4A;color:#ffffff;font-size:14px;font-weight:700;padding:13px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.01em;">
        Open your dashboard →
      </a>
      <div style="font-size:12px;color:#5C7380;margin-top:12px;">Or reply to this email — we're at team@seedxga.com</div>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#F7F9F8;border:1px solid #E2E8E6;border-top:none;border-radius:0 0 10px 10px;padding:20px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:11px;color:#5C7380;line-height:1.6;">
          You're receiving this as the primary contact for <strong style="color:#1A2B35;">${orgName}</strong> on the Lattice network.<br>
          Lattice is operated by The Seed Exchange · Northwest Georgia
        </td>
        <td align="right" style="font-size:11px;color:#5C7380;white-space:nowrap;">
          Sent every Sunday
        </td>
      </tr></table>
    </td></tr>

  </table>
  </td></tr>
  </table>
</body>
</html>`;
}
