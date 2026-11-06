const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const DASHBOARD    = Deno.env.get("DASHBOARD_URL") ?? "https://membership.seedxga.com";
const FROM         = "Lattice Network <team@seedexchange.org>";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { name, org_name, tier_label, tier_color, email } = await req.json();

  if (!email) return new Response("Missing email", { status: 400 });

  const firstName = (name ?? "").split(" ")[0] || "there";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Application received — Lattice</title>
</head>
<body style="margin:0;padding:0;background:#F7F9F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9F8;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background:#1E3A4A;border-radius:12px 12px 0 0;padding:32px 40px 28px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#2A9D8F;">Lattice Coordination Network</p>
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">Application received.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px;border-left:1px solid #E2E8E6;border-right:1px solid #E2E8E6;">
            <p style="margin:0 0 20px;font-size:16px;color:#1A2B35;line-height:1.6;">Hi ${firstName},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#5C7380;line-height:1.75;">
              Thank you for applying to join Lattice on behalf of <strong style="color:#1A2B35;">${org_name}</strong>.
              Your <strong style="color:${tier_color ?? "#2A9D8F"};">${tier_label}</strong> membership application is now in review.
            </p>

            <!-- Status card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9F8;border:1px solid #E2E8E6;border-left:4px solid #2A9D8F;border-radius:8px;margin:28px 0;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#5C7380;">What happens next</p>
                  <p style="margin:0;font-size:14px;color:#1A2B35;line-height:1.65;">
                    A TSE coordinator will review your application and reach out within <strong>2–3 business days</strong>.
                    You don't need to do anything else right now.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 28px;font-size:14px;color:#5C7380;line-height:1.65;">
              In the meantime, you're welcome to explore the partner directory to see the network you're joining.
            </p>

            <a href="${DASHBOARD.replace("/dashboard", "")}/directory"
               style="display:inline-block;background:#1E3A4A;color:#ffffff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">
              Browse the Directory →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F7F9F8;border:1px solid #E2E8E6;border-top:0;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#5C7380;">
              Questions? Reply to this email or write to
              <a href="mailto:team@seedexchange.org" style="color:#2A9D8F;text-decoration:none;">team@seedexchange.org</a>
            </p>
            <p style="margin:0;font-size:11px;color:#9DB4AE;">The Seed Exchange · Northwest Georgia</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      reply_to: "team@seedexchange.org",
      subject: `Application received — ${org_name}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }

  return new Response(JSON.stringify({ sent: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
