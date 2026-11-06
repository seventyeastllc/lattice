import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMyRequests } from "@/hooks/useMyRequests";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";

const NAVY   = "#1E3A4A";
const TEAL   = "#2A9D8F";
const BG     = "#F7F9F8";
const BORDER = "#E2E8E6";
const TEXT   = "#1A2B35";
const MUTED  = "#5C7380";
const WHITE  = "#ffffff";

const ORG_TYPE_LABELS: Record<string, string> = {
  nonprofit: "Nonprofit", faith_based: "Faith-Based", school: "Education",
  medical: "Medical / Health", housing: "Housing", government: "Government",
  community: "Community Org", other: "Other",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending:      { bg: "#E9A26B", color: WHITE,   label: "Pending" },
    active:       { bg: TEAL,     color: WHITE,   label: "Active" },
    resolved:     { bg: "#4A7C6F", color: WHITE,  label: "Resolved" },
    closed:       { bg: MUTED,    color: WHITE,   label: "Closed" },
    unresponsive: { bg: "#DC2626", color: WHITE,  label: "Unresponsive" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "9999px", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NetworkPage() {
  const { user, role } = useAuth();
  const { data: requests = [], isLoading } = useMyRequests();
  const { data: announcements = [] } = useAnnouncements();
  const [statusFilter, setStatusFilter] = useState("all");

  if (!user) return <Navigate to="/login" replace />;

  const filtered = statusFilter === "all"
    ? requests
    : requests.filter(r => r.status === statusFilter);

  const displayName = user.user_metadata?.full_name ?? user.email ?? "Member";
  const memberSince = new Date(user.created_at ?? Date.now()).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column" }}>
      <NavBar />

      {/* Header */}
      <div style={{ background: NAVY, padding: "2.5rem 2rem 2rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ color: TEAL, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>My Workspace</p>
          <h1 style={{ color: WHITE, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, margin: "0 0 0.375rem", lineHeight: 1.15 }}>My Network</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9375rem", margin: 0 }}>Your organization profile, connections, and coordination activity.</p>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 1100, margin: "0 auto", padding: "2rem", width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "2rem" }}>

        {/* Section 1: Org Summary */}
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "1.5rem" }}>
          <p style={{ color: MUTED, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 1rem" }}>Organization & Membership</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1.25rem" }}>
            <div>
              <p style={{ color: MUTED, fontSize: "0.75rem", fontWeight: 600, margin: "0 0 0.2rem" }}>Account</p>
              <p style={{ color: TEXT, fontWeight: 700, fontSize: "0.9375rem", margin: 0 }}>{displayName}</p>
              <p style={{ color: MUTED, fontSize: "0.8125rem", margin: "0.1rem 0 0" }}>{user.email}</p>
            </div>
            <div>
              <p style={{ color: MUTED, fontSize: "0.75rem", fontWeight: 600, margin: "0 0 0.2rem" }}>Role</p>
              <span style={{ display: "inline-block", background: role === "admin" ? "#FEF3C7" : "rgba(42,157,143,0.1)", color: role === "admin" ? "#92400E" : TEAL, fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "9999px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {role ?? "member"}
              </span>
            </div>
            <div>
              <p style={{ color: MUTED, fontSize: "0.75rem", fontWeight: 600, margin: "0 0 0.2rem" }}>Member since</p>
              <p style={{ color: TEXT, fontWeight: 600, fontSize: "0.9rem", margin: 0 }}>{memberSince}</p>
            </div>
          </div>
          <div style={{ marginTop: "1.25rem", borderTop: `1px solid ${BORDER}`, paddingTop: "1rem" }}>
            <Link to="/dashboard" style={{ color: TEAL, fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
              Edit your organization profile →
            </Link>
          </div>
        </div>

        {/* Section 2: Connection Activity */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <h2 style={{ color: TEXT, fontWeight: 700, fontSize: "1.0625rem", margin: 0 }}>Connection Activity</h2>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              {["all", "pending", "active", "resolved"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: "0.3rem 0.75rem", borderRadius: "20px", border: "none", cursor: "pointer",
                    fontWeight: 600, fontSize: "0.775rem", fontFamily: "inherit",
                    background: statusFilter === s ? NAVY : WHITE,
                    color: statusFilter === s ? WHITE : MUTED,
                    boxShadow: statusFilter === s ? "none" : `0 0 0 1px ${BORDER}`,
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
            {isLoading && (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>Loading connection activity…</p>
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div style={{ padding: "3rem 2rem", textAlign: "center" }}>
                <p style={{ fontWeight: 700, color: TEXT, margin: "0 0 0.5rem" }}>No connection requests yet</p>
                <p style={{ color: MUTED, fontSize: "0.9rem", margin: "0 0 1.25rem", lineHeight: 1.6 }}>
                  Browse the directory to request connections with organizations.
                </p>
                <Link to="/directory" style={{ display: "inline-block", background: TEAL, color: WHITE, fontWeight: 600, fontSize: "0.875rem", padding: "0.625rem 1.5rem", borderRadius: "6px", textDecoration: "none" }}>
                  Browse the Directory
                </Link>
              </div>
            )}

            {!isLoading && filtered.map((req, idx) => (
              <div key={req.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "1rem", alignItems: "center", padding: "0.875rem 1.25rem", borderBottom: idx < filtered.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                <div>
                  <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.1rem" }}>
                    {req.target_org?.name ?? "Unknown organization"}
                  </p>
                  {req.target_org?.org_type && (
                    <p style={{ color: MUTED, fontSize: "0.775rem", margin: 0 }}>
                      {ORG_TYPE_LABELS[req.target_org.org_type] ?? req.target_org.org_type}
                    </p>
                  )}
                </div>
                <StatusBadge status={req.status} />
                <p style={{ color: MUTED, fontSize: "0.8rem", margin: 0, whiteSpace: "nowrap" }}>{fmtDate(req.created_at)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Announcements */}
        {announcements.length > 0 && (
          <div>
            <h2 style={{ color: TEXT, fontWeight: 700, fontSize: "1.0625rem", margin: "0 0 1rem" }}>Network Announcements</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {announcements.map((ann) => (
                <div key={ann.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${TEAL}`, borderRadius: "0 8px 8px 0", padding: "1rem 1.25rem" }}>
                  {ann.title && <p style={{ color: TEXT, fontSize: "0.875rem", fontWeight: 700, margin: "0 0 0.25rem" }}>{ann.title}</p>}
                  <p style={{ color: TEXT, fontSize: "0.9rem", lineHeight: 1.65, margin: "0 0 0.3rem" }}>{ann.body}</p>
                  <p style={{ color: MUTED, fontSize: "0.775rem", margin: 0 }}>{new Date(ann.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Coming soon */}
        <div style={{ background: "rgba(233,162,107,0.08)", border: `1px solid rgba(233,162,107,0.3)`, borderRadius: "8px", padding: "1.5rem" }}>
          <p style={{ color: "#92400E", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>Coming Soon</p>
          <p style={{ color: TEXT, fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.375rem" }}>Professional coordination features are planned</p>
          <p style={{ color: MUTED, fontSize: "0.875rem", lineHeight: 1.65, margin: 0 }}>
            Shared case conferences, cross-sector working groups, and professional coordination opportunities are planned for a future release.
          </p>
        </div>

      </div>

      <Footer />
    </div>
  );
}
