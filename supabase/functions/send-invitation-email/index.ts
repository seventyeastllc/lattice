import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const SUPA_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL      = Deno.env.get("APP_URL") ?? "https://membership.seedxga.com";
const FROM         = "Lattice Network <team@seedxga.com>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  // Auth: require a valid session (admin or service call)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  let body: { invitation_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
  const { invitation_id } = body;
  if (!invitation_id) return new Response(JSON.stringify({ error: "invitation_id required" }), { status: 400 });

  const admin = createClient(SUPA_URL, SUPA_SERVICE);

  // Look up invitation (service role bypasses RLS)
  const { data: inv, error: invErr } = await admin
    .from("staff_invitations")
    .select("id,token,email,name,role,org_id,location_id,status,expires_at,organizations(name)")
    .eq("id", invitation_id)
    .maybeSingle();

  if (invErr || !inv) {
    return new Response(JSON.stringify({ error: "Invitation not found" }), { status: 404 });
  }

  if (inv.status !== "pending") {
    return new Response(JSON.stringify({ error: "Invitation is not pending" }), { status: 422 });
  }

  if (new Date(inv.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: "Invitation has expired" }), { status: 422 });
  }

  const orgName = (inv.organizations as { name: string } | null)?.name ?? "the organization";
  const inviteUrl = `${APP_URL}/invite/${inv.token}`;
  const roleName  = inv.role === "org_admin" ? "Organization Administrator" : "Staff Member";
  const expiresOn = new Date(inv.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#F0F4F3;margin:0;padding:2rem 1rem;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
    <div style="background:#1E3A4A;padding:1.5rem 2rem;">
      <p style="color:#2A9D8F;font-weight:700;font-size:0.875rem;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 0.25rem">Lattice Network</p>
      <h1 style="color:#fff;font-size:1.375rem;font-weight:700;margin:0">You've been invited</h1>
    </div>
    <div style="padding:2rem;">
      <p style="color:#1A2B35;font-size:0.9375rem;margin:0 0 1.25rem">
        ${inv.name ? `Hi ${inv.name},<br><br>` : ""}You've been invited to join <strong>${orgName}</strong> as a <strong>${roleName}</strong> on the Lattice Network.
      </p>
      <p style="color:#5C7380;font-size:0.875rem;margin:0 0 1.5rem">
        To accept this invitation you'll need to sign in (or create an account) with the email address this was sent to: <strong>${inv.email}</strong>. You'll also complete a brief orientation and acknowledge the Rules of Engagement.
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:#2A9D8F;color:#fff;font-weight:700;font-size:0.9375rem;padding:0.75rem 2rem;border-radius:8px;text-decoration:none;">Accept Invitation</a>
      <p style="color:#5C7380;font-size:0.78rem;margin:1.5rem 0 0">This invitation expires on ${expiresOn}. If you have questions, reply to this email.</p>
    </div>
    <div style="background:#F0F4F3;padding:1rem 2rem;border-top:1px solid #E2E8E6;">
      <p style="color:#5C7380;font-size:0.75rem;margin:0">The Seed Exchange · Georgia Refugee Resettlement Network</p>
    </div>
  </div>
</body>
</html>`;

  // Send via Resend
  let providerId: string | null = null;
  let sendError: string | null = null;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: inv.email,
        subject: `You're invited to join ${orgName} on Lattice Network`,
        html,
      }),
    });
    const json = await res.json() as { id?: string; message?: string };
    if (res.ok) {
      providerId = json.id ?? null;
    } else {
      sendError = json.message ?? "Resend error";
    }
  } catch (e) {
    sendError = (e as Error).message;
  }

  // Log delivery attempt (never log the token)
  await admin.from("invitation_delivery_log").insert({
    invitation_id: inv.id,
    status: sendError ? "failed" : "sent",
    provider_message_id: providerId,
    error: sendError,
  });

  if (sendError) {
    return new Response(JSON.stringify({ error: sendError }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, provider_message_id: providerId }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
