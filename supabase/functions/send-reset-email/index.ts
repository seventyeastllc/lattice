const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM = "Lattice Network <team@seedxga.com>";
const SITE = "https://membership.seedxga.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { email } = await req.json();
  if (!email) return new Response("Missing email", { status: 400 });

  // Generate a recovery link using the service role admin API
  const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "recovery",
      email,
      options: { redirect_to: `${SITE}/reset-password` },
    }),
  });

  if (!linkRes.ok) {
    const err = await linkRes.text();
    // Return success regardless — don't reveal whether the email exists
    console.error("generate_link error:", err);
    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { action_link } = await linkRes.json();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset your password — Lattice</title>
</head>
<body style="margin:0;padding:0;background:#F7F9F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9F8;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <tr>
          <td style="background:#1E3A4A;border-radius:12px 12px 0 0;padding:32px 40px 28px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#2A9D8F;">Lattice Coordination Network</p>
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">Reset your password.</p>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:36px 40px;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;">
            <p style="margin:0 0 20px;font-size:15px;color:#5C7380;line-height:1.75;">
              We received a request to reset the password for your Lattice account. Click the button below to choose a new password.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:#2A9D8F;border-radius:8px;">
                  <a href="${action_link}"
                     style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                    Reset password →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9DB4AE;line-height:1.6;">
              This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#F7F9F8;border:1px solid #E2E8E6;border-top:0;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#5C7380;">
              Questions? Write to
              <a href="mailto:team@seedxga.com" style="color:#2A9D8F;text-decoration:none;">team@seedxga.com</a>
            </p>
            <p style="margin:0;font-size:11px;color:#9DB4AE;">The Seed Exchange · Northwest Georgia</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      reply_to: "team@seedxga.com",
      subject: "Reset your Lattice password",
      html,
    }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    console.error("Resend error:", err);
    return new Response(JSON.stringify({ error: err }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
