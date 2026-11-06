import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMyRequests } from "@/hooks/useMyRequests";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/layout/NavBar";

const TEAL   = "#2A9D8F";
const DARK   = "#1E3A4A";
const TEXT   = "#1A2B35";
const MUTED  = "#5C7380";
const BG     = "#F7F9F8";
const SURFACE = "#FFFFFF";
const BORDER  = "#E2E8E6";
const SAGE    = "#4A7C6F";

const ORG_TYPE_LABELS: Record<string, string> = {
  nonprofit:   "Nonprofit",
  faith_based: "Faith-Based",
  school:      "Education",
  medical:     "Medical / Health",
  housing:     "Housing",
  government:  "Government",
  community:   "Community Org",
  other:       "Other",
};

function hoursAgo(dateStr: string) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending:      { bg: "#FEF9C3", color: "#854D0E", label: "Pending" },
    active:       { bg: "#DBEAFE", color: "#1E40AF", label: "Active" },
    resolved:     { bg: "#DCFCE7", color: "#166534", label: "Resolved" },
    closed:       { bg: "#F3F4F6", color: "#374151", label: "Closed" },
    unresponsive: { bg: "#FEE2E2", color: "#991B1B", label: "Unresponsive" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "9999px", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function StatTile({ label, value, sub, color = DARK }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${color}`, borderRadius: "8px", padding: "1.25rem 1.5rem" }}>
      <p style={{ fontSize: "2rem", fontWeight: 700, color: TEXT, margin: "0 0 0.125rem", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: TEXT, margin: "0 0 0.2rem" }}>{label}</p>
      {sub && <p style={{ fontSize: "0.75rem", color: MUTED, margin: 0 }}>{sub}</p>}
    </div>
  );
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ProfileModal({ user, onClose }: { user: { email?: string; user_metadata?: { full_name?: string } } | null; onClose: () => void }) {
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    const { error: err } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: "100%", maxWidth: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#1A2B35" }}>Account Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.25rem", color: "#5C7380", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#1A2B35", marginBottom: "0.4rem" }}>Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={e => { setFullName(e.target.value); setSaved(false); }}
            style={{ width: "100%", boxSizing: "border-box", padding: "0.625rem 0.875rem", border: "1px solid #E2E8E6", borderRadius: "6px", fontSize: "0.9375rem", color: "#1A2B35", outline: "none", fontFamily: "inherit" }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#1A2B35", marginBottom: "0.4rem" }}>Email</label>
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            style={{ width: "100%", boxSizing: "border-box", padding: "0.625rem 0.875rem", border: "1px solid #E2E8E6", borderRadius: "6px", fontSize: "0.9375rem", color: "#5C7380", background: "#F7F9F8", fontFamily: "inherit" }}
          />
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.75rem", color: "#5C7380" }}>To change your email, contact team@seedexchange.org</p>
        </div>

        {error && <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#DC2626" }}>{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || saved}
          style={{ width: "100%", background: saved ? "#4A7C6F" : "#1E3A4A", color: "#fff", fontWeight: 700, fontSize: "0.9375rem", padding: "0.75rem", border: "none", borderRadius: "8px", cursor: saving || saved ? "default" : "pointer" }}
        >
          {saved ? "✓ Saved" : saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, role, signOut } = useAuth();
  const { data: requests = [], isLoading } = useMyRequests();
  const requestsRef = useRef<HTMLDivElement>(null);
  const [showProfile, setShowProfile] = useState(false);

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? "there";
  const firstName   = typeof displayName === "string" ? displayName.split(" ")[0] : displayName;

  // Stats
  const total    = requests.length;
  const open     = requests.filter(r => r.status === "pending" || r.status === "active").length;
  const flagged  = requests.filter(r => r.status === "pending" && hoursAgo(r.created_at) >= 72).length;
  const resolved = requests.filter(r => r.status === "resolved" || r.status === "closed").length;

  // Top 3 referral categories by org_type of target org
  const typeCounts: Record<string, number> = {};
  for (const r of requests) {
    const t = r.target_org?.org_type ?? "other";
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }
  const topCategories = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const quickLinks = [
    {
      label: "Partner Directory",
      description: "Search and filter vetted organizations by service area.",
      href: "/directory",
      icon: "🗂️",
    },
    {
      label: "My Requests",
      description: "Track connection requests you've submitted through TSE.",
      href: "#requests",
      icon: "📋",
      onClick: () => requestsRef.current?.scrollIntoView({ behavior: "smooth" }),
    },
    {
      label: "Resource Updates",
      description: "Recent changes to partner availability and services.",
      href: "#",
      icon: "🔔",
      soon: true,
    },
    {
      label: "Account Settings",
      description: "Update your display name and account preferences.",
      href: "#",
      icon: "⚙️",
      onClick: () => setShowProfile(true),
    },
  ];

  return (
    <>
    <div style={{ minHeight: "100vh", backgroundColor: BG }}>
      <NavBar />

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 1.5rem" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "2.5rem" }}>
          <div>
            <p style={{ fontSize: "0.875rem", color: MUTED, marginBottom: "0.25rem" }}>Welcome back</p>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, color: TEXT, margin: 0 }}>{firstName}</h1>
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ backgroundColor: role === "admin" ? "#FEF3C7" : "#ECFDF5", color: role === "admin" ? "#92400E" : SAGE, fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {role ?? "member"}
              </span>
              <span style={{ fontSize: "0.8125rem", color: MUTED }}>{user?.email}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {role === "admin" && (
              <Link to="/admin" style={{ backgroundColor: DARK, color: "#FFFFFF", padding: "0.6rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
                Admin Panel
              </Link>
            )}
            <button onClick={signOut} style={{ backgroundColor: "transparent", border: `1.5px solid ${BORDER}`, color: MUTED, padding: "0.6rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
          <StatTile label="Referrals Sent"  value={total}    color={DARK} />
          <StatTile label="Open / Pending"  value={open}     color={TEAL} sub={open === 0 ? "All clear" : "Pending TSE review"} />
          <StatTile label="No Response 72h" value={flagged}  color={flagged > 0 ? "#991B1B" : SAGE} sub={flagged > 0 ? "TSE will follow up" : "All on track"} />
          <StatTile label="Resolved"        value={resolved} color={SAGE} />
        </div>

        {/* Top categories */}
        {topCategories.length > 0 && (
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "1.25rem 1.5rem", marginBottom: "2.5rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 1rem" }}>Top Referral Categories</p>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {topCategories.map(([type, count], i) => (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? TEAL : i === 1 ? SAGE : "#9DB4AE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", color: TEXT }}>{ORG_TYPE_LABELS[type] ?? type}</p>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: MUTED }}>{count} referral{count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status banner */}
        <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${TEAL}`, borderRadius: "10px", padding: "1.25rem 1.5rem", marginBottom: "2.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "1.5rem" }}>✅</span>
          <div>
            <p style={{ fontWeight: 600, color: TEXT, margin: 0, fontSize: "0.9375rem" }}>Your account is active</p>
            <p style={{ color: MUTED, margin: "0.2rem 0 0", fontSize: "0.875rem" }}>
              You have access to the full Lattice partner directory. Connection requests are reviewed by TSE coordinators.
            </p>
          </div>
        </div>

        {/* Quick links */}
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: TEXT, marginBottom: "1.25rem" }}>What do you need today?</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1.25rem", marginBottom: "3rem" }}>
          {quickLinks.map((link) => (
            <div key={link.label} style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "1.5rem", opacity: link.soon ? 0.65 : 1, position: "relative" }}>
              {link.soon && (
                <span style={{ position: "absolute", top: "0.75rem", right: "0.75rem", fontSize: "0.7rem", fontWeight: 600, color: MUTED, backgroundColor: BG, border: `1px solid ${BORDER}`, padding: "0.15rem 0.5rem", borderRadius: "9999px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Soon
                </span>
              )}
              <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>{link.icon}</div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: TEXT, margin: "0 0 0.375rem" }}>{link.label}</h3>
              <p style={{ fontSize: "0.875rem", color: MUTED, margin: "0 0 1.25rem", lineHeight: 1.5 }}>{link.description}</p>
              {!link.soon && (
                link.onClick ? (
                  <button onClick={link.onClick} style={{ background: "none", border: "none", padding: 0, color: TEAL, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
                    View →
                  </button>
                ) : (
                  <Link to={link.href} style={{ color: TEAL, fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
                    Open →
                  </Link>
                )
              )}
            </div>
          ))}
        </div>

        {/* My Requests */}
        <div ref={requestsRef} id="requests">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: TEXT, margin: 0 }}>My Requests</h2>
            <Link to="/directory" style={{ color: TEAL, fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
              + New Request
            </Link>
          </div>

          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: "1rem", padding: "0.75rem 1.25rem", background: BG, borderBottom: `1px solid ${BORDER}` }}>
              {["Organization", "Submitted", "Status", ""].map(h => (
                <p key={h} style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, margin: 0 }}>{h}</p>
              ))}
            </div>

            {isLoading && (
              <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
                <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>Loading your requests…</p>
              </div>
            )}

            {!isLoading && requests.length === 0 && (
              <div style={{ padding: "3rem 1.25rem", textAlign: "center" }}>
                <p style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>📭</p>
                <p style={{ fontWeight: 600, color: TEXT, marginBottom: "0.25rem" }}>No requests yet</p>
                <p style={{ color: MUTED, fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                  When you submit connection requests, they'll show up here.
                </p>
                <Link to="/directory" style={{ display: "inline-block", backgroundColor: TEAL, color: "#FFFFFF", padding: "0.625rem 1.5rem", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
                  Browse the Directory
                </Link>
              </div>
            )}

            {!isLoading && requests.map((req) => {
              const is72hr = req.status === "pending" && hoursAgo(req.created_at) >= 72;
              return (
                <div key={req.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {is72hr && (
                    <div style={{ background: "#FEF2F2", borderBottom: `1px solid #FECACA`, padding: "0.35rem 1.25rem" }}>
                      <span style={{ fontSize: "0.72rem", color: "#991B1B", fontWeight: 700 }}>⚠ No response in 72+ hours — TSE has been notified</span>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: "1rem", padding: "1rem 1.25rem", alignItems: "center" }}>
                    <div>
                      <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.15rem" }}>
                        {req.target_org?.name ?? "—"}
                      </p>
                      {req.target_org?.org_type && (
                        <p style={{ color: MUTED, fontSize: "0.75rem", margin: 0 }}>
                          {ORG_TYPE_LABELS[req.target_org.org_type] ?? req.target_org.org_type}
                        </p>
                      )}
                    </div>
                    <p style={{ color: MUTED, fontSize: "0.8rem", margin: 0 }}>{fmtDate(req.created_at)}</p>
                    <StatusBadge status={req.status} />
                    <div />
                  </div>
                </div>
              );
            })}
          </div>

          {requests.length > 0 && (
            <p style={{ fontSize: "0.75rem", color: MUTED, marginTop: "0.75rem", textAlign: "right" }}>
              Official monthly reports are provided by TSE.
            </p>
          )}
        </div>
      </div>
    </div>
    {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
    </>
  );
}
