import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPA_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") ?? "https://lattice.seedexchange.org/dashboard";

Deno.serve(async (req) => {
  const url   = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) return htmlResponse(errorPage("No token provided."), 400);

  const supabase = createClient(SUPA_URL, SUPA_SERVICE, {
    auth: { persistSession: false },
  });

  // Look up the token
  const { data: row, error } = await supabase
    .from("listing_tokens")
    .select("id, org_id, expires_at, used_at, requires_login")
    .eq("token", token)
    .single();

  if (error || !row) return htmlResponse(errorPage("This link is invalid or has expired."), 404);
  if (row.used_at)   return htmlResponse(alreadyUsedPage(), 200);
  if (new Date(row.expires_at) < new Date()) return htmlResponse(errorPage("This confirmation link has expired. Check your email for a newer one."), 410);

  // Login-required: redirect to dashboard
  if (row.requires_login) {
    return Response.redirect(`${DASHBOARD_URL}?verify=listing&org=${row.org_id}`, 302);
  }

  // Mark token used + update org's last_confirmed_at
  const now = new Date().toISOString();
  const [tokenUpdate, orgUpdate] = await Promise.all([
    supabase.from("listing_tokens").update({ used_at: now }).eq("id", row.id),
    supabase.from("organizations").update({ last_confirmed_at: now }).eq("id", row.org_id),
  ]);

  if (tokenUpdate.error || orgUpdate.error) {
    console.error(tokenUpdate.error ?? orgUpdate.error);
    return htmlResponse(errorPage("Something went wrong. Please reply to your email and we'll sort it out."), 500);
  }

  // Fetch org name for the success page
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", row.org_id)
    .single();

  return htmlResponse(successPage(org?.name ?? "your organization"), 200);
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

function successPage(orgName: string): string {
  return shell(`
    <div class="icon">✅</div>
    <h1>Listing confirmed.</h1>
    <p>Thanks for verifying <strong style="color:#1A2B35;">${orgName}</strong>. Your listing is active for another week and the network can continue connecting with you.</p>
    <p style="font-size:0.8125rem;">Need to update something? Reply to any Lattice email or sign in to your dashboard.</p>
    <a class="btn" href="https://lattice.seedexchange.org">Back to Lattice</a>
  `);
}

function alreadyUsedPage(): string {
  return shell(`
    <div class="icon">👍</div>
    <h1>Already confirmed.</h1>
    <p>This link has already been used. Your listing is active — no further action needed.</p>
    <a class="btn" href="https://lattice.seedexchange.org">Back to Lattice</a>
  `);
}

function errorPage(message: string): string {
  return shell(`
    <div class="icon">⚠️</div>
    <h1>Something went wrong.</h1>
    <p>${message}</p>
    <a class="btn" href="mailto:team@seedexchange.org">Email us at team@seedexchange.org</a>
  `);
}
