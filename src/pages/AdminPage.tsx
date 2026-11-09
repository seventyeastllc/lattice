import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import CRMView from "@/features/crm/CRMView";
import { useAllKnowledgeResources, useKnowledgeResourceMutations } from "@/hooks/useKnowledgeAdmin";
import { useAllAnnouncements, useAnnouncementMutations } from "@/hooks/useAnnouncementsAdmin";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const DARK    = "#1E3A4A";
const TEAL    = "#2A9D8F";
const SAGE    = "#4A7C6F";
const BG      = "#F0F4F3";
const SURFACE = "#FFFFFF";
const BORDER  = "#E2E8E6";
const TEXT    = "#1A2B35";
const MUTED   = "#5C7380";

// ─── Tier display helpers ─────────────────────────────────────────────────────
const TIER_LABELS: Record<string, string> = {
  participant:  "Network Participant",
  collaborator: "Network Collaborator",
  strategic:    "Strategic Partner",
  anchor:       "Founding Strategic Circle",
};
const TIER_COLORS: Record<string, string> = {
  participant:  SAGE,
  collaborator: TEAL,
  strategic:    "#C8622A",
  anchor:       DARK,
};

// Stripe Payment Links — set these in .env after creating products in Stripe
const STRIPE_LINKS: Record<string, string> = {
  collaborator: import.meta.env.VITE_STRIPE_LINK_COLLABORATOR ?? "",
  strategic:    import.meta.env.VITE_STRIPE_LINK_STRATEGIC    ?? "",
};

// ─── Parse connection request note ───────────────────────────────────────────
function parseNote(raw: string | null): { from_name: string; from_org: string; from_phone: string; hmis_id: string; note: string } {
  if (!raw) return { from_name: "—", from_org: "—", from_phone: "—", hmis_id: "", note: "" };
  const lines = raw.split("\n");
  let from_name = "—", from_org = "—", from_phone = "—", hmis_id = "", note = "";
  for (const line of lines) {
    if (line.startsWith("FROM: ")) {
      const parts = line.replace("FROM: ", "").split(" at ");
      from_name = parts[0] ?? "—";
      from_org  = parts[1] ?? "—";
    } else if (line.startsWith("PHONE: ")) {
      from_phone = line.replace("PHONE: ", "");
    } else if (line.startsWith("HMIS: ")) {
      hmis_id = line.replace("HMIS: ", "");
    } else if (line.startsWith("NOTE: ")) {
      note = line.replace("NOTE: ", "");
    }
  }
  return { from_name, from_org, from_phone, hmis_id, note };
}

function hoursAgo(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending:      { bg: "#FEF9C3", color: "#854D0E", label: "Pending" },
    approved:     { bg: "#DCFCE7", color: "#166534", label: "Approved" },
    rejected:     { bg: "#FEE2E2", color: "#991B1B", label: "Rejected" },
    active:       { bg: "#DBEAFE", color: "#1E40AF", label: "Active" },
    resolved:     { bg: "#DCFCE7", color: "#166534", label: "Resolved" },
    closed:       { bg: "#F3F4F6", color: "#374151", label: "Closed" },
    unresponsive: { bg: "#FEE2E2", color: "#991B1B", label: "Unresponsive" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "9999px", letterSpacing: "0.04em" }}>
      {s.label}
    </span>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton({ h = "1rem", w = "100%", mb = "0" }: { h?: string; w?: string; mb?: string }) {
  return (
    <div style={{ height: h, width: w, background: "#E2E8E6", borderRadius: "4px", marginBottom: mb, animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

// ─── Supabase query hooks ─────────────────────────────────────────────────────

// Applications: orgs that are not yet active/verified (pending) or !active but verified (rejected)
// Uses SECURITY DEFINER RPC so payment_status is accessible to admin only
function useApplications() {
  return useQuery({
    queryKey: ["admin-applications"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_pending_orgs");
      if (error) throw error;
      return (data ?? []) as unknown as RawApplication[];
    },
  });
}

interface RawApplication {
  id: string;
  name: string;
  org_type: string | null;
  county: string | null;
  membership_tier: string | null;
  payment_status: string | null;
  description: string | null;
  created_at: string;
  is_active: boolean;
  is_verified: boolean;
  contacts: { id: string; full_name: string; title: string | null; email: string | null; phone: string | null; is_primary: boolean }[];
}

// Connection requests: all, joined to org name
function useConnectionRequests() {
  return useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connection_requests")
        .select(`id, notes, status, created_at, request_type,
                 target_org:organizations!connection_requests_target_organization_id_fkey(name),
                 target_contact:contacts!connection_requests_target_contact_id_fkey(full_name, title)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RawRequest[];
    },
  });
}

interface RawRequest {
  id: string;
  notes: string | null;
  status: string;
  created_at: string;
  request_type: string | null;
  target_org: { name: string } | null;
  target_contact: { full_name: string; title: string | null } | null;
}

// All active orgs
// Uses SECURITY DEFINER RPC so payment_status is accessible to admin only
function useOrganizations() {
  return useQuery({
    queryKey: ["admin-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_active_orgs");
      if (error) throw error;
      return (data ?? []) as unknown as RawOrg[];
    },
  });
}

interface RawOrg {
  id: string;
  name: string;
  org_type: string | null;
  county: string | null;
  membership_tier: string | null;
  payment_status: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  contacts: { full_name: string; is_primary: boolean }[];
}

// ─── Claim hooks ─────────────────────────────────────────────────────────────
interface PendingClaim {
  record_id: string;
  org_name: string | null;
  county: string | null;
  primary_category: string | null;
  contact_name: string | null;
  contact_title: string | null;
  main_phone: string | null;
  email: string | null;
  website: string | null;
  claimed_by_email: string | null;
  claimed_at: string | null;
  claim_status: string | null;
  partnership_status: string | null;
  follow_up_notes: string | null;
  // joined org
  org: {
    id: string;
    name: string;
    org_type: string | null;
    county: string | null;
    description: string | null;
    membership_tier: string | null;
    is_active: boolean;
    is_verified: boolean;
    created_at: string;
    contacts: { full_name: string; title: string | null; email: string | null; phone: string | null }[];
  } | null;
}

function usePendingClaims() {
  return useQuery({
    queryKey: ["admin-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prm_leads")
        .select(`record_id, org_name, county, primary_category, contact_name, contact_title,
                 main_phone, email, website, claimed_by_email, claimed_at, claim_status,
                 partnership_status, follow_up_notes,
                 organizations!organizations_claimed_lead_id_fkey(
                   id, name, org_type, county, description, membership_tier, is_active, is_verified, created_at,
                   contacts(full_name, title, email, phone)
                 )`)
        .eq("claim_status", "pending")
        .order("claimed_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown[]).map((r: unknown) => {
        const row = r as Record<string, unknown>;
        const orgs = row["organizations"];
        const org = Array.isArray(orgs) ? orgs[0] ?? null : orgs ?? null;
        return { ...row, org } as PendingClaim;
      });
    },
  });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
type View = "overview" | "applications" | "claims" | "requests" | "organizations" | "crm" | "knowledge" | "announcements";

function Sidebar({
  view, setView, onSignOut,
  pendingApps, pendingReqs, pendingClaims,
}: {
  view: View; setView: (v: View) => void; onSignOut: () => void;
  pendingApps: number; pendingReqs: number; pendingClaims: number;
}) {
  const navItems = [
    { id: "overview"      as View, label: "Overview",      icon: "◈",  badge: 0 },
    { id: "applications"  as View, label: "Applications",  icon: "📋", badge: pendingApps },
    { id: "claims"        as View, label: "Claim Queue",   icon: "🔖", badge: pendingClaims },
    { id: "requests"      as View, label: "Requests",      icon: "🔗", badge: pendingReqs },
    { id: "organizations" as View, label: "Organizations", icon: "🏢", badge: 0 },
    { id: "crm"           as View, label: "CRM",           icon: "🗃️", badge: 0 },
    { id: "knowledge"     as View, label: "Knowledge",     icon: "📚", badge: 0 },
    { id: "announcements" as View, label: "Announcements", icon: "📢", badge: 0 },
  ];

  return (
    <aside style={{ width: 220, flexShrink: 0, background: DARK, display: "flex", flexDirection: "column", minHeight: "100vh", position: "sticky", top: 0, height: "100vh", overflow: "auto" }}>
      <div style={{ padding: "1.5rem 1.25rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <img src="/Lattice%20Icon%203%20trans.png" alt="Lattice" style={{ height: 28, width: "auto", filter: "brightness(0) invert(1)", opacity: 0.9 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>Lattice</span>
        </div>
        <span style={{ display: "inline-block", background: `${TEAL}30`, color: TEAL, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>Admin</span>
      </div>

      <nav style={{ flex: 1, padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {navItems.map((item) => {
          const active = view === item.id;
          return (
            <button key={item.id} onClick={() => setView(item.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.625rem", padding: "0.6rem 0.875rem", borderRadius: "7px", border: "none", background: active ? `${TEAL}25` : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.55)", fontWeight: active ? 600 : 400, fontSize: "0.875rem", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.12s" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <span style={{ fontSize: "0.95rem" }}>{item.icon}</span>
                {item.label}
              </span>
              {item.badge > 0 && (
                <span style={{ background: TEAL, color: "#fff", fontSize: "0.65rem", fontWeight: 700, minWidth: 18, height: 18, borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "1rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Link to="/" style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.8rem", textDecoration: "none", padding: "0.4rem 0.875rem" }}>← Public site</Link>
        <button onClick={onSignOut} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.45)", fontSize: "0.8rem", cursor: "pointer", textAlign: "left", padding: "0.4rem 0.875rem" }}>Sign out</button>
      </div>
    </aside>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function Overview({ setView }: { setView: (v: View) => void }) {
  const { data: apps = [] }    = useApplications();
  const { data: reqs = [] }    = useConnectionRequests();
  const { data: orgs = [] }    = useOrganizations();
  const { data: claims = [] }  = usePendingClaims();

  const pendingApps = apps.filter(a => !a.is_verified).length;
  const pendingReqs = reqs.filter(r => r.status === "pending").length;
  const activeReqs  = reqs.filter(r => r.status === "active").length;
  const unverified  = orgs.filter(o => !o.is_verified).length;

  const stats = [
    { label: "Active organizations", value: orgs.length, sub: `${orgs.filter(o => o.is_verified).length} verified`, color: TEAL },
    { label: "Pending applications", value: pendingApps, sub: "Awaiting review", color: "#C8622A", action: () => setView("applications") },
    { label: "Listing claims",       value: claims.length, sub: "Providers claiming PRM records", color: "#D97706", action: () => setView("claims") },
    { label: "Open requests",        value: pendingReqs + activeReqs, sub: `${pendingReqs} unassigned`, color: "#3A8FE0", action: () => setView("requests") },
    { label: "Unverified orgs",      value: unverified, sub: "Need review", color: MUTED, action: () => setView("organizations") },
  ];

  return (
    <div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.25rem" }}>Good morning</h1>
      <p style={{ color: MUTED, fontSize: "0.9rem", margin: "0 0 2rem" }}>Here's what needs your attention today.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        {stats.map((s) => (
          <div key={s.label} onClick={s.action}
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${s.color}`, borderRadius: "8px", padding: "1.25rem", cursor: s.action ? "pointer" : "default", transition: "box-shadow 0.12s" }}
            onMouseEnter={(e) => { if (s.action) (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            <p style={{ color: MUTED, fontSize: "0.775rem", fontWeight: 500, margin: "0 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
            <p style={{ fontSize: "2rem", fontWeight: 800, color: TEXT, margin: "0 0 0.25rem", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: "0.775rem", color: MUTED, margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        {/* Pending applications */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontWeight: 600, color: TEXT, margin: 0, fontSize: "0.9rem" }}>Pending Applications</p>
            <button onClick={() => setView("applications")} style={{ background: "none", border: "none", color: TEAL, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>View all →</button>
          </div>
          {apps.filter(a => !a.is_verified).slice(0, 4).map(app => (
            <div key={app.id} style={{ padding: "0.875rem 1.25rem", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <div>
                <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.15rem" }}>{app.name}</p>
                <p style={{ color: MUTED, fontSize: "0.78rem", margin: 0 }}>{app.county} · {app.org_type}</p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {app.membership_tier && <span style={{ background: `${TIER_COLORS[app.membership_tier] ?? MUTED}18`, color: TIER_COLORS[app.membership_tier] ?? MUTED, fontSize: "0.68rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "4px" }}>{TIER_LABELS[app.membership_tier] ?? app.membership_tier}</span>}
                <p style={{ color: MUTED, fontSize: "0.72rem", margin: "0.25rem 0 0" }}>{fmt(app.created_at)}</p>
              </div>
            </div>
          ))}
          {apps.filter(a => !a.is_verified).length === 0 && <p style={{ color: MUTED, fontSize: "0.875rem", padding: "1.5rem 1.25rem", margin: 0 }}>No pending applications.</p>}
        </div>

        {/* Recent requests */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontWeight: 600, color: TEXT, margin: 0, fontSize: "0.9rem" }}>Recent Connection Requests</p>
            <button onClick={() => setView("requests")} style={{ background: "none", border: "none", color: TEAL, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>View all →</button>
          </div>
          {reqs.slice(0, 4).map(req => {
            const { from_name, from_org } = parseNote(req.notes);
            return (
              <div key={req.id} style={{ padding: "0.875rem 1.25rem", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.15rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {from_org} → {req.target_org?.name ?? "—"}
                  </p>
                  <p style={{ color: MUTED, fontSize: "0.78rem", margin: 0 }}>{from_name}</p>
                </div>
                <StatusBadge status={req.status} />
              </div>
            );
          })}
          {reqs.length === 0 && <p style={{ color: MUTED, fontSize: "0.875rem", padding: "1.5rem 1.25rem", margin: 0 }}>No connection requests yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Applications ─────────────────────────────────────────────────────────────
function Applications() {
  const qc = useQueryClient();
  const { data: apps = [], isLoading } = useApplications();
  const [filter, setFilter] = useState<"pending" | "rejected" | "all">("pending");
  const [expanded, setExpanded] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: async ({ id, tier }: { id: string; tier: string | null }) => {
      const isPaid = tier === "collaborator" || tier === "strategic";
      const { error } = await supabase
        .from("organizations")
        .update({
          is_active: true,
          is_verified: true,
          payment_status: isPaid ? "unpaid" : "exempt",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
      qc.invalidateQueries({ queryKey: ["directory"] });
      setExpanded(null);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("organizations").update({ payment_status: "paid" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-applications"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      // is_verified=true + is_active=false = reviewed but rejected (kept out of directory)
      const { error } = await supabase
        .from("organizations")
        .update({ is_active: false, is_verified: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-applications"] }); setExpanded(null); },
  });

  const revertMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("organizations")
        .update({ is_active: false, is_verified: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-applications"] }),
  });

  // pending = !verified && !active; rejected = verified && !active
  const filtered = apps.filter(a => {
    if (filter === "pending")  return !a.is_verified && !a.is_active;
    if (filter === "rejected") return  a.is_verified && !a.is_active;
    return true;
  });

  const pendingCount  = apps.filter(a => !a.is_verified && !a.is_active).length;
  const rejectedCount = apps.filter(a => a.is_verified && !a.is_active).length;

  const filterBtnStyle = (f: string) => ({
    padding: "0.4rem 0.875rem",
    border: `1.5px solid ${filter === f ? TEAL : BORDER}`,
    borderRadius: "9999px",
    background: filter === f ? `${TEAL}12` : SURFACE,
    color: filter === f ? TEAL : MUTED,
    fontWeight: filter === f ? 600 : 400,
    fontSize: "0.8rem",
    cursor: "pointer",
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.2rem" }}>Partner Applications</h1>
          <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>Review and act on incoming membership applications.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button style={filterBtnStyle("all")} onClick={() => setFilter("all")}>All ({apps.length})</button>
          <button style={filterBtnStyle("pending")} onClick={() => setFilter("pending")}>Pending ({pendingCount})</button>
          <button style={filterBtnStyle("rejected")} onClick={() => setFilter("rejected")}>Rejected ({rejectedCount})</button>
        </div>
      </div>

      {isLoading && <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>{[1,2,3].map(i => <Skeleton key={i} h="64px" />)}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {!isLoading && filtered.map(app => {
          const primary = app.contacts.find(c => c.is_primary) ?? app.contacts[0];
          const isRejected = app.is_verified && !app.is_active;
          const tierColor = TIER_COLORS[app.membership_tier ?? ""] ?? MUTED;

          return (
            <div key={app.id} style={{ background: SURFACE, border: `1px solid ${expanded === app.id ? TEAL : BORDER}`, borderLeft: `4px solid ${tierColor}`, borderRadius: "8px", overflow: "hidden", transition: "border-color 0.15s" }}>
              <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }} onClick={() => setExpanded(expanded === app.id ? null : app.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.2rem" }}>
                    <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.9375rem", margin: 0 }}>{app.name}</p>
                    <StatusBadge status={isRejected ? "rejected" : "pending"} />
                  </div>
                  <p style={{ color: MUTED, fontSize: "0.8rem", margin: 0 }}>{app.org_type} · {app.county} County{primary ? ` · ${primary.full_name}` : ""}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {app.membership_tier && <span style={{ background: `${tierColor}18`, color: tierColor, fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "4px" }}>{TIER_LABELS[app.membership_tier] ?? app.membership_tier}</span>}
                  <p style={{ color: MUTED, fontSize: "0.72rem", margin: "0.25rem 0 0" }}>Submitted {fmt(app.created_at)}</p>
                </div>
                <span style={{ color: MUTED, fontSize: "0.75rem" }}>{expanded === app.id ? "▲" : "▼"}</span>
              </div>

              {expanded === app.id && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: "1.25rem", background: BG }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.25rem" }}>
                    <div>
                      <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, margin: "0 0 0.5rem" }}>Description</p>
                      <p style={{ fontSize: "0.875rem", color: TEXT, lineHeight: 1.6, margin: 0 }}>{app.description ?? "—"}</p>
                    </div>
                    {primary && (
                      <div>
                        <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, margin: "0 0 0.5rem" }}>Primary Contact</p>
                        <p style={{ fontSize: "0.875rem", color: TEXT, fontWeight: 600, margin: "0 0 0.15rem" }}>{primary.full_name}</p>
                        {primary.title && <p style={{ fontSize: "0.8125rem", color: MUTED, margin: "0 0 0.25rem" }}>{primary.title}</p>}
                        {primary.email && <p style={{ fontSize: "0.8125rem", color: MUTED, margin: "0 0 0.15rem" }}>{primary.email}</p>}
                        {primary.phone && <p style={{ fontSize: "0.8125rem", color: TEXT, margin: 0 }}>{primary.phone}</p>}
                      </div>
                    )}
                  </div>
                  {/* Payment link row — shows for approved paid-tier orgs awaiting payment */}
                  {app.is_active && app.payment_status === "unpaid" && (
                    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "7px", padding: "0.875rem 1.125rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                      <div>
                        <p style={{ fontWeight: 600, color: "#92400E", fontSize: "0.875rem", margin: "0 0 0.2rem" }}>Payment pending</p>
                        <p style={{ color: "#78350F", fontSize: "0.8rem", margin: 0 }}>Org is live in directory. Send the payment link to activate billing.</p>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                        {STRIPE_LINKS[app.membership_tier ?? ""] ? (
                          <button
                            onClick={() => { navigator.clipboard.writeText(STRIPE_LINKS[app.membership_tier ?? ""]); }}
                            style={{ background: "#1E3A4A", color: "#fff", fontWeight: 600, fontSize: "0.8rem", padding: "0.5rem 1rem", border: "none", borderRadius: "6px", cursor: "pointer" }}
                          >
                            Copy Payment Link
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.775rem", color: "#78350F", fontStyle: "italic" }}>Add VITE_STRIPE_LINK_{(app.membership_tier ?? "").toUpperCase()} to .env</span>
                        )}
                        <button
                          onClick={() => markPaidMutation.mutate(app.id)}
                          disabled={markPaidMutation.isPending}
                          style={{ background: SURFACE, border: "1.5px solid #A7F3D0", color: "#065F46", fontWeight: 600, fontSize: "0.8rem", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer" }}
                        >
                          Mark as Paid
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", alignItems: "center" }}>
                    <button onClick={() => revertMutation.mutate(app.id)} style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: MUTED, fontWeight: 500, fontSize: "0.8rem", padding: "0.5rem 1rem", borderRadius: "7px", cursor: "pointer" }}>
                      Reset to pending
                    </button>
                    {!isRejected && !app.is_active && (
                      <button onClick={() => rejectMutation.mutate(app.id)} disabled={rejectMutation.isPending}
                        style={{ background: SURFACE, border: "1.5px solid #FECACA", color: "#B91C1C", fontWeight: 600, fontSize: "0.875rem", padding: "0.6rem 1.25rem", borderRadius: "7px", cursor: "pointer" }}>
                        Reject
                      </button>
                    )}
                    {!isRejected && !app.is_active && (
                      <button onClick={() => approveMutation.mutate({ id: app.id, tier: app.membership_tier })} disabled={approveMutation.isPending}
                        style={{ background: TEAL, border: "none", color: "#fff", fontWeight: 600, fontSize: "0.875rem", padding: "0.6rem 1.5rem", borderRadius: "7px", cursor: "pointer" }}>
                        {approveMutation.isPending ? "Approving…" : "✓ Approve & Add to Directory"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem", color: MUTED }}>
            <p style={{ fontSize: "1rem", fontWeight: 600, color: TEXT, margin: "0 0 0.25rem" }}>No applications here</p>
            <p style={{ margin: 0, fontSize: "0.875rem" }}>New applications from the Join the Network flow will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Connection Requests ──────────────────────────────────────────────────────
function ConnectionRequests() {
  const qc = useQueryClient();
  const { data: reqs = [], isLoading } = useConnectionRequests();
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const advanceMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("connection_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-requests"] }),
  });

  const nextStatus = (s: string) => s === "pending" ? "active" : s === "active" ? "resolved" : null;
  const is72hrFlagged = (r: { status: string; created_at: string }) =>
    r.status === "pending" && hoursAgo(r.created_at) >= 72;

  const visible = filter === "all" ? reqs
    : filter === "__72hr" ? reqs.filter(is72hrFlagged)
    : reqs.filter(r => r.status === filter);
  const counts: Record<string, number> = { all: reqs.length };
  for (const r of reqs) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const flaggedCount = reqs.filter(is72hrFlagged).length;

  const filterBtnStyle = (f: string) => ({
    padding: "0.4rem 0.875rem",
    border: `1.5px solid ${filter === f ? TEAL : BORDER}`,
    borderRadius: "9999px",
    background: filter === f ? `${TEAL}12` : SURFACE,
    color: filter === f ? TEAL : MUTED,
    fontWeight: filter === f ? 600 : 400,
    fontSize: "0.8rem",
    cursor: "pointer",
    textTransform: "capitalize" as const,
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.2rem" }}>Connection Requests</h1>
          <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>All requests route through TSE before reaching partner organizations.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {["all", "pending", "active", "resolved", "unresponsive"].map(f => (
            <button key={f} style={filterBtnStyle(f)} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] ?? 0})
            </button>
          ))}
          {flaggedCount > 0 && (
            <button style={filterBtnStyle("__72hr")} onClick={() => setFilter("__72hr")}>
              ⚠ 72hr ({flaggedCount})
            </button>
          )}
        </div>
      </div>

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", gap: "1rem", padding: "0.75rem 1.25rem", background: BG, borderBottom: `1px solid ${BORDER}` }}>
          {["From", "Target Organization", "Submitted", "Status"].map(h => (
            <p key={h} style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, margin: 0 }}>{h}</p>
          ))}
        </div>

        {isLoading && [1,2,3].map(i => (
          <div key={i} style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${BORDER}` }}><Skeleton h="40px" /></div>
        ))}

        {visible.map(req => {
          const { from_name, from_org, from_phone, hmis_id, note } = parseNote(req.notes);
          const next    = nextStatus(req.status);
          const flagged = is72hrFlagged(req);
          return (
            <div key={req.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              {flagged && (
                <div style={{ background: "#FEF2F2", borderBottom: `1px solid #FECACA`, padding: "0.4rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.72rem", color: "#991B1B", fontWeight: 700 }}>⚠ No response for 72+ hours</span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", gap: "1rem", padding: "1rem 1.25rem", cursor: "pointer", alignItems: "center" }}
                onClick={() => setExpanded(expanded === req.id ? null : req.id)}>
                <div>
                  <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.15rem" }}>{from_name}</p>
                  <p style={{ color: MUTED, fontSize: "0.78rem", margin: 0 }}>{from_org}</p>
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.15rem" }}>{req.target_org?.name ?? "—"}</p>
                  <p style={{ color: MUTED, fontSize: "0.78rem", margin: 0 }}>{req.target_contact?.full_name ?? "—"}</p>
                </div>
                <p style={{ color: MUTED, fontSize: "0.8rem", margin: 0 }}>{fmt(req.created_at)}</p>
                <StatusBadge status={req.status} />
              </div>

              {expanded === req.id && (
                <div style={{ padding: "1.25rem", background: BG, borderTop: `1px solid ${BORDER}` }}>
                  {hmis_id && (
                    <div style={{ marginBottom: "0.875rem" }}>
                      <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 0.25rem" }}>HMIS Client ID</p>
                      <p style={{ fontSize: "0.875rem", color: TEXT, margin: 0, fontFamily: "monospace" }}>{hmis_id}</p>
                    </div>
                  )}
                  {note && (
                    <div style={{ marginBottom: "1.25rem" }}>
                      <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 0.5rem" }}>Request note</p>
                      <p style={{ fontSize: "0.875rem", color: TEXT, lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>"{note}"</p>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                    {from_phone !== "—" ? (
                      <a href={`tel:${from_phone.replace(/\D/g, "")}`} style={{ color: TEAL, fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
                        Call {from_name} · {from_phone}
                      </a>
                    ) : <span />}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {flagged && req.status !== "unresponsive" && (
                        <button
                          onClick={() => advanceMutation.mutate({ id: req.id, status: "unresponsive" })}
                          disabled={advanceMutation.isPending}
                          style={{ background: "#FEE2E2", color: "#991B1B", fontWeight: 600, fontSize: "0.8rem", padding: "0.5rem 1rem", border: "1px solid #FECACA", borderRadius: "7px", cursor: "pointer" }}
                        >
                          Mark Unresponsive
                        </button>
                      )}
                      {next && (
                        <button onClick={() => advanceMutation.mutate({ id: req.id, status: next })} disabled={advanceMutation.isPending}
                          style={{ background: DARK, color: "#fff", fontWeight: 600, fontSize: "0.875rem", padding: "0.575rem 1.25rem", border: "none", borderRadius: "7px", cursor: "pointer" }}>
                          {advanceMutation.isPending ? "Updating…" : next === "active" ? "Mark as Active" : "Mark as Resolved"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!isLoading && visible.length === 0 && (
          <p style={{ color: MUTED, padding: "2rem 1.25rem", margin: 0, fontSize: "0.9rem" }}>No requests in this category.</p>
        )}
      </div>
    </div>
  );
}

// ─── Claim Queue ─────────────────────────────────────────────────────────────
function ClaimQueue() {
  const qc = useQueryClient();
  const { data: claims = [], isLoading } = usePendingClaims();
  const [expanded, setExpanded] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: async ({ recordId, orgId, tier }: { recordId: string; orgId: string; tier: string | null }) => {
      const isPaid = tier === "collaborator" || tier === "strategic";
      const [claimRes, orgRes] = await Promise.all([
        supabase.from("prm_leads").update({ claim_status: "approved" }).eq("record_id", recordId),
        supabase.from("organizations").update({
          is_active: true,
          is_verified: true,
          payment_status: isPaid ? "unpaid" : "exempt",
        }).eq("id", orgId),
      ]);
      if (claimRes.error) throw claimRes.error;
      if (orgRes.error)   throw orgRes.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-claims"] });
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
      qc.invalidateQueries({ queryKey: ["directory"] });
      setExpanded(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ recordId, orgId }: { recordId: string; orgId: string }) => {
      const [claimRes, orgRes] = await Promise.all([
        supabase.from("prm_leads").update({ claim_status: "rejected" }).eq("record_id", recordId),
        supabase.from("organizations").update({ is_active: false, is_verified: true }).eq("id", orgId),
      ]);
      if (claimRes.error) throw claimRes.error;
      if (orgRes.error)   throw orgRes.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-claims"] });
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
      setExpanded(null);
    },
  });

  const GOLD = "#D97706";

  function DiffRow({ label, original, submitted }: { label: string; original: string | null; submitted: string | null }) {
    const changed = original && submitted && original.toLowerCase().trim() !== submitted.toLowerCase().trim();
    return (
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: "0.75rem", padding: "0.5rem 0", borderBottom: `1px solid ${BORDER}`, alignItems: "start", fontSize: "0.8125rem" }}>
        <span style={{ color: MUTED, fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", paddingTop: "0.1rem" }}>{label}</span>
        <span style={{ color: TEXT }}>{original || <em style={{ color: MUTED }}>—</em>}</span>
        <span style={{
          color: changed ? TEAL : TEXT,
          fontWeight: changed ? 600 : 400,
          background: changed ? `${TEAL}10` : "transparent",
          padding: changed ? "0.1rem 0.35rem" : 0,
          borderRadius: "3px",
        }}>
          {submitted || <em style={{ color: MUTED }}>—</em>}
          {changed && <span style={{ marginLeft: "0.35rem", fontSize: "0.65rem", color: TEAL }}>UPDATED</span>}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.2rem" }}>Claim Queue</h1>
        <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>
          Providers who found their org in the PRM and submitted a claim. Review the original record vs. what they submitted before approving.
        </p>
      </div>

      {isLoading && <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>{[1,2,3].map(i => <Skeleton key={i} h="64px" />)}</div>}

      {!isLoading && claims.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", color: MUTED }}>
          <p style={{ fontSize: "2rem", margin: "0 0 0.75rem" }}>🔖</p>
          <p style={{ fontWeight: 600, color: TEXT, margin: "0 0 0.25rem", fontSize: "1rem" }}>No pending claims</p>
          <p style={{ margin: 0, fontSize: "0.875rem" }}>When providers claim a listing through the Join flow, they'll appear here for review.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {claims.map(claim => {
          const org = claim.org;
          const contact = org?.contacts?.[0];
          const isOpen = expanded === claim.record_id;

          return (
            <div key={claim.record_id} style={{
              background: SURFACE, border: `1px solid ${isOpen ? TEAL : BORDER}`,
              borderLeft: `4px solid ${GOLD}`, borderRadius: "8px", overflow: "hidden", transition: "border-color 0.15s",
            }}>
              {/* Row header */}
              <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }}
                onClick={() => setExpanded(isOpen ? null : claim.record_id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.2rem" }}>
                    <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.9375rem", margin: 0 }}>{claim.org_name ?? "Unknown"}</p>
                    <span style={{ background: "#FEF9C3", color: "#854D0E", fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>Claim pending</span>
                    {org && (
                      <span style={{ background: `${TIER_COLORS[org.membership_tier ?? ""] ?? MUTED}18`, color: TIER_COLORS[org.membership_tier ?? ""] ?? MUTED, fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                        {TIER_LABELS[org.membership_tier ?? ""] ?? org.membership_tier}
                      </span>
                    )}
                  </div>
                  <p style={{ color: MUTED, fontSize: "0.8rem", margin: 0 }}>
                    {claim.county} County · {claim.primary_category} · PRM {claim.record_id}
                    {claim.claimed_by_email && <span> · Claimed by <strong style={{ color: TEXT }}>{claim.claimed_by_email}</strong></span>}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ color: MUTED, fontSize: "0.72rem", margin: 0 }}>
                    {claim.claimed_at ? fmt(claim.claimed_at) : "—"}
                  </p>
                </div>
                <span style={{ color: MUTED, fontSize: "0.75rem" }}>{isOpen ? "▲" : "▼"}</span>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: "1.5rem", background: BG }}>

                  {/* Compare table */}
                  <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, margin: "0 0 0.75rem" }}>Side-by-side comparison</p>
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "0.5rem 1rem", marginBottom: "1.5rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: "0.75rem", padding: "0.5rem 0 0.75rem", borderBottom: `1px solid ${BORDER}`, marginBottom: "0.25rem" }}>
                      <span />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED }}>Original PRM record</span>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: TEAL }}>Provider submitted</span>
                    </div>
                    <DiffRow label="Org name"    original={claim.org_name}     submitted={org?.name ?? null} />
                    <DiffRow label="County"      original={claim.county}       submitted={org?.county ?? null} />
                    <DiffRow label="Category"    original={claim.primary_category} submitted={org?.org_type ?? null} />
                    <DiffRow label="Contact"     original={claim.contact_name}  submitted={contact?.full_name ?? null} />
                    <DiffRow label="Title"       original={claim.contact_title} submitted={contact?.title ?? null} />
                    <DiffRow label="Phone"       original={claim.main_phone}    submitted={contact?.phone ?? null} />
                    <DiffRow label="Email"       original={claim.email}         submitted={contact?.email ?? null} />
                    <DiffRow label="Website"     original={claim.website}       submitted={org ? (org as unknown as Record<string, string>)["website"] ?? null : null} />
                  </div>

                  {/* Description from provider */}
                  {org?.description && (
                    <div style={{ marginBottom: "1.25rem" }}>
                      <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 0.5rem" }}>Description (provider submitted)</p>
                      <p style={{ fontSize: "0.875rem", color: TEXT, lineHeight: 1.65, margin: 0, fontStyle: "italic", padding: "0.75rem 1rem", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "6px" }}>
                        "{org.description}"
                      </p>
                    </div>
                  )}

                  {/* PRM notes */}
                  {claim.follow_up_notes && (
                    <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "6px" }}>
                      <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#92400E", margin: "0 0 0.3rem" }}>PRM notes</p>
                      <p style={{ fontSize: "0.8125rem", color: "#78350F", margin: 0, lineHeight: 1.55 }}>{claim.follow_up_notes}</p>
                    </div>
                  )}

                  {/* Partnership status from PRM */}
                  {claim.partnership_status && (
                    <div style={{ marginBottom: "1.25rem" }}>
                      <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 0.25rem" }}>Original partnership status</p>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: TEXT }}>{claim.partnership_status}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                    {org && (
                      <>
                        <button
                          onClick={() => rejectMutation.mutate({ recordId: claim.record_id, orgId: org.id })}
                          disabled={rejectMutation.isPending}
                          style={{ background: SURFACE, border: "1.5px solid #FECACA", color: "#B91C1C", fontWeight: 600, fontSize: "0.875rem", padding: "0.6rem 1.25rem", borderRadius: "7px", cursor: "pointer" }}
                        >
                          Reject claim
                        </button>
                        <button
                          onClick={() => approveMutation.mutate({ recordId: claim.record_id, orgId: org.id, tier: org.membership_tier })}
                          disabled={approveMutation.isPending}
                          style={{ background: TEAL, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.875rem", padding: "0.6rem 1.75rem", borderRadius: "7px", cursor: "pointer" }}
                        >
                          {approveMutation.isPending ? "Approving…" : "✓ Approve & publish to directory"}
                        </button>
                      </>
                    )}
                    {!org && (
                      <p style={{ color: MUTED, fontSize: "0.8125rem", fontStyle: "italic", margin: 0 }}>No linked organization found for this claim.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Organizations ────────────────────────────────────────────────────────────
function Organizations() {
  const qc = useQueryClient();
  const { data: orgs = [], isLoading } = useOrganizations();

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "is_verified" | "is_active"; value: boolean }) => {
      const { error } = await supabase.from("organizations").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-organizations"] }); qc.invalidateQueries({ queryKey: ["directory"] }); },
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.2rem" }}>Organizations</h1>
          <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>{orgs.length} active · {orgs.filter(o => o.is_verified).length} verified</p>
        </div>
      </div>

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr", gap: "1rem", padding: "0.75rem 1.25rem", background: BG, borderBottom: `1px solid ${BORDER}` }}>
          {["Organization", "Contact", "Tier", "Payment", "Verified", "Active"].map(h => (
            <p key={h} style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, margin: 0 }}>{h}</p>
          ))}
        </div>

        {isLoading && [1,2,3,4].map(i => (
          <div key={i} style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${BORDER}` }}><Skeleton h="40px" /></div>
        ))}

        {orgs.map(org => {
          const primary = org.contacts.find(c => c.is_primary) ?? org.contacts[0];
          const tierColor = TIER_COLORS[org.membership_tier ?? ""] ?? MUTED;
          const paymentBg    = org.payment_status === "paid" ? "#DCFCE7" : org.payment_status === "unpaid" ? "#FEF9C3" : "#F3F4F6";
          const paymentColor = org.payment_status === "paid" ? "#166534" : org.payment_status === "unpaid" ? "#854D0E" : MUTED;
          const paymentLabel = org.payment_status === "paid" ? "Paid" : org.payment_status === "unpaid" ? "Awaiting" : "Exempt";
          return (
            <div key={org.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr", gap: "1rem", padding: "0.9375rem 1.25rem", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.15rem" }}>{org.name}</p>
                <p style={{ color: MUTED, fontSize: "0.78rem", margin: 0 }}>{org.org_type} · {org.county}</p>
              </div>
              <div>
                <p style={{ color: TEXT, fontSize: "0.8375rem", margin: "0 0 0.1rem" }}>{primary?.full_name ?? "—"}</p>
                <p style={{ color: MUTED, fontSize: "0.75rem", margin: 0 }}>Joined {fmt(org.created_at)}</p>
              </div>
              <span style={{ background: `${tierColor}18`, color: tierColor, fontSize: "0.68rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "4px", whiteSpace: "nowrap" }}>
                {org.membership_tier ? (TIER_LABELS[org.membership_tier] ?? org.membership_tier).replace("Network ", "").replace("Founding Strategic Circle", "Founding") : "—"}
              </span>
              <span style={{ background: paymentBg, color: paymentColor, fontSize: "0.68rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "9999px", whiteSpace: "nowrap", display: "inline-block" }}>
                {paymentLabel}
              </span>
              <button onClick={() => toggleMutation.mutate({ id: org.id, field: "is_verified", value: !org.is_verified })}
                style={{ background: org.is_verified ? "#DCFCE7" : "#FEF9C3", color: org.is_verified ? "#166534" : "#854D0E", border: "none", borderRadius: "9999px", fontSize: "0.72rem", fontWeight: 700, padding: "0.25rem 0.625rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                {org.is_verified ? "✓ Verified" : "Unverified"}
              </button>
              <button onClick={() => toggleMutation.mutate({ id: org.id, field: "is_active", value: !org.is_active })}
                style={{ background: org.is_active ? "#DBEAFE" : "#F3F4F6", color: org.is_active ? "#1E40AF" : "#374151", border: "none", borderRadius: "9999px", fontSize: "0.72rem", fontWeight: 700, padding: "0.25rem 0.625rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                {org.is_active ? "Active" : "Inactive"}
              </button>
            </div>
          );
        })}

        {!isLoading && orgs.length === 0 && (
          <p style={{ color: MUTED, padding: "2rem 1.25rem", margin: 0, fontSize: "0.9rem" }}>No active organizations yet. Approve applications to populate this list.</p>
        )}
      </div>
    </div>
  );
}

// ─── Knowledge Library Admin ──────────────────────────────────────────────────
function KnowledgeLibrary() {
  const { data: resources = [], isLoading } = useAllKnowledgeResources();
  const { create, update, remove } = useKnowledgeResourceMutations();
  const [editing, setEditing] = useState<null | typeof resources[0]>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "guide", url: "", is_published: true });
  const [showForm, setShowForm] = useState(false);

  function openNew() { setEditing(null); setForm({ title: "", description: "", category: "guide", url: "", is_published: true }); setShowForm(true); }
  function openEdit(r: typeof resources[0]) { setEditing(r); setForm({ title: r.title, description: r.description ?? "", category: r.category, url: r.url ?? "", is_published: r.is_published }); setShowForm(true); }

  async function handleSave() {
    if (editing) {
      await update.mutateAsync({ id: editing.id, ...form });
    } else {
      await create.mutateAsync(form);
    }
    setShowForm(false);
  }

  const CATEGORIES = ["guide", "template", "tool", "policy", "training", "other"];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.2rem" }}>Knowledge Library</h1>
          <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>{resources.length} resources · {resources.filter(r => r.is_published).length} published</p>
        </div>
        <button onClick={openNew} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: "7px", fontWeight: 700, fontSize: "0.875rem", padding: "0.6rem 1.25rem", cursor: "pointer" }}>
          + Add resource
        </button>
      </div>

      {showForm && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: TEXT, margin: "0 0 1.25rem" }}>{editing ? "Edit resource" : "New resource"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: MUTED, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: MUTED, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", fontFamily: "inherit" }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: MUTED, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", fontFamily: "inherit", resize: "vertical" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: MUTED, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>URL</label>
              <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "1.4rem" }}>
              <input type="checkbox" id="kr-published" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} />
              <label htmlFor="kr-published" style={{ fontSize: "0.875rem", color: TEXT }}>Published</label>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600, fontSize: "0.875rem", padding: "0.6rem 1.25rem", borderRadius: "7px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} disabled={create.isPending || update.isPending} style={{ background: TEAL, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.875rem", padding: "0.6rem 1.5rem", borderRadius: "7px", cursor: "pointer" }}>
              {create.isPending || update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 100px", gap: "1rem", padding: "0.75rem 1.25rem", background: BG, borderBottom: `1px solid ${BORDER}` }}>
          {["Title", "Category", "URL", "Status", ""].map(h => (
            <p key={h} style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, margin: 0 }}>{h}</p>
          ))}
        </div>
        {isLoading && [1,2,3].map(i => <div key={i} style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${BORDER}` }}><Skeleton h="32px" /></div>)}
        {resources.map(r => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 100px", gap: "1rem", padding: "0.9rem 1.25rem", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
            <div>
              <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.1rem" }}>{r.title}</p>
              {r.description && <p style={{ color: MUTED, fontSize: "0.78rem", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description}</p>}
            </div>
            <span style={{ fontSize: "0.78rem", color: MUTED }}>{r.category}</span>
            <span style={{ fontSize: "0.78rem", color: TEAL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.url ? new URL(r.url.startsWith("http") ? r.url : "https://" + r.url).hostname : "—"}</span>
            <span style={{ background: r.is_published ? "#DCFCE7" : "#F3F4F6", color: r.is_published ? "#166534" : MUTED, fontSize: "0.68rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "9999px", whiteSpace: "nowrap", display: "inline-block" }}>
              {r.is_published ? "Live" : "Draft"}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => openEdit(r)} style={{ background: "none", border: `1px solid ${BORDER}`, color: TEXT, fontSize: "0.75rem", fontWeight: 600, padding: "0.25rem 0.6rem", borderRadius: "5px", cursor: "pointer" }}>Edit</button>
              <button onClick={() => remove.mutate(r.id)} style={{ background: "none", border: "1px solid #FECACA", color: "#B91C1C", fontSize: "0.75rem", fontWeight: 600, padding: "0.25rem 0.6rem", borderRadius: "5px", cursor: "pointer" }}>Del</button>
            </div>
          </div>
        ))}
        {!isLoading && resources.length === 0 && <p style={{ color: MUTED, padding: "2rem 1.25rem", margin: 0, fontSize: "0.9rem" }}>No resources yet. Add one above.</p>}
      </div>
    </div>
  );
}

// ─── Announcements Admin ──────────────────────────────────────────────────────
function AnnouncementsAdmin() {
  const { data: announcements = [], isLoading } = useAllAnnouncements();
  const { create, update, remove } = useAnnouncementMutations();
  const [editing, setEditing] = useState<null | typeof announcements[0]>(null);
  const [form, setForm] = useState({ title: "", body: "", is_published: true });
  const [showForm, setShowForm] = useState(false);

  function openNew() { setEditing(null); setForm({ title: "", body: "", is_published: true }); setShowForm(true); }
  function openEdit(a: typeof announcements[0]) { setEditing(a); setForm({ title: a.title ?? "", body: a.body, is_published: a.is_published }); setShowForm(true); }

  async function handleSave() {
    if (editing) {
      await update.mutateAsync({ id: editing.id, ...form });
    } else {
      await create.mutateAsync(form);
    }
    setShowForm(false);
  }

  function fmt2(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.2rem" }}>Announcements</h1>
          <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>{announcements.length} total · {announcements.filter(a => a.is_published).length} published</p>
        </div>
        <button onClick={openNew} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: "7px", fontWeight: 700, fontSize: "0.875rem", padding: "0.6rem 1.25rem", cursor: "pointer" }}>
          + New announcement
        </button>
      </div>

      {showForm && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: TEXT, margin: "0 0 1.25rem" }}>{editing ? "Edit announcement" : "New announcement"}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: MUTED, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Title (optional)</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: MUTED, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Message</label>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", fontFamily: "inherit", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" id="ann-published" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} />
              <label htmlFor="ann-published" style={{ fontSize: "0.875rem", color: TEXT }}>Publish immediately</label>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600, fontSize: "0.875rem", padding: "0.6rem 1.25rem", borderRadius: "7px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} disabled={create.isPending || update.isPending} style={{ background: TEAL, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.875rem", padding: "0.6rem 1.5rem", borderRadius: "7px", cursor: "pointer" }}>
              {create.isPending || update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {isLoading && [1,2].map(i => <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "1.25rem" }}><Skeleton h="40px" /></div>)}
        {announcements.map(a => (
          <div key={a.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${a.is_published ? TEAL : BORDER}`, borderRadius: "0 8px 8px 0", padding: "1rem 1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{ flex: 1 }}>
                {a.title && <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.3rem" }}>{a.title}</p>}
                <p style={{ color: TEXT, fontSize: "0.875rem", lineHeight: 1.65, margin: "0 0 0.3rem" }}>{a.body}</p>
                <p style={{ color: MUTED, fontSize: "0.75rem", margin: 0 }}>{fmt2(a.created_at)}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                <span style={{ background: a.is_published ? "#DCFCE7" : "#F3F4F6", color: a.is_published ? "#166534" : MUTED, fontSize: "0.68rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "9999px" }}>
                  {a.is_published ? "Live" : "Draft"}
                </span>
                <button onClick={() => openEdit(a)} style={{ background: "none", border: `1px solid ${BORDER}`, color: TEXT, fontSize: "0.75rem", fontWeight: 600, padding: "0.25rem 0.6rem", borderRadius: "5px", cursor: "pointer" }}>Edit</button>
                <button onClick={() => remove.mutate(a.id)} style={{ background: "none", border: "1px solid #FECACA", color: "#B91C1C", fontSize: "0.75rem", fontWeight: 600, padding: "0.25rem 0.6rem", borderRadius: "5px", cursor: "pointer" }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && announcements.length === 0 && <p style={{ color: MUTED, fontSize: "0.9rem" }}>No announcements yet. Create one above.</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [view, setView] = useState<View>("overview");
  const { signOut } = useAuth();

  const { data: apps = [] }    = useApplications();
  const { data: reqs = [] }    = useConnectionRequests();
  const { data: claims = [] }  = usePendingClaims();

  const pendingApps    = apps.filter(a => !a.is_verified && !a.is_active).length;
  const pendingReqs    = reqs.filter(r => r.status === "pending").length;
  const pendingClaims  = claims.length;

  const content = {
    overview:      <Overview setView={setView} />,
    applications:  <Applications />,
    claims:        <ClaimQueue />,
    requests:      <ConnectionRequests />,
    organizations: <Organizations />,
    crm:           <CRMView />,
    knowledge:     <KnowledgeLibrary />,
    announcements: <AnnouncementsAdmin />,
  }[view];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: BG }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
      <Sidebar view={view} setView={setView} onSignOut={signOut} pendingApps={pendingApps} pendingReqs={pendingReqs} pendingClaims={pendingClaims} />
      <main style={{ flex: 1, padding: "2.5rem", overflowY: "auto", minWidth: 0 }}>
        {content}
      </main>
    </div>
  );
}
