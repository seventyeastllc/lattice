import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPA_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") ?? "https://membership.seedxga.com/dashboard";

Deno.serve(async (req) => {
  const url   = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) return htmlResponse(errorPage("No token provided."), 400);

  const supabase = createClient(SUPA_URL, SUPA_SERVICE, {
    auth: { persistSession: false },
  });

  // Look up the token (now includes location_id)
  const { data: row, error } = await supabase
    .from("listing_tokens")
    .select("id, org_id, location_id, expires_at, used_at, requires_login")
    .eq("token", token)
    .single();

  if (error || !row) return htmlResponse(errorPage("This link is invalid or has expired."), 404);
  if (row.used_at)   return htmlResponse(alreadyUsedPage(), 200);
  if (new Date(row.expires_at) < new Date()) return htmlResponse(errorPage("This confirmation link has expired. Check your email for a newer one."), 410);

  // Login-required: redirect to dashboard with location-scoped param
  if (row.requires_login) {
    const dest = row.location_id
      ? `${DASHBOARD_URL}?verify=listing&location=${row.location_id}`
      : `${DASHBOARD_URL}?verify=listing&org=${row.org_id}`;
    return Response.redirect(dest, 302);
  }

  const now = new Date().toISOString();

  // Mark token used + update location's last_confirmed_at and restore listing_status
  const updates: Promise<unknown>[] = [
    supabase.from("listing_tokens").update({ used_at: now }).eq("id", row.id),
  ];

  if (row.location_id) {
    // Location-level confirmation: restore to active, clear pause/suspend fields
    updates.push(
      supabase.from("locations").update({
        last_confirmed_at: now,
        listing_status: "active",
        paused_at: null,
        paused_reason: null,
        suspended_at: null,
      }).eq("id", row.location_id),
    );
  } else {
    // Legacy org-level token (no location_id): update org-level timestamp
    updates.push(
      supabase.from("organizations").update({ last_confirmed_at: now }).eq("id", row.org_id),
    );
  }

  const results = await Promise.all(updates);
  const updateErr = results.find((r: any) => r.error)?.error;

  if (updateErr) {
    console.error(updateErr);
    return htmlResponse(errorPage("Something went wrong. Please reply to your email and we'll sort it out."), 500);
  }

  // Fetch location name (or fall back to org name) for the success page
  let displayName = "your location";
  if (row.location_id) {
    const { data: loc } = await supabase
      .from("locations")
      .select("name")
      .eq("id", row.location_id)
      .single();
    if (loc?.name) displayName = loc.name;
  } else {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", row.org_id)
      .single();
    if (org?.name) displayName = org.name;
  }

  return htmlResponse(successPage(displayName), 200);
});

// ─── Page templates ───────────────────────────────────────────────────────────
function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lattice · Listing Confirmation</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      background: #F7F9F8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 2rem 1rem;
    }
    .card {
      background: #fff;
      border: 1px solid #E2E8E6;
      border-radius: 12px;
      padding: 2.5rem 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
    }
    .wordmark { font-size: 1.1rem; font-weight: 800; color: #1E3A4A; margin-bottom: 0.25rem; }
    .sub { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #2A9D8F; }
    .icon { font-size: 3rem; margin: 1.5rem 0 1rem; }
    h1 { font-size: 1.375rem; font-weight: 700; color: #1A2B35; margin: 0 0 0.625rem; }
    p { font-size: 0.9375rem; color: #5C7380; line-height: 1.65; margin: 0 0 1.5rem; }
    a.btn {
      display: inline-block;
      background: #1E3A4A; color: #fff;
      font-size: 0.875rem; font-weight: 700;
      padding: 0.75rem 1.75rem;
      border-radius: 8px; text-decoration: none;
    }
    .footer { font-size: 0.75rem; color: #5C7380; margin-top: 2rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="wordmark">Lattice</div>
    <div class="sub">Coordination Network</div>
    ${content}
  </div>
  <div class="footer">The Seed Exchange · Northwest Georgia</div>
</body>
</html>`;
}

function successPage(locationName: string): string {
  return shell(`
    <div class="icon">✅</div>
    <h1>Listing confirmed.</h1>
    <p>Thanks for verifying <strong style="color:#1A2B35;">${locationName}</strong>. Your listing is active and the network can continue connecting with you.</p>
    <p style="font-size:0.8125rem;">Need to update something? Reply to any Lattice email or sign in to your dashboard.</p>
    <a class="btn" href="https://membership.seedxga.com">Back to Lattice</a>
  `);
}

function alreadyUsedPage(): string {
  return shell(`
    <div class="icon">👍</div>
    <h1>Already confirmed.</h1>
    <p>This link has already been used. Your listing is active — no further action needed.</p>
    <a class="btn" href="https://membership.seedxga.com">Back to Lattice</a>
  `);
}

function errorPage(message: string): string {
  return shell(`
    <div class="icon">⚠️</div>
    <h1>Something went wrong.</h1>
    <p>${message}</p>
    <a class="btn" href="mailto:team@seedxga.com">Email us at team@seedxga.com</a>
  `);
}
