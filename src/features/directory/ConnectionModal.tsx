import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { DirectoryOrg } from "@/types/directory";

interface Props {
  org: DirectoryOrg;
  onClose: () => void;
}

const TODAY_START = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

async function checkLimits(
  userId: string | undefined,
  orgId: string
): Promise<string | null> {
  const todayStart = TODAY_START();

  // Sending limits (by the current user)
  if (userId) {
    const { count: sentToday } = await supabase
      .from("connection_requests")
      .select("id", { count: "exact", head: true })
      .eq("requesting_user_id", userId)
      .gte("created_at", todayStart);

    if ((sentToday ?? 0) >= 10)
      return "You've reached the daily limit of 10 requests. Please try again tomorrow.";

    const { count: openSent } = await supabase
      .from("connection_requests")
      .select("id", { count: "exact", head: true })
      .eq("requesting_user_id", userId)
      .in("status", ["pending", "active"]);

    if ((openSent ?? 0) >= 25)
      return "You have 25 open requests — the maximum allowed. Please follow up on existing requests before submitting new ones.";
  }

  // Receiving limits (by the target org)
  const { count: receivedToday } = await supabase
    .from("connection_requests")
    .select("id", { count: "exact", head: true })
    .eq("target_organization_id", orgId)
    .gte("created_at", todayStart);

  if ((receivedToday ?? 0) >= 10)
    return "This organization has reached today's request capacity. Please try again tomorrow or contact TSE directly.";

  const { count: openReceived } = await supabase
    .from("connection_requests")
    .select("id", { count: "exact", head: true })
    .eq("target_organization_id", orgId)
    .in("status", ["pending", "active"]);

  if ((openReceived ?? 0) >= 25)
    return "This organization currently has the maximum number of open requests. Please try again once existing requests are resolved.";

  return null;
}

export default function ConnectionModal({ org, onClose }: Props) {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", org: "", phone: "", note: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const limitError = await checkLimits(user?.id, org.id);
    if (limitError) {
      setError(limitError);
      setLoading(false);
      return;
    }

    const noteLines = [
      `FROM: ${form.name} at ${form.org}`,
      `PHONE: ${form.phone}`,
      form.note ? `NOTE: ${form.note}` : "",
    ].filter(Boolean).join("\n");

    const { error: dbError } = await supabase.from("connection_requests").insert({
      requesting_user_id:      user?.id ?? null,
      target_organization_id:  org.id,
      target_contact_id:       org.contact?.id !== "sample" ? org.contact?.id ?? null : null,
      request_type:            "facilitated_connection",
      notes:                   noteLines,
      status:                  "pending",
    });

    if (dbError) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  return (
    <>
      <style>{`
        .modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(26,43,53,0.55); backdrop-filter: blur(4px);
          z-index: 200; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
        }
        .modal-box { background: #ffffff; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; position: relative; border-radius: 4px; }
        .modal-header { background: #1E3A4A; padding: 1.75rem 2rem 1.5rem; }
        .modal-body { padding: 2rem; }
        .modal-field label { display: block; font-size: 0.8125rem; font-weight: 600; color: #1A2B35; margin-bottom: 0.375rem; }
        .modal-field input, .modal-field textarea {
          width: 100%; box-sizing: border-box; border: 1px solid #E2E8E6;
          padding: 0.625rem 0.875rem; font-size: 0.9375rem; color: #1A2B35;
          outline: none; font-family: inherit; transition: border-color 0.15s; background: #ffffff;
        }
        .modal-field input:focus, .modal-field textarea:focus { border-color: #2A9D8F; }
        .modal-field textarea { resize: vertical; min-height: 80px; }
        .modal-close { position: absolute; top: 1.25rem; right: 1.25rem; background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.7); font-size: 1.375rem; line-height: 1; padding: 0.25rem; transition: color 0.15s; }
        .modal-close:hover { color: #ffffff; }
      `}</style>

      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-box" role="dialog" aria-modal="true">
          <div className="modal-header">
            <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
            <p style={{ color: "#2A9D8F", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
              Request Connection
            </p>
            <h2 style={{ color: "#ffffff", fontSize: "1.25rem", fontWeight: 700, margin: 0, lineHeight: 1.25 }}>
              {org.name}
            </h2>
            {org.contact && (
              <p style={{ color: "rgba(255,255,255,0.58)", fontSize: "0.875rem", margin: "0.375rem 0 0" }}>
                {org.contact.full_name}{org.contact.title ? ` · ${org.contact.title}` : ""}
              </p>
            )}
          </div>

          <div className="modal-body">
            {submitted ? (
              <div style={{ textAlign: "center", padding: "1rem 0 0.5rem" }}>
                <div style={{ width: 52, height: 52, background: "rgba(42,157,143,0.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M4 11.5L9 16.5L18 6" stroke="#2A9D8F" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 style={{ color: "#1A2B35", fontWeight: 700, fontSize: "1.1rem", margin: "0 0 0.5rem" }}>Request Sent</h3>
                <p style={{ color: "#5C7380", fontSize: "0.9375rem", lineHeight: 1.65, margin: "0 0 1.75rem" }}>
                  Your request has been received. A TSE coordinator will review it and follow up within one business day. No information has been sent directly to the organization.
                </p>
                <button
                  onClick={onClose}
                  style={{ background: "#1E3A4A", color: "#ffffff", fontWeight: 600, fontSize: "0.9375rem", padding: "0.75rem 2rem", border: "none", cursor: "pointer", width: "100%", borderRadius: "4px" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
                  <div className="modal-field">
                    <label>Your Name</label>
                    <input type="text" required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="modal-field">
                    <label>Your Organization</label>
                    <input type="text" required placeholder="Organization name" value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} />
                  </div>
                  <div className="modal-field">
                    <label>Contact Phone</label>
                    <input type="tel" required placeholder="(xxx) xxx-xxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="modal-field">
                    <label>Note <span style={{ fontWeight: 400, color: "#5C7380" }}>(optional)</span></label>
                    <textarea
                      placeholder={`Keep notes brief and vague — no identifying details.\nExample: "Client needs housing support, exit date next week. Available for a quick call today or tomorrow?"`}
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                    />
                    <p style={{ fontSize: "0.75rem", color: "#5C7380", margin: "0.375rem 0 0", lineHeight: 1.5 }}>
                      Do not include client names, DOB, SSN, or other identifying information.
                    </p>
                  </div>
                </div>

                {error && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "0.75rem 1rem", marginTop: "1rem", fontSize: "0.875rem", color: "#B91C1C", lineHeight: 1.55 }}>
                    {error}
                  </div>
                )}

                <div style={{ marginTop: "1.75rem", display: "flex", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ flex: 1, background: "transparent", color: "#5C7380", fontWeight: 600, fontSize: "0.9375rem", padding: "0.75rem", border: "1px solid #E2E8E6", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ flex: 2, background: loading ? "#4A7C6F" : "#2A9D8F", color: "#ffffff", fontWeight: 600, fontSize: "0.9375rem", padding: "0.75rem", border: "none", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s" }}
                  >
                    {loading ? "Checking & sending…" : "Send Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
