import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const TEAL  = "#2A9D8F";
const DARK  = "#1E3A4A";
const TEXT  = "#1A2B35";
const MUTED = "#5C7380";
const BG    = "#F7F9F8";
const SURFACE = "#FFFFFF";
const BORDER  = "#E2E8E6";

interface InvitationInfo {
  invitation_id: string;
  org_id: string;
  org_name: string;
  location_id: string | null;
  location_name: string | null;
  invited_email: string;
  invited_name: string | null;
  role: string;
  status: string;
  expires_at: string;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate  = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Auth form state
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);

  // After accept, show orientation flow
  const [phase, setPhase] = useState<"invite" | "orientation" | "roe" | "done">("invite");
  const [acceptedOrgId, setAcceptedOrgId] = useState<string | null>(null);

  const { data: inv, isLoading, error: invError } = useQuery({
    queryKey: ["invitation", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });
      if (error) throw error;
      return (data as InvitationInfo[] | null)?.[0] ?? null;
    },
    enabled: !!token,
    retry: false,
  });

  // Pre-fill email from invitation
  useEffect(() => {
    if (inv?.invited_email) setEmail(inv.invited_email);
    if (inv?.invited_name) setFullName(inv.invited_name);
  }, [inv]);

  const { data: orientation } = useQuery({
    queryKey: ["active-orientation"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orientation_content")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: phase === "orientation",
  });

  const { data: roe } = useQuery({
    queryKey: ["active-roe"],
    queryFn: async () => {
      const { data } = await supabase
        .from("roe_content")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: phase === "roe",
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("accept_staff_invitation", { p_token: token });
      if (error) throw error;
      return data as { org_id: string };
    },
    onSuccess: (data) => {
      setAcceptedOrgId(data.org_id);
      setPhase("orientation");
    },
  });

  const completeOrientationMutation = useMutation({
    mutationFn: async () => {
      if (!acceptedOrgId || !orientation) return;
      const { error } = await supabase.rpc("staff_complete_orientation", {
        p_org_id: acceptedOrgId,
        p_version: orientation.version,
      });
      if (error) throw error;
    },
    onSuccess: () => setPhase("roe"),
  });

  const acknowledgeRoeMutation = useMutation({
    mutationFn: async () => {
      if (!acceptedOrgId || !roe) return;
      const { error } = await supabase.rpc("staff_acknowledge_roe", {
        p_org_id: acceptedOrgId,
        p_version: roe.version,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPhase("done");
      setTimeout(() => navigate("/dashboard"), 1500);
    },
  });

  async function handleAuth() {
    setAuthError("");
    setAuthPending(true);
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) { setAuthError(error.message); setAuthPending(false); return; }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setAuthError(error.message); setAuthPending(false); return; }
    }
    setAuthPending(false);
    // After auth, acceptMutation fires below when user is set
  }

  // Auto-accept once authenticated
  useEffect(() => {
    if (user && inv?.status === "pending" && phase === "invite" && !acceptMutation.isPending && !acceptMutation.isSuccess) {
      acceptMutation.mutate();
    }
  }, [user, inv, phase]);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: 520, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ background: DARK, padding: "1.25rem 1.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>Lattice</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>· Staff Invitation</span>
        </div>
        <div style={{ padding: "2rem 1.75rem" }}>
          {children}
        </div>
      </div>
    </div>
  );

  if (authLoading || isLoading) return shell(
    <p style={{ color: MUTED, textAlign: "center" }}>Loading…</p>
  );

  if (invError || !inv) return shell(
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>⚠️</p>
      <p style={{ fontWeight: 700, color: TEXT }}>Invitation not found</p>
      <p style={{ color: MUTED, fontSize: "0.875rem" }}>This link may have expired or already been used.</p>
    </div>
  );

  if (inv.status === "accepted") return shell(
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>✅</p>
      <p style={{ fontWeight: 700, color: TEXT }}>Already accepted</p>
      <p style={{ color: MUTED, fontSize: "0.875rem" }}>This invitation has already been used.</p>
      <a href="/dashboard" style={{ display: "inline-block", marginTop: "1rem", color: TEAL, fontWeight: 600 }}>Go to Dashboard →</a>
    </div>
  );

  if (inv.status === "expired" || new Date(inv.expires_at) < new Date()) return shell(
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>⌛</p>
      <p style={{ fontWeight: 700, color: TEXT }}>Invitation expired</p>
      <p style={{ color: MUTED, fontSize: "0.875rem" }}>Ask your organization administrator to send a new invitation.</p>
    </div>
  );

  // ── Phase: orientation ────────────────────────────────────────────────────
  if (phase === "orientation") return shell(
    <div>
      <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: TEAL, margin: "0 0 0.5rem" }}>Step 1 of 2 · Staff Orientation</p>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: TEXT, margin: "0 0 1.25rem" }}>
        {orientation?.title ?? "Staff Orientation"}
      </h2>
      {orientation?.is_test && (
        <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "6px", padding: "0.6rem 0.9rem", marginBottom: "1rem", fontSize: "0.78rem", color: "#92400E", fontWeight: 600 }}>
          [TEST] Placeholder content — final orientation pending review
        </div>
      )}
      <div
        style={{ fontSize: "0.875rem", color: TEXT, lineHeight: 1.65, marginBottom: "1.5rem", maxHeight: "340px", overflowY: "auto", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "1rem" }}
        dangerouslySetInnerHTML={{ __html: orientation?.body_html ?? "<p>Loading orientation content…</p>" }}
      />
      {completeOrientationMutation.isError && (
        <p style={{ color: "#991B1B", fontSize: "0.78rem", marginBottom: "0.5rem" }}>
          {(completeOrientationMutation.error as Error).message}
        </p>
      )}
      <button
        onClick={() => completeOrientationMutation.mutate()}
        disabled={completeOrientationMutation.isPending || !orientation}
        style={{ width: "100%", background: TEAL, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.9375rem", padding: "0.875rem", borderRadius: "8px", cursor: "pointer", opacity: !orientation ? 0.5 : 1 }}
      >
        {completeOrientationMutation.isPending ? "Recording…" : "I have read and understood this orientation →"}
      </button>
    </div>
  );

  // ── Phase: ROE ───────────────────────────────────────────────────────────
  if (phase === "roe") return shell(
    <div>
      <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: TEAL, margin: "0 0 0.5rem" }}>Step 2 of 2 · Rules of Engagement</p>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: TEXT, margin: "0 0 1.25rem" }}>
        {roe?.title ?? "Rules of Engagement"}
      </h2>
      {roe?.is_test && (
        <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "6px", padding: "0.6rem 0.9rem", marginBottom: "1rem", fontSize: "0.78rem", color: "#92400E", fontWeight: 600 }}>
          [TEST] Placeholder content — final Rules of Engagement pending legal review
        </div>
      )}
      <div
        style={{ fontSize: "0.875rem", color: TEXT, lineHeight: 1.65, marginBottom: "1.5rem", maxHeight: "340px", overflowY: "auto", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "1rem" }}
        dangerouslySetInnerHTML={{ __html: roe?.body_html ?? "<p>Loading…</p>" }}
      />
      {acknowledgeRoeMutation.isError && (
        <p style={{ color: "#991B1B", fontSize: "0.78rem", marginBottom: "0.5rem" }}>
          {(acknowledgeRoeMutation.error as Error).message}
        </p>
      )}
      <button
        onClick={() => acknowledgeRoeMutation.mutate()}
        disabled={acknowledgeRoeMutation.isPending || !roe}
        style={{ width: "100%", background: TEAL, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.9375rem", padding: "0.875rem", borderRadius: "8px", cursor: "pointer", opacity: !roe ? 0.5 : 1 }}
      >
        {acknowledgeRoeMutation.isPending ? "Recording…" : "I acknowledge and agree to these Rules of Engagement ✓"}
      </button>
    </div>
  );

  // ── Phase: done ───────────────────────────────────────────────────────────
  if (phase === "done") return shell(
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: "2.5rem", margin: "0 0 0.5rem" }}>🎉</p>
      <h2 style={{ fontWeight: 700, color: TEXT, margin: "0 0 0.5rem" }}>You're all set!</h2>
      <p style={{ color: MUTED, fontSize: "0.875rem" }}>Redirecting to your dashboard…</p>
    </div>
  );

  // ── Phase: invite (default) ───────────────────────────────────────────────
  return shell(
    <div>
      {/* Org info */}
      <div style={{ background: `${TEAL}10`, border: `1px solid ${TEAL}30`, borderRadius: "8px", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: TEAL, margin: "0 0 0.3rem" }}>You've been invited to join</p>
        <p style={{ fontWeight: 700, color: TEXT, fontSize: "1rem", margin: "0 0 0.1rem" }}>{inv.org_name}</p>
        {inv.location_name && <p style={{ color: MUTED, fontSize: "0.8125rem", margin: 0 }}>{inv.location_name}</p>}
        <p style={{ color: MUTED, fontSize: "0.78rem", margin: "0.3rem 0 0" }}>
          Role: <strong>{inv.role === "org_admin" ? "Organization Admin" : "Staff"}</strong>
        </p>
      </div>

      {acceptMutation.isError && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: "6px", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8125rem", color: "#991B1B" }}>
          {(acceptMutation.error as Error).message}
        </div>
      )}

      {/* Already logged in → just accept */}
      {user ? (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: MUTED, fontSize: "0.875rem", marginBottom: "1rem" }}>Signed in as <strong>{user.email}</strong></p>
          <button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            style={{ width: "100%", background: TEAL, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.9375rem", padding: "0.875rem", borderRadius: "8px", cursor: "pointer" }}
          >
            {acceptMutation.isPending ? "Accepting…" : "Accept Invitation →"}
          </button>
        </div>
      ) : (
        /* Not logged in → sign up / sign in */
        <div>
          <div style={{ display: "flex", gap: 0, marginBottom: "1.25rem", border: `1px solid ${BORDER}`, borderRadius: "7px", overflow: "hidden" }}>
            {(["signup", "login"] as const).map(m => (
              <button key={m} onClick={() => setAuthMode(m)}
                style={{ flex: 1, padding: "0.6rem", border: "none", background: authMode === m ? DARK : SURFACE, color: authMode === m ? "#fff" : MUTED, fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer" }}>
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {authMode === "signup" && (
              <div>
                <label style={{ fontSize: "0.78rem", color: MUTED, fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Full name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)}
                  style={{ width: "100%", padding: "0.65rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box" }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: "0.78rem", color: MUTED, fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={{ width: "100%", padding: "0.65rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", color: MUTED, fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={{ width: "100%", padding: "0.65rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box" }} />
            </div>
          </div>

          {authError && <p style={{ color: "#991B1B", fontSize: "0.78rem", marginTop: "0.5rem" }}>{authError}</p>}

          <button onClick={handleAuth} disabled={authPending}
            style={{ marginTop: "1rem", width: "100%", background: TEAL, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.9375rem", padding: "0.875rem", borderRadius: "8px", cursor: "pointer", opacity: authPending ? 0.7 : 1 }}>
            {authPending ? "…" : authMode === "signup" ? "Create account & accept →" : "Sign in & accept →"}
          </button>
        </div>
      )}
    </div>
  );
}
