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

// ─── LocationCount ────────────────────────────────────────────────────────────
function LocationCount({ orgId }: { orgId: string }) {
  const { data } = useQuery({
    queryKey: ["admin-locations-count", orgId],
    queryFn: async () => {
      const { count } = await supabase
        .from("locations")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);
      return count ?? 0;
    },
    staleTime: 60_000,
  });
  if (!data || data === 0) return null;
  return (
    <span style={{ fontSize: "0.68rem", color: MUTED, marginTop: "0.15rem", display: "block" }}>
      {data} location{data !== 1 ? "s" : ""}
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
  verification_call_notes: string | null;
  verification_call_at: string | null;
  agreement_signed_at: string | null;
  payment_requested_at: string | null;
  activated_at: string | null;
  contacts: { id: string; full_name: string; title: string | null; email: string | null; phone: string | null; is_primary: boolean }[];
}

// Configurable booking links (set via env or admin)
const BOOKING_LINK_VERIFICATION   = import.meta.env.VITE_BOOKING_LINK_VERIFICATION   ?? "";
const BOOKING_LINK_IMPLEMENTATION = import.meta.env.VITE_BOOKING_LINK_IMPLEMENTATION ?? "";

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
type View = "overview" | "applications" | "claims" | "requests" | "organizations" | "tse_tasks" | "crm" | "knowledge" | "announcements" | "billing" | "invitations";

function Sidebar({
  view, setView, onSignOut,
  pendingApps, pendingReqs, pendingClaims, pendingTasks,
}: {
  view: View; setView: (v: View) => void; onSignOut: () => void;
  pendingApps: number; pendingReqs: number; pendingClaims: number; pendingTasks: number;
}) {
  const navItems = [
    { id: "overview"      as View, label: "Overview",      icon: "◈",  badge: 0 },
    { id: "applications"  as View, label: "Applications",  icon: "📋", badge: pendingApps },
    { id: "claims"        as View, label: "Claim Queue",   icon: "🔖", badge: pendingClaims },
    { id: "requests"      as View, label: "Requests",      icon: "🔗", badge: pendingReqs },
    { id: "organizations" as View, label: "Organizations", icon: "🏢", badge: 0 },
    { id: "tse_tasks"     as View, label: "TSE Tasks",     icon: "⚑",  badge: pendingTasks },
    { id: "billing"       as View, label: "Billing",       icon: "💳", badge: 0 },
    { id: "invitations"   as View, label: "Invitations",   icon: "✉️", badge: 0 },
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
function appStage(app: RawApplication): "submitted" | "verified" | "agreement" | "payment_requested" | "paid" | "rejected" {
  if (app.is_verified && app.is_active) return "paid"; // shouldn't appear here but guard
  if (app.is_verified && !app.is_active && app.payment_status === "paid") return "paid";
  if (app.is_verified && !app.is_active && app.payment_requested_at) return "payment_requested";
  if (app.is_verified && !app.is_active && app.agreement_signed_at) return "agreement";
  if (app.is_verified && !app.is_active) return "verified";
  return "submitted";
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  submitted:         { label: "Submitted",         color: "#854D0E" },
  verified:          { label: "Verification done", color: "#1E40AF" },
  agreement:         { label: "Agreement signed",  color: "#7C3AED" },
  payment_requested: { label: "Payment requested", color: "#C8622A" },
  paid:              { label: "Ready to activate", color: SAGE },
  rejected:          { label: "Rejected",          color: "#991B1B" },
};

function AppWorkflowPanel({ app, qc }: { app: RawApplication; qc: ReturnType<typeof useQueryClient> }) {
  const stage = appStage(app);
  const primary = app.contacts.find(c => c.is_primary) ?? app.contacts[0];
  const [callNotes, setCallNotes] = useState(app.verification_call_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-applications"] });
    qc.invalidateQueries({ queryKey: ["admin-organizations"] });
  };

  // Stage mutations
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("organizations").update({
        is_verified: true,
        is_active: false,
        verification_call_at: new Date().toISOString(),
        verification_call_notes: callNotes || null,
      }).eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const agreementMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("organizations")
        .update({ agreement_signed_at: new Date().toISOString() }).eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const requestPaymentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("organizations")
        .update({ payment_requested_at: new Date().toISOString() }).eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("organizations")
        .update({ payment_status: "paid" }).eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_activate_org", { p_org_id: app.id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["directory"] }); },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("organizations")
        .update({ is_active: false, is_verified: true }).eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const revertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("organizations")
        .update({ is_active: false, is_verified: false }).eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  async function saveNotes() {
    setSavingNotes(true);
    await supabase.from("organizations").update({ verification_call_notes: callNotes || null }).eq("id", app.id);
    setSavingNotes(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  const paymentLink = STRIPE_LINKS[app.membership_tier ?? ""];

  return (
    <div style={{ borderTop: `1px solid ${BORDER}`, background: BG }}>
      {/* Contact + description */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", padding: "1.25rem 1.25rem 0" }}>
        <div>
          <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, margin: "0 0 0.5rem" }}>Description</p>
          <p style={{ fontSize: "0.8125rem", color: TEXT, lineHeight: 1.6, margin: 0 }}>{app.description ?? "—"}</p>
        </div>
        {primary && (
          <div>
            <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, margin: "0 0 0.5rem" }}>Primary Contact</p>
            <p style={{ fontSize: "0.875rem", color: TEXT, fontWeight: 600, margin: "0 0 0.1rem" }}>{primary.full_name}</p>
            {primary.title && <p style={{ fontSize: "0.78rem", color: MUTED, margin: "0 0 0.2rem" }}>{primary.title}</p>}
            {primary.email && <p style={{ fontSize: "0.78rem", color: MUTED, margin: "0 0 0.1rem" }}>{primary.email}</p>}
            {primary.phone && <p style={{ fontSize: "0.78rem", color: TEXT, margin: 0 }}>{primary.phone}</p>}
          </div>
        )}
      </div>

      {/* ── Stage 1: Submitted → verification call ───────────────────────────── */}
      <div style={{ padding: "1.25rem" }}>
        <WorkflowStage
          number={1} label="Verification call"
          done={!!app.verification_call_at}
          active={stage === "submitted"}
          doneAt={app.verification_call_at}
        >
          {stage === "submitted" && (
            <>
              {BOOKING_LINK_VERIFICATION && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <a href={BOOKING_LINK_VERIFICATION} target="_blank" rel="noreferrer"
                    style={{ fontSize: "0.8rem", color: TEAL, fontWeight: 600, textDecoration: "none" }}>
                    Open booking calendar ↗
                  </a>
                </div>
              )}
              <textarea
                value={callNotes}
                onChange={e => { setCallNotes(e.target.value); setNotesSaved(false); }}
                placeholder="Verification call notes — who was on the call, what was discussed, any flags or additional checks needed…"
                style={{ width: "100%", boxSizing: "border-box", minHeight: 80, padding: "0.625rem 0.75rem", border: `1.5px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.8125rem", color: TEXT, fontFamily: "inherit", resize: "vertical", marginBottom: "0.75rem" }}
              />
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={saveNotes} disabled={savingNotes}
                  style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: MUTED, fontWeight: 500, fontSize: "0.78rem", padding: "0.4rem 0.875rem", borderRadius: "6px", cursor: "pointer" }}>
                  {notesSaved ? "✓ Saved" : savingNotes ? "Saving…" : "Save notes"}
                </button>
                <button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}
                  style={{ background: TEAL, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.875rem", padding: "0.5rem 1.25rem", borderRadius: "6px", cursor: "pointer" }}>
                  {verifyMutation.isPending ? "Marking…" : "✓ Mark verification complete"}
                </button>
                <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}
                  style={{ marginLeft: "auto", background: SURFACE, border: "1.5px solid #FECACA", color: "#B91C1C", fontWeight: 600, fontSize: "0.78rem", padding: "0.4rem 0.875rem", borderRadius: "6px", cursor: "pointer" }}>
                  Reject application
                </button>
              </div>
            </>
          )}
          {app.verification_call_notes && stage !== "submitted" && (
            <p style={{ fontSize: "0.78rem", color: MUTED, fontStyle: "italic", margin: 0 }}>{app.verification_call_notes}</p>
          )}
        </WorkflowStage>

        {/* ── Stage 2: Agreement signed ──────────────────────────────────────── */}
        <WorkflowStage
          number={2} label="Signed agreement"
          done={!!app.agreement_signed_at}
          active={stage === "verified"}
          doneAt={app.agreement_signed_at}
        >
          {stage === "verified" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <p style={{ fontSize: "0.78rem", color: MUTED, margin: 0, flex: 1 }}>
                Send the annual membership agreement to {primary?.email ?? "the primary contact"} for signature. Mark as signed once returned.
              </p>
              <button onClick={() => agreementMutation.mutate()} disabled={agreementMutation.isPending}
                style={{ background: DARK, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.875rem", padding: "0.5rem 1.25rem", borderRadius: "6px", cursor: "pointer", flexShrink: 0 }}>
                {agreementMutation.isPending ? "Saving…" : "✓ Agreement signed"}
              </button>
            </div>
          )}
        </WorkflowStage>

        {/* ── Stage 3: Payment request ───────────────────────────────────────── */}
        <WorkflowStage
          number={3} label="Annual payment"
          done={app.payment_status === "paid" || app.payment_status === "exempt"}
          active={stage === "agreement"}
          doneAt={app.payment_status === "paid" ? app.payment_requested_at : null}
        >
          {stage === "agreement" && (
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              {paymentLink ? (
                <button onClick={() => { navigator.clipboard.writeText(paymentLink); requestPaymentMutation.mutate(); }}
                  style={{ background: DARK, color: "#fff", fontWeight: 600, fontSize: "0.8rem", padding: "0.5rem 1rem", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                  Copy &amp; send payment link
                </button>
              ) : (
                <span style={{ fontSize: "0.78rem", color: MUTED, fontStyle: "italic" }}>
                  Set VITE_STRIPE_LINK_{(app.membership_tier ?? "").toUpperCase()} to enable payment link copying.
                </span>
              )}
              <button onClick={() => markPaidMutation.mutate()} disabled={markPaidMutation.isPending}
                style={{ background: SURFACE, border: "1.5px solid #A7F3D0", color: "#065F46", fontWeight: 600, fontSize: "0.8rem", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer" }}>
                {markPaidMutation.isPending ? "Saving…" : "✓ Confirm payment received"}
              </button>
            </div>
          )}
          {stage === "payment_requested" && (
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <p style={{ fontSize: "0.78rem", color: "#C8622A", margin: 0 }}>Payment link sent — awaiting confirmation.</p>
              <button onClick={() => markPaidMutation.mutate()} disabled={markPaidMutation.isPending}
                style={{ background: "#065F46", border: "none", color: "#fff", fontWeight: 600, fontSize: "0.8rem", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer" }}>
                {markPaidMutation.isPending ? "Saving…" : "✓ Confirm payment received"}
              </button>
            </div>
          )}
        </WorkflowStage>

        {/* ── Stage 4: Activate ──────────────────────────────────────────────── */}
        <WorkflowStage
          number={4} label="Activate access"
          done={app.is_active}
          active={stage === "paid"}
          doneAt={app.activated_at}
        >
          {stage === "paid" && (
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <p style={{ fontSize: "0.78rem", color: MUTED, margin: 0, flex: 1 }}>
                Activating will enable directory + coordination access, start the 12-month term, set the renewal date, and create implementation session placeholders.
              </p>
              <button onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}
                style={{ background: TEAL, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.9375rem", padding: "0.6rem 1.5rem", borderRadius: "7px", cursor: "pointer", flexShrink: 0 }}>
                {activateMutation.isPending ? "Activating…" : "🚀 Activate organization"}
              </button>
            </div>
          )}
        </WorkflowStage>

        {/* ── Stage 5: Implementation sessions ──────────────────────────────── */}
        <WorkflowStage
          number={5} label="Implementation sessions"
          done={false}
          active={app.is_active}
        >
          {app.is_active && (
            <div>
              <p style={{ fontSize: "0.78rem", color: MUTED, margin: "0 0 0.5rem" }}>
                Schedule two 90-minute cohort onboarding sessions, one week apart.
                {BOOKING_LINK_IMPLEMENTATION && <> <a href={BOOKING_LINK_IMPLEMENTATION} target="_blank" rel="noreferrer" style={{ color: TEAL, fontWeight: 600, textDecoration: "none" }}>Open scheduling calendar ↗</a></>}
              </p>
              <ImplSessions orgId={app.id} />
            </div>
          )}
        </WorkflowStage>

        {/* Reset */}
        <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => revertMutation.mutate()} disabled={revertMutation.isPending}
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: MUTED, fontWeight: 500, fontSize: "0.75rem", padding: "0.35rem 0.875rem", borderRadius: "6px", cursor: "pointer" }}>
            Reset to submitted
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkflowStage({ number, label, done, active, doneAt, children }: {
  number: number; label: string; done: boolean; active: boolean; doneAt?: string | null; children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: done ? TEAL : active ? DARK : BORDER,
          color: done || active ? "#fff" : MUTED,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.75rem", fontWeight: 700,
        }}>
          {done ? "✓" : number}
        </div>
        <div style={{ flex: 1, width: 2, background: done ? TEAL : BORDER, margin: "4px 0 0" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: "0.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: children ? "0.625rem" : 0 }}>
          <p style={{ fontWeight: 700, fontSize: "0.875rem", color: done ? TEAL : active ? TEXT : MUTED, margin: 0 }}>{label}</p>
          {done && doneAt && <span style={{ fontSize: "0.68rem", color: MUTED }}>{fmt(doneAt)}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

function ImplSessions({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  interface ImplSession { id: string; session_number: number; scheduled_at: string | null; calendar_link: string | null; notes: string | null; completed_at: string | null }
  const { data: sessions = [] } = useQuery<ImplSession[]>({
    queryKey: ["impl-sessions", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("implementation_sessions").select("*").eq("org_id", orgId).order("session_number");
      return (data ?? []) as ImplSession[];
    },
    staleTime: 30_000,
  });

  async function saveSession(id: string, patch: Partial<ImplSession>) {
    await supabase.from("implementation_sessions").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["impl-sessions", orgId] });
  }

  if (sessions.length === 0) {
    return <p style={{ fontSize: "0.78rem", color: MUTED, margin: 0, fontStyle: "italic" }}>Session records will appear here after activation.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {sessions.map(s => (
        <SessionRow key={s.id} session={s} onSave={patch => saveSession(s.id, patch)} />
      ))}
    </div>
  );
}

function SessionRow({ session, onSave }: {
  session: { id: string; session_number: number; scheduled_at: string | null; calendar_link: string | null; notes: string | null; completed_at: string | null };
  onSave: (patch: Record<string, string | null>) => void;
}) {
  const [link, setLink] = useState(session.calendar_link ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave({ calendar_link: link || null, notes: notes || null });
    setSaving(false);
  }

  async function markDone() {
    await onSave({ completed_at: new Date().toISOString() });
  }

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "7px", padding: "0.875rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <p style={{ fontWeight: 700, fontSize: "0.8125rem", color: TEXT, margin: 0 }}>
          Session {session.session_number}
          {session.session_number === 2 && <span style={{ fontWeight: 400, color: MUTED }}> — one week after session 1</span>}
        </p>
        {session.completed_at ? (
          <span style={{ fontSize: "0.7rem", background: "#DCFCE7", color: "#166534", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
            Completed {fmt(session.completed_at)}
          </span>
        ) : (
          <button onClick={markDone} style={{ fontSize: "0.75rem", background: "none", border: `1px solid ${TEAL}`, color: TEAL, fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", cursor: "pointer" }}>
            Mark complete
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
        <input value={link} onChange={e => setLink(e.target.value)} placeholder="Calendar / booking link"
          style={{ padding: "0.4rem 0.625rem", border: `1px solid ${BORDER}`, borderRadius: "5px", fontSize: "0.78rem", color: TEXT, fontFamily: "inherit", outline: "none" }} />
        <button onClick={save} disabled={saving}
          style={{ background: DARK, color: "#fff", fontWeight: 600, fontSize: "0.75rem", padding: "0.4rem 0.75rem", border: "none", borderRadius: "5px", cursor: "pointer" }}>
          {saving ? "…" : "Save"}
        </button>
      </div>
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Session notes"
        style={{ width: "100%", boxSizing: "border-box", padding: "0.4rem 0.625rem", border: `1px solid ${BORDER}`, borderRadius: "5px", fontSize: "0.78rem", color: TEXT, fontFamily: "inherit", outline: "none" }} />
    </div>
  );
}

function Applications() {
  const qc = useQueryClient();
  const { data: apps = [], isLoading } = useApplications();
  const [filter, setFilter] = useState<"pending" | "rejected" | "all">("pending");
  const [expanded, setExpanded] = useState<string | null>(null);

  // pending = not yet active; rejected = verified+!active with no agreement/payment steps
  const filtered = apps.filter(a => {
    if (filter === "rejected") return a.is_verified && !a.is_active && !a.agreement_signed_at && !a.payment_requested_at;
    if (filter === "pending")  return !a.is_active;
    return !a.is_active;
  });

  const pendingCount  = apps.filter(a => !a.is_active).length;
  const rejectedCount = apps.filter(a => a.is_verified && !a.is_active && !a.agreement_signed_at && !a.payment_requested_at).length;

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
          <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>Staged workflow: verification → agreement → payment → activation.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button style={filterBtnStyle("pending")} onClick={() => setFilter("pending")}>In progress ({pendingCount})</button>
          <button style={filterBtnStyle("rejected")} onClick={() => setFilter("rejected")}>Rejected ({rejectedCount})</button>
          <button style={filterBtnStyle("all")} onClick={() => setFilter("all")}>All ({apps.length})</button>
        </div>
      </div>

      {isLoading && <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>{[1,2,3].map(i => <Skeleton key={i} h="64px" />)}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {!isLoading && filtered.map(app => {
          const primary = app.contacts.find(c => c.is_primary) ?? app.contacts[0];
          const tierColor = TIER_COLORS[app.membership_tier ?? ""] ?? MUTED;
          const stage = appStage(app);
          const stageInfo = STAGE_LABELS[stage] ?? STAGE_LABELS.submitted;

          return (
            <div key={app.id} style={{ background: SURFACE, border: `1px solid ${expanded === app.id ? TEAL : BORDER}`, borderLeft: `4px solid ${tierColor}`, borderRadius: "8px", overflow: "hidden", transition: "border-color 0.15s" }}>
              <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }} onClick={() => setExpanded(expanded === app.id ? null : app.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.2rem" }}>
                    <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.9375rem", margin: 0 }}>{app.name}</p>
                    <span style={{ background: `${stageInfo.color}18`, color: stageInfo.color, fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                      {stageInfo.label}
                    </span>
                  </div>
                  <p style={{ color: MUTED, fontSize: "0.8rem", margin: 0 }}>{app.org_type} · {app.county} County{primary ? ` · ${primary.full_name}` : ""}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {app.membership_tier && <span style={{ background: `${tierColor}18`, color: tierColor, fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "4px" }}>{TIER_LABELS[app.membership_tier] ?? app.membership_tier}</span>}
                  <p style={{ color: MUTED, fontSize: "0.72rem", margin: "0.25rem 0 0" }}>Submitted {fmt(app.created_at)}</p>
                </div>
                <span style={{ color: MUTED, fontSize: "0.75rem" }}>{expanded === app.id ? "▲" : "▼"}</span>
              </div>

              {expanded === app.id && <AppWorkflowPanel app={app} qc={qc} />}
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
                <LocationCount orgId={org.id} />
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

// ─── TSE Tasks ────────────────────────────────────────────────────────────────

interface LocationReview {
  review_id: string;
  location_id: string;
  location_name: string;
  org_id: string;
  org_name: string;
  review_type: string;
  priority: string;
  status: string;
  notes: string | null;
  target_completion: string | null;
  created_at: string;
  listing_status: string;
  tse_contact_attempts: number;
}

const REVIEW_TYPE_LABELS: Record<string, string> = {
  overdue_outreach:        "Overdue Outreach",
  pause_notice:            "Pause Notice",
  suspension_pending:      "Suspension Pending",
  poc_change_review:       "POC Change Review",
  contact_request_followup:"Contact Request Follow-up",
};

const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  urgent: { bg: "#FEE2E2", color: "#991B1B" },
  high:   { bg: "#FEF3C7", color: "#92400E" },
  normal: { bg: "#DBEAFE", color: "#1E40AF" },
};

function useLocationReviews() {
  return useQuery({
    queryKey: ["location_reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_location_reviews");
      if (error) throw error;
      return (data ?? []) as LocationReview[];
    },
    networkMode: "always",
    retry: false,
    refetchInterval: 30_000,
  });
}

function useRestorableLocations() {
  return useQuery({
    queryKey: ["restorable_locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, listing_status, org_id, organizations!inner(name)")
        .in("listing_status", ["paused", "suspended"])
        .eq("is_active", true);
      if (error) throw error;
      // Filter to those with no open reviews
      const { data: openReviews } = await supabase
        .from("location_reviews")
        .select("location_id")
        .eq("status", "open");
      const openIds = new Set((openReviews ?? []).map((r: { location_id: string }) => r.location_id));
      type LocRow = { id: string; name: string; listing_status: string; org_id: string; organizations: { name: string }[] };
      return ((data ?? []) as unknown as LocRow[])
        .filter(l => !openIds.has(l.id))
        .map(l => ({ id: l.id, name: l.name, listing_status: l.listing_status, org_id: l.org_id, org_name: l.organizations?.[0]?.name ?? "" }));
    },
    networkMode: "always",
    retry: false,
    refetchInterval: 30_000,
  });
}

function TseTasks() {
  const qc = useQueryClient();
  const { data: reviews = [], isLoading } = useLocationReviews();
  const { data: restorable = [] } = useRestorableLocations();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contactNotes, setContactNotes] = useState<Record<string, string>>({});
  const [suspendNotes, setSuspendNotes] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["location_reviews"] });
    qc.invalidateQueries({ queryKey: ["restorable_locations"] });
  }

  async function logContactAttempt(locationId: string, reviewId: string) {
    setResolvingId(reviewId);
    const { error } = await supabase.rpc("admin_log_contact_attempt", {
      p_location_id: locationId,
      p_notes: contactNotes[reviewId] || null,
    });
    setResolvingId(null);
    if (error) { setErr(e => ({ ...e, [reviewId]: error.message })); return; }
    setContactNotes(n => ({ ...n, [reviewId]: "" }));
    invalidate();
  }

  async function suspendLocation(locationId: string, reviewId: string) {
    setResolvingId(reviewId);
    const { error } = await supabase.rpc("admin_suspend_location", {
      p_location_id: locationId,
      p_notes: suspendNotes[reviewId] || null,
    });
    setResolvingId(null);
    if (error) { setErr(e => ({ ...e, [reviewId]: error.message })); return; }
    invalidate();
  }

  async function restoreLocation(locationId: string, reviewId: string) {
    setResolvingId(reviewId);
    const { error } = await supabase.rpc("admin_restore_location", { p_location_id: locationId });
    setResolvingId(null);
    if (error) { setErr(e => ({ ...e, [reviewId]: error.message })); return; }
    invalidate();
  }

  async function resolveReview(reviewId: string, notes?: string) {
    setResolvingId(reviewId);
    const { error } = await supabase.rpc("admin_resolve_review", {
      p_review_id: reviewId,
      p_notes: notes || null,
    });
    setResolvingId(null);
    if (error) { setErr(e => ({ ...e, [reviewId]: error.message })); return; }
    invalidate();
  }

  if (isLoading) return <p style={{ color: MUTED }}>Loading tasks…</p>;

  const totalOpen = reviews.length + restorable.length;

  if (totalOpen === 0) {
    return (
      <div>
        <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: TEXT, margin: "0 0 0.375rem" }}>TSE Tasks</h2>
        <p style={{ color: MUTED, fontSize: "0.9rem" }}>No open tasks. All location reviews are resolved.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: TEXT, margin: "0 0 0.375rem" }}>TSE Tasks</h2>
        <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>{reviews.length} open task{reviews.length !== 1 ? "s" : ""} requiring attention</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {reviews.map((r) => {
          const pColor = PRIORITY_COLORS[r.priority] ?? PRIORITY_COLORS.normal;
          const isExpanded = expandedId === r.review_id;
          const isOverdue = r.target_completion && new Date(r.target_completion) < new Date();
          const isSuspensionPending = r.review_type === "suspension_pending";
          const isPocChange = r.review_type === "poc_change_review";

          return (
            <div key={r.review_id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${pColor.color}`, borderRadius: "8px", overflow: "hidden" }}>
              <div
                onClick={() => setExpandedId(isExpanded ? null : r.review_id)}
                style={{ padding: "1rem 1.25rem", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "1rem", justifyContent: "space-between" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                    <span style={{ background: pColor.bg, color: pColor.color, fontSize: "0.65rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: "4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {r.priority.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: TEXT }}>
                      {REVIEW_TYPE_LABELS[r.review_type] ?? r.review_type}
                    </span>
                    {isOverdue && (
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#B91C1C", background: "#FEE2E2", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>OVERDUE</span>
                    )}
                  </div>
                  <p style={{ margin: "0 0 0.25rem", fontWeight: 600, fontSize: "0.9rem", color: TEXT }}>{r.org_name} — {r.location_name}</p>
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", color: MUTED }}>
                      Listing: <strong style={{ color: r.listing_status === "paused" ? "#D97706" : r.listing_status === "suspended" ? "#B91C1C" : r.listing_status === "overdue" ? "#C8622A" : TEAL }}>{r.listing_status}</strong>
                    </span>
                    {isSuspensionPending && (
                      <span style={{ fontSize: "0.75rem", color: MUTED }}>Contact attempts: <strong style={{ color: r.tse_contact_attempts >= 2 ? TEAL : "#D97706" }}>{r.tse_contact_attempts}/2</strong></span>
                    )}
                    {r.target_completion && (
                      <span style={{ fontSize: "0.75rem", color: MUTED }}>Due: {new Date(r.target_completion).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: "0.75rem", color: MUTED, flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
              </div>

              {isExpanded && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: "1.25rem" }}>
                  {r.notes && (
                    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8125rem", color: TEXT, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {r.notes}
                    </div>
                  )}

                  {err[r.review_id] && (
                    <p style={{ color: "#DC2626", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>{err[r.review_id]}</p>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {/* Log contact attempt */}
                    {(r.review_type === "overdue_outreach" || r.review_type === "suspension_pending") && (
                      <div style={{ display: "flex", gap: "0.625rem", alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: TEXT, marginBottom: "0.3rem" }}>Contact attempt notes (optional)</label>
                          <input
                            value={contactNotes[r.review_id] ?? ""}
                            onChange={e => setContactNotes(n => ({ ...n, [r.review_id]: e.target.value }))}
                            placeholder="Left voicemail, sent follow-up email…"
                            style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.8125rem", fontFamily: "inherit", color: TEXT }}
                          />
                        </div>
                        <button
                          onClick={() => logContactAttempt(r.location_id, r.review_id)}
                          disabled={resolvingId === r.review_id}
                          style={{ background: DARK, color: "#fff", border: "none", borderRadius: "6px", padding: "0.5rem 1rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          Log attempt #{(r.tse_contact_attempts ?? 0) + 1}
                        </button>
                      </div>
                    )}

                    {/* Suspend (requires ≥2 attempts) */}
                    {isSuspensionPending && r.tse_contact_attempts >= 2 && (
                      <div style={{ display: "flex", gap: "0.625rem", alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: TEXT, marginBottom: "0.3rem" }}>Suspension reason (optional)</label>
                          <input
                            value={suspendNotes[r.review_id] ?? ""}
                            onChange={e => setSuspendNotes(n => ({ ...n, [r.review_id]: e.target.value }))}
                            placeholder="Unresponsive after 2 attempts…"
                            style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.75rem", border: "1px solid #FECACA", borderRadius: "6px", fontSize: "0.8125rem", fontFamily: "inherit", color: TEXT }}
                          />
                        </div>
                        <button
                          onClick={() => suspendLocation(r.location_id, r.review_id)}
                          disabled={resolvingId === r.review_id}
                          style={{ background: "#B91C1C", color: "#fff", border: "none", borderRadius: "6px", padding: "0.5rem 1rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          Suspend listing
                        </button>
                      </div>
                    )}

                    {/* Restore (requires all reviews resolved) */}
                    {(r.listing_status === "paused" || r.listing_status === "suspended") && (
                      <button
                        onClick={() => restoreLocation(r.location_id, r.review_id)}
                        disabled={resolvingId === r.review_id}
                        style={{ background: TEAL, color: "#fff", border: "none", borderRadius: "6px", padding: "0.5rem 1.25rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}
                      >
                        Restore listing (resolve all reviews first)
                      </button>
                    )}

                    {/* POC change — resolve after manual review */}
                    {isPocChange && (
                      <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.8125rem", color: MUTED, flex: 1 }}>Review the POC change details above, then restore the listing or dismiss.</span>
                        <button
                          onClick={async () => {
                            await resolveReview(r.review_id, "POC change reviewed and approved by TSE.");
                            await restoreLocation(r.location_id, r.review_id);
                          }}
                          disabled={resolvingId === r.review_id}
                          style={{ background: TEAL, color: "#fff", border: "none", borderRadius: "6px", padding: "0.5rem 1rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          Approve &amp; restore
                        </button>
                      </div>
                    )}

                    {/* Generic resolve — available for overdue_outreach, pause_notice, contact_request_followup */}
                    {!isSuspensionPending && !isPocChange && (
                      <button
                        onClick={() => resolveReview(r.review_id)}
                        disabled={resolvingId === r.review_id}
                        style={{ background: SAGE, color: "#fff", border: "none", borderRadius: "6px", padding: "0.5rem 1.25rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}
                      >
                        {resolvingId === r.review_id ? "Saving…" : "Mark resolved"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {restorable.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: TEXT, margin: "0 0 0.75rem" }}>Ready to Restore</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {restorable.map(loc => (
              <div key={loc.id} style={{ border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: TEXT }}>{loc.org_name} — {loc.name}</span>
                  <div style={{ fontSize: "0.8125rem", color: MUTED, marginTop: "0.25rem" }}>
                    Listing: <strong style={{ color: loc.listing_status === "suspended" ? "#B91C1C" : "#D97706" }}>{loc.listing_status}</strong> · All reviews resolved
                  </div>
                  {err[loc.id] && <p style={{ color: "#B91C1C", fontSize: "0.8rem", margin: "0.25rem 0 0" }}>{err[loc.id]}</p>}
                </div>
                <button
                  onClick={async () => {
                    setResolvingId(loc.id);
                    const { error } = await supabase.rpc("admin_restore_location", { p_location_id: loc.id });
                    setResolvingId(null);
                    if (error) { setErr(e => ({ ...e, [loc.id]: error.message })); return; }
                    invalidate();
                  }}
                  disabled={resolvingId === loc.id}
                  style={{ background: TEAL, color: "#fff", border: "none", borderRadius: "6px", padding: "0.5rem 1.25rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {resolvingId === loc.id ? "Restoring…" : "Restore listing"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// ─── Billing ──────────────────────────────────────────────────────────────────

interface BillingLineItem {
  location_id: string;
  location_name: string;
  sequence: number;
  base_annual_cents: number;
  discount_pct: number;
  location_annual_cents: number;
  extra_staff_seats: number;
  staff_seat_annual_cents: number;
  line_total_cents: number;
}

interface BillingPayment {
  id: string;
  amount_cents: number;
  payment_method: string;
  reference: string | null;
  memo: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  created_at: string;
}

interface ServiceAllowance {
  id: string;
  location_id: string;
  allowance_type: string;
  membership_year: number;
  annual_amount: number;
  used_amount: number;
  remaining: number;
  year_start: string;
  year_end: string;
  expired_at: string | null;
  carry_over: number | null;
}

interface OrgBillingSummary {
  org: {
    id: string; name: string; tier: string | null;
    renewal_date: string | null; payment_status: string | null;
    is_founding_member: boolean; rate_protection_end_date: string | null;
    protected_tier_price_cents: number | null;
  };
  annual_total_cents: number;
  line_items: BillingLineItem[];
  payments: BillingPayment[];
  service_allowances: ServiceAllowance[];
  pending_change: { change_type: string; new_tier: string | null; change_notes: string | null } | null;
}

interface BillingOrg {
  id: string; name: string; tier: string | null; renewal_date: string | null;
  payment_status: string | null; is_founding_member: boolean;
  rate_protection_end_date: string | null;
}

function useBillingOrgs() {
  return useQuery({
    queryKey: ["billing-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, tier, renewal_date, payment_status, is_founding_member, rate_protection_end_date")
        .order("name");
      if (error) throw error;
      return (data ?? []) as BillingOrg[];
    },
  });
}

function useOrgBilling(orgId: string | null) {
  return useQuery({
    queryKey: ["org-billing", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.rpc("admin_get_org_billing", { p_org_id: orgId });
      if (error) throw error;
      return data as unknown as OrgBillingSummary;
    },
    enabled: !!orgId,
  });
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

interface AdminInvitation {
  invitation_id: string;
  org_id: string;
  org_name: string;
  location_id: string | null;
  location_name: string | null;
  invited_email: string;
  invited_name: string | null;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  invited_by_email: string | null;
  token: string;
}

function InvitationsAdmin() {
  const { data: invitations = [], isLoading, refetch } = useQuery<AdminInvitation[]>({
    queryKey: ["admin_invitations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_all_invitations");
      if (error) throw error;
      return (data as AdminInvitation[]) ?? [];
    },
  });

  const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const isExpired = (s: string) => new Date(s) < new Date();

  const statusColor = (inv: AdminInvitation) => {
    if (inv.status === "accepted") return { bg: "#DCFCE7", color: "#166534" };
    if (inv.status === "pending" && isExpired(inv.expires_at)) return { bg: "#FEE2E2", color: "#991B1B" };
    if (inv.status === "pending") return { bg: "#FEF9C3", color: "#854D0E" };
    return { bg: "#F3F4F6", color: "#374151" };
  };

  const statusLabel = (inv: AdminInvitation) => {
    if (inv.status === "accepted") return "Accepted";
    if (inv.status === "pending" && isExpired(inv.expires_at)) return "Expired";
    if (inv.status === "pending") return "Pending";
    return inv.status;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: TEXT, margin: "0 0 0.25rem" }}>Staff Invitations</h2>
          <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>{invitations.length} total · {invitations.filter(i => i.status === "pending" && !isExpired(i.expires_at)).length} pending</p>
        </div>
        <button onClick={() => refetch()} style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, fontSize: "0.8125rem", fontWeight: 600, padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer" }}>Refresh</button>
      </div>
      {isLoading && <p style={{ color: MUTED }}>Loading…</p>}
      {!isLoading && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", gap: "1rem", padding: "0.75rem 1.25rem", background: BG, borderBottom: `1px solid ${BORDER}` }}>
            {["Email", "Organization", "Role", "Status", "Expires"].map(h => (
              <p key={h} style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, margin: 0 }}>{h}</p>
            ))}
          </div>
          {invitations.length === 0 && (
            <p style={{ padding: "2rem 1.25rem", color: MUTED, textAlign: "center", margin: 0 }}>No invitations yet.</p>
          )}
          {invitations.map(inv => {
            const sc = statusColor(inv);
            return (
              <div key={inv.invitation_id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", gap: "1rem", padding: "0.9rem 1.25rem", alignItems: "center", borderBottom: `1px solid ${BORDER}` }}>
                <div>
                  <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: 0 }}>{inv.invited_email}</p>
                  {inv.invited_name && <p style={{ color: MUTED, fontSize: "0.75rem", margin: 0 }}>{inv.invited_name}</p>}
                </div>
                <div>
                  <p style={{ color: TEXT, fontSize: "0.8125rem", margin: 0 }}>{inv.org_name}</p>
                  {inv.location_name && <p style={{ color: MUTED, fontSize: "0.75rem", margin: 0 }}>{inv.location_name}</p>}
                </div>
                <p style={{ color: MUTED, fontSize: "0.8125rem", margin: 0 }}>{inv.role === "org_admin" ? "Org Admin" : "Staff"}</p>
                <span style={{ display: "inline-block", background: sc.bg, color: sc.color, fontSize: "0.68rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "4px", whiteSpace: "nowrap" }}>
                  {statusLabel(inv)}
                </span>
                <p style={{ color: MUTED, fontSize: "0.75rem", margin: 0 }}>{fmtDate(inv.expires_at)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BillingAdmin() {
  const qc = useQueryClient();
  const { data: orgs = [], isLoading } = useBillingOrgs();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { data: billing, isLoading: loadingBilling } = useOrgBilling(selectedOrgId);

  const [payAmt, setPayAmt]       = useState("");
  const [payMethod, setPayMethod] = useState("check");
  const [payRef, setPayRef]       = useState("");
  const [payMemo, setPayMemo]     = useState("");
  const [payError, setPayError]   = useState("");

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) return;
      const cents = Math.round(parseFloat(payAmt) * 100);
      if (isNaN(cents) || cents <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase.rpc("admin_record_payment", {
        p_org_id: selectedOrgId,
        p_amount_cents: cents,
        p_payment_method: payMethod,
        p_reference: payRef || null,
        p_memo: payMemo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-billing", selectedOrgId] });
      qc.invalidateQueries({ queryKey: ["billing-orgs"] });
      setPayAmt(""); setPayRef(""); setPayMemo(""); setPayError("");
    },
    onError: (e: Error) => setPayError(e.message),
  });

  const setFounderProtection = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase.rpc("admin_set_founder_protection", { p_org_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-billing", selectedOrgId] });
      qc.invalidateQueries({ queryKey: ["billing-orgs"] });
    },
  });

  const queueDowngrade = useMutation({
    mutationFn: async ({ orgId, tier }: { orgId: string; tier: string }) => {
      const { error } = await supabase.rpc("admin_queue_tier_downgrade", { p_org_id: orgId, p_new_tier: tier });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-billing", selectedOrgId] }),
  });

  return (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
      {/* Org list */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 1rem" }}>Billing</h1>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
          {isLoading && [1,2,3].map(i => <div key={i} style={{ padding: "0.75rem 1rem", borderBottom: `1px solid ${BORDER}` }}><Skeleton /></div>)}
          {orgs.map(org => {
            const active = org.id === selectedOrgId;
            const hasRenewal = !!org.renewal_date;
            const overdue = hasRenewal && new Date(org.renewal_date!) < new Date();
            return (
              <button
                key={org.id}
                onClick={() => setSelectedOrgId(org.id)}
                style={{ width: "100%", textAlign: "left", padding: "0.75rem 1rem", borderBottom: `1px solid ${BORDER}`, background: active ? `${TEAL}15` : SURFACE, border: "none", borderLeft: active ? `3px solid ${TEAL}` : "3px solid transparent", cursor: "pointer" }}
              >
                <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.8125rem", margin: "0 0 0.15rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{org.name}</p>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {org.tier && <span style={{ fontSize: "0.68rem", color: TIER_COLORS[org.tier] ?? MUTED, fontWeight: 600 }}>{TIER_LABELS[org.tier] ?? org.tier}</span>}
                  {org.is_founding_member && <span style={{ fontSize: "0.65rem", background: "#FEF3C7", color: "#92400E", fontWeight: 700, padding: "0 0.3rem", borderRadius: "3px" }}>Founder</span>}
                  {overdue && <span style={{ fontSize: "0.65rem", background: "#FEE2E2", color: "#991B1B", fontWeight: 700, padding: "0 0.3rem", borderRadius: "3px" }}>Overdue</span>}
                </div>
              </button>
            );
          })}
          {!isLoading && orgs.length === 0 && <p style={{ color: MUTED, fontSize: "0.875rem", padding: "1rem" }}>No organizations.</p>}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedOrgId && (
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "3rem", textAlign: "center", color: MUTED }}>
            Select an organization to view billing details.
          </div>
        )}

        {selectedOrgId && loadingBilling && <Skeleton h="400px" />}

        {selectedOrgId && billing && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Header */}
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: TEXT, margin: "0 0 0.3rem" }}>{billing.org.name}</h2>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    {billing.org.tier && (
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: TIER_COLORS[billing.org.tier] ?? MUTED }}>
                        {TIER_LABELS[billing.org.tier] ?? billing.org.tier}
                      </span>
                    )}
                    {billing.org.is_founding_member && (
                      <span style={{ fontSize: "0.68rem", background: "#FEF3C7", color: "#92400E", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "3px" }}>
                        Founder · protected until {billing.org.rate_protection_end_date}
                      </span>
                    )}
                    {billing.pending_change && (
                      <span style={{ fontSize: "0.68rem", background: "#FEE2E2", color: "#991B1B", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "3px" }}>
                        Pending: {billing.pending_change.change_type} → {billing.pending_change.new_tier}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: 0 }}>{formatCents(billing.annual_total_cents)}/yr</p>
                  <p style={{ fontSize: "0.78rem", color: MUTED, margin: "0.1rem 0 0" }}>
                    Renewal: {billing.org.renewal_date ?? "not set"} · {billing.org.payment_status}
                  </p>
                </div>
              </div>

              {!billing.org.is_founding_member && billing.org.tier && (
                <button
                  onClick={() => setFounderProtection.mutate(billing.org.id)}
                  disabled={setFounderProtection.isPending}
                  style={{ marginTop: "0.75rem", fontSize: "0.78rem", background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", borderRadius: "5px", padding: "0.35rem 0.9rem", cursor: "pointer", fontWeight: 600 }}
                >
                  {setFounderProtection.isPending ? "Setting…" : "Set 2-year founder protection"}
                </button>
              )}

              {billing.org.tier && billing.org.tier !== "collaborator" && (
                <button
                  onClick={() => queueDowngrade.mutate({ orgId: billing.org.id, tier: "collaborator" })}
                  disabled={queueDowngrade.isPending || !!billing.pending_change}
                  style={{ marginTop: "0.75rem", marginLeft: "0.5rem", fontSize: "0.78rem", background: BG, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: "5px", padding: "0.35rem 0.9rem", cursor: "pointer" }}
                >
                  Queue downgrade to Collaborator
                </button>
              )}
            </div>

            {/* Line items */}
            {billing.line_items.length > 0 && (
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${BORDER}`, background: BG }}>
                  <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.8125rem", margin: 0 }}>Annual Invoice Breakdown</p>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ background: BG }}>
                      {["Location", "Seq", "Base/yr", "Disc", "Loc Price", "Extra Seats", "Line Total"].map(h => (
                        <th key={h} style={{ textAlign: h === "Location" ? "left" : "right", padding: "0.5rem 0.75rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {billing.line_items.map(li => (
                      <tr key={li.location_id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: "0.6rem 0.75rem", color: TEXT, fontWeight: 500 }}>{li.location_name}</td>
                        <td style={{ padding: "0.6rem 0.75rem", color: MUTED, textAlign: "right" }}>{li.sequence}</td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{formatCents(li.base_annual_cents)}</td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: li.discount_pct > 0 ? "#166534" : MUTED }}>{li.discount_pct > 0 ? `-${li.discount_pct}%` : "—"}</td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{formatCents(li.location_annual_cents)}</td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: MUTED }}>{li.extra_staff_seats > 0 ? `${li.extra_staff_seats} × ${formatCents(li.staff_seat_annual_cents)}` : "—"}</td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontWeight: 700, color: TEXT }}>{formatCents(li.line_total_cents)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: BG }}>
                      <td colSpan={6} style={{ padding: "0.6rem 0.75rem", fontWeight: 700, color: TEXT, textAlign: "right" }}>Total</td>
                      <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontWeight: 700, color: TEXT }}>{formatCents(billing.annual_total_cents)}</td>
                    </tr>
                  </tbody>
                </table>

                {billing.org.is_founding_member && billing.org.rate_protection_end_date && new Date(billing.org.rate_protection_end_date) > new Date() && (
                  <p style={{ fontSize: "0.73rem", color: "#92400E", background: "#FFFBEB", padding: "0.5rem 1.25rem", margin: 0 }}>
                    ★ Founder rate lock in effect until {billing.org.rate_protection_end_date}. Prices show locked rates, not current list prices.
                  </p>
                )}
              </div>
            )}

            {/* Service allowances */}
            {billing.service_allowances.length > 0 && (
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${BORDER}`, background: BG }}>
                  <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.8125rem", margin: 0 }}>Service Allowances</p>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr>
                      {["Location", "Year", "Type", "Annual", "Used", "Remaining", "Period", "Status"].map(h => (
                        <th key={h} style={{ textAlign: h === "Location" ? "left" : "right", padding: "0.5rem 0.75rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, borderBottom: `1px solid ${BORDER}`, background: BG }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {billing.service_allowances.map(sa => {
                      const loc = billing.line_items.find(l => l.location_id === sa.location_id);
                      return (
                        <tr key={sa.id} style={{ borderBottom: `1px solid ${BORDER}`, opacity: sa.expired_at ? 0.55 : 1 }}>
                          <td style={{ padding: "0.5rem 0.75rem", color: TEXT, fontSize: "0.75rem" }}>{loc?.location_name ?? sa.location_id.slice(0, 8)}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: MUTED }}>{sa.membership_year}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: MUTED }}>{sa.allowance_type}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>{sa.annual_amount}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>{sa.used_amount}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 700, color: Number(sa.remaining) < 2 ? "#991B1B" : "#166534" }}>{sa.remaining}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: "0.72rem", color: MUTED }}>{sa.year_start} – {sa.year_end}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                            {sa.expired_at ? <span style={{ fontSize: "0.68rem", color: MUTED, background: "#F3F4F6", padding: "0.1rem 0.3rem", borderRadius: "3px" }}>Expired</span>
                              : sa.carry_over ? <span style={{ fontSize: "0.68rem", color: "#166534" }}>Carry-over: {sa.carry_over}</span>
                              : <span style={{ fontSize: "0.68rem", color: "#166534", background: "#DCFCE7", padding: "0.1rem 0.3rem", borderRadius: "3px" }}>Active</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Record payment */}
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "1.25rem 1.5rem" }}>
              <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.875rem" }}>Record Payment</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem", alignItems: "flex-end" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Amount (USD)</label>
                  <input value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="2400.00"
                    style={{ width: "100%", padding: "0.5rem 0.6rem", border: `1px solid ${BORDER}`, borderRadius: "5px", fontSize: "0.875rem", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Method</label>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.6rem", border: `1px solid ${BORDER}`, borderRadius: "5px", fontSize: "0.875rem" }}>
                    <option value="check">Check</option>
                    <option value="ach">ACH</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Reference #</label>
                  <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Check #1234"
                    style={{ width: "100%", padding: "0.5rem 0.6rem", border: `1px solid ${BORDER}`, borderRadius: "5px", fontSize: "0.875rem", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Memo</label>
                  <input value={payMemo} onChange={e => setPayMemo(e.target.value)} placeholder="FY2027 membership"
                    style={{ width: "100%", padding: "0.5rem 0.6rem", border: `1px solid ${BORDER}`, borderRadius: "5px", fontSize: "0.875rem", boxSizing: "border-box" }} />
                </div>
              </div>
              {payError && <p style={{ color: "#991B1B", fontSize: "0.78rem", marginTop: "0.5rem" }}>{payError}</p>}
              <button
                onClick={() => recordPayment.mutate()}
                disabled={recordPayment.isPending || !payAmt}
                style={{ marginTop: "0.75rem", background: TEAL, border: "none", color: "#fff", fontWeight: 700, fontSize: "0.875rem", padding: "0.6rem 1.5rem", borderRadius: "7px", cursor: "pointer", opacity: !payAmt ? 0.5 : 1 }}
              >
                {recordPayment.isPending ? "Recording…" : "Record payment"}
              </button>
            </div>

            {/* Payment history */}
            {billing.payments.length > 0 && (
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${BORDER}`, background: BG }}>
                  <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.8125rem", margin: 0 }}>Payment History</p>
                </div>
                {billing.payments.map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1.25rem", borderBottom: `1px solid ${BORDER}`, fontSize: "0.8125rem" }}>
                    <div>
                      <span style={{ fontWeight: 600, color: TEXT }}>{formatCents(p.amount_cents)}</span>
                      <span style={{ color: MUTED, marginLeft: "0.5rem" }}>{p.payment_method}</span>
                      {p.reference && <span style={{ color: MUTED, marginLeft: "0.5rem" }}>· {p.reference}</span>}
                      {p.memo && <span style={{ color: MUTED, marginLeft: "0.5rem" }}>— {p.memo}</span>}
                    </div>
                    <span style={{ color: MUTED, fontSize: "0.75rem" }}>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [view, setView] = useState<View>("overview");
  const { signOut } = useAuth();

  const { data: apps = [] }     = useApplications();
  const { data: reqs = [] }     = useConnectionRequests();
  const { data: claims = [] }   = usePendingClaims();
  const { data: reviews = [] }  = useLocationReviews();

  const pendingApps    = apps.filter(a => !a.is_verified && !a.is_active).length;
  const pendingReqs    = reqs.filter(r => r.status === "pending").length;
  const pendingClaims  = claims.length;
  const pendingTasks   = reviews.length;

  const content = {
    overview:      <Overview setView={setView} />,
    applications:  <Applications />,
    claims:        <ClaimQueue />,
    requests:      <ConnectionRequests />,
    organizations: <Organizations />,
    tse_tasks:     <TseTasks />,
    billing:       <BillingAdmin />,
    invitations:   <InvitationsAdmin />,
    crm:           <CRMView />,
    knowledge:     <KnowledgeLibrary />,
    announcements: <AnnouncementsAdmin />,
  }[view];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: BG }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
      <Sidebar view={view} setView={setView} onSignOut={signOut} pendingApps={pendingApps} pendingReqs={pendingReqs} pendingClaims={pendingClaims} pendingTasks={pendingTasks} />
      <main style={{ flex: 1, padding: "2.5rem", overflowY: "auto", minWidth: 0 }}>
        {content}
      </main>
    </div>
  );
}
