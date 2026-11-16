import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useMyRequests } from "@/hooks/useMyRequests";
import { useSavedResources } from "@/hooks/useSavedResources";
import { useAnnouncements } from "@/hooks/useAnnouncements";
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

const ORG_TYPE_COLORS: Record<string, string> = {
  nonprofit:   "#2A9D8F",
  faith_based: "#7B68C8",
  school:      "#E07A3A",
  medical:     "#3A8FE0",
  housing:     "#4A7C6F",
  government:  "#5C7380",
  other:       "#5C7380",
};

interface ListingLocation {
  id: string;
  name: string;
  location_type: string | null;
  county: string | null;
  listing_status: string;
  org: { name: string; org_type: string | null; description: string | null } | null;
  services: { name: string; category: string }[];
  contacts: { full_name: string; title: string | null; email: string | null; phone: string | null; is_primary: boolean }[];
}

function ListingVerifyModal({ locationId, onClose }: { locationId: string; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [err, setErr] = useState("");

  const { data: loc, isLoading } = useQuery<ListingLocation | null>({
    queryKey: ["listing_verify_location", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select(`id, name, location_type, county, listing_status,
          org:organizations(name, org_type, description),
          services(name, category),
          contacts(full_name, title, email, phone, is_primary)`)
        .eq("id", locationId)
        .maybeSingle();
      if (error) throw error;
      return data as ListingLocation | null;
    },
    networkMode: "always",
    retry: false,
  });

  async function handleConfirm() {
    setConfirming(true);
    setErr("");
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("locations")
      .update({
        last_confirmed_at: new Date().toISOString(),
        last_confirmed_by: session?.user?.id ?? null,
        listing_status: "active",
        paused_at: null,
        paused_reason: null,
        suspended_at: null,
      })
      .eq("id", locationId);
    setConfirming(false);
    if (error) { setErr("Something went wrong. Please try again or reply to your Lattice email."); return; }
    setConfirmed(true);
    setTimeout(onClose, 1800);
  }

  const primary = loc?.contacts?.find(c => c.is_primary) ?? loc?.contacts?.[0];
  const orgType  = (loc?.org as any)?.org_type ?? "other";
  const typeColor = ORG_TYPE_COLORS[orgType] ?? "#5C7380";
  const typeLabel = ORG_TYPE_LABELS[orgType] ?? "Organization";
  const services  = loc?.services?.slice(0, 4) ?? [];
  const extraSvcs = (loc?.services?.length ?? 0) - 4;
  const orgName   = (loc?.org as any)?.name ?? "";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: "480px", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{ background: DARK, padding: "1.5rem 1.75rem 1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: TEAL, margin: "0 0 0.3rem" }}>Monthly Verification</p>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.3 }}>Is your listing still accurate?</h2>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "1.25rem", cursor: "pointer", lineHeight: 1, marginLeft: "1rem", flexShrink: 0 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem 1.75rem" }}>
          {isLoading && <p style={{ color: MUTED, textAlign: "center", fontSize: "0.875rem" }}>Loading…</p>}

          {!isLoading && loc && (
            <>
              {/* Resource card preview */}
              <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 0.75rem" }}>Your current listing</p>
              <div style={{ border: `1px solid ${BORDER}`, borderTop: `3px solid ${typeColor}`, borderRadius: "8px", overflow: "hidden", marginBottom: "1.25rem" }}>
                <div style={{ padding: "14px 16px" }}>
                  <p style={{ fontWeight: 700, fontSize: "0.9375rem", color: TEXT, margin: "0 0 3px" }}>{orgName}</p>
                  {loc.name !== orgName && <p style={{ fontSize: "0.78rem", color: MUTED, margin: "0 0 5px" }}>{loc.name}</p>}
                  <span style={{ display: "inline-block", background: `${typeColor}18`, color: typeColor, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: "3px" }}>{typeLabel}</span>
                  {loc.county && <p style={{ fontSize: "0.75rem", color: MUTED, margin: "5px 0 0", fontWeight: 500 }}>{loc.county} County</p>}
                  {(loc.org as any)?.description && (
                    <p style={{ fontSize: "0.78rem", color: TEXT, lineHeight: 1.55, margin: "7px 0 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {(loc.org as any).description}
                    </p>
                  )}
                  {services.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      {services.map(s => (
                        <span key={s.name || s.category} style={{ display: "inline-block", background: BG, border: `1px solid ${BORDER}`, color: MUTED, fontSize: "0.7rem", fontWeight: 500, padding: "2px 7px", borderRadius: "4px", margin: "2px 3px 2px 0" }}>
                          {s.name || s.category}
                        </span>
                      ))}
                      {extraSvcs > 0 && (
                        <span style={{ display: "inline-block", background: BG, border: `1px solid ${BORDER}`, color: MUTED, fontSize: "0.7rem", padding: "2px 7px", borderRadius: "4px", margin: "2px 0" }}>+{extraSvcs} more</span>
                      )}
                    </div>
                  )}
                </div>
                {primary && (
                  <>
                    <div style={{ height: 1, background: BORDER, margin: "0 16px" }} />
                    <div style={{ padding: "10px 16px" }}>
                      <p style={{ fontWeight: 700, fontSize: "0.8125rem", color: TEXT, margin: 0 }}>{primary.full_name}</p>
                      {primary.title && <p style={{ fontSize: "0.72rem", color: MUTED, margin: "1px 0 0" }}>{primary.title}</p>}
                      {primary.phone && <p style={{ fontWeight: 700, fontSize: "0.8125rem", color: DARK, margin: "3px 0 0" }}>{primary.phone}</p>}
                    </div>
                  </>
                )}
              </div>

              {confirmed ? (
                <div style={{ textAlign: "center", padding: "0.75rem 0" }}>
                  <p style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>✅</p>
                  <p style={{ fontWeight: 700, color: SAGE, margin: 0 }}>Listing confirmed — thank you!</p>
                </div>
              ) : (
                <>
                  {err && <p style={{ fontSize: "0.8125rem", color: "#DC2626", margin: "0 0 1rem" }}>{err}</p>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <button
                      onClick={handleConfirm}
                      disabled={confirming}
                      style={{ background: TEAL, color: "#fff", border: "none", borderRadius: "8px", padding: "0.75rem", fontSize: "0.875rem", fontWeight: 700, cursor: confirming ? "default" : "pointer", fontFamily: "inherit" }}
                    >
                      {confirming ? "Confirming…" : "✓  Yes, this is correct"}
                    </button>
                    <button
                      onClick={onClose}
                      style={{ background: "#fff", color: DARK, border: `1.5px solid ${BORDER}`, borderRadius: "8px", padding: "0.75rem", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      ✏️  Update something
                    </button>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: MUTED, textAlign: "center", margin: "0.75rem 0 0" }}>
                    Confirming keeps this listing active. To update details, close and visit your dashboard or reply to your Lattice email.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface StaffMember {
  member_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  joined_at: string | null;
  orientation_done: boolean;
  roe_done: boolean;
  can_use_tools: boolean;
}

interface SeatCapacity {
  seats_included: number;
  extra_seats: number;
  total_seats: number;
  seats_used: number;
  seats_available: number;
}

function StaffPanel({ orgId, locationId }: { orgId: string; locationId?: string | null }) {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"staff" | "org_admin">("staff");
  const [inviteResult, setInviteResult] = useState<{ token: string; link: string } | null>(null);
  const [inviteErr, setInviteErr] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeErr, setRemoveErr] = useState("");

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("org_get_staff", { p_org_id: orgId });
      if (error) throw error;
      return (data as StaffMember[]) ?? [];
    },
  });

  const { data: capacity } = useQuery<SeatCapacity | null>({
    queryKey: ["seat_capacity", locationId],
    queryFn: async () => {
      if (!locationId) return null;
      const { data, error } = await supabase.rpc("get_seat_capacity", { p_location_id: locationId });
      if (error) throw error;
      return (data as SeatCapacity[] | null)?.[0] ?? null;
    },
    enabled: !!locationId,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("org_invite_staff", {
        p_org_id: orgId,
        p_location_id: locationId ?? null,
        p_email: inviteEmail,
        p_role: inviteRole,
        p_full_name: inviteName || null,
      });
      if (error) throw error;
      const token = data as string;
      return { token, link: `${window.location.origin}/invite/${token}` };
    },
    onSuccess: (result) => {
      setInviteResult(result);
      setInviteErr("");
      qc.invalidateQueries({ queryKey: ["staff", orgId] });
    },
    onError: (e: Error) => setInviteErr(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ memberId, reason }: { memberId: string; reason: string }) => {
      const { error } = await supabase.rpc("org_remove_staff", {
        p_member_id: memberId,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRemoveTarget(null);
      setRemoveReason("");
      setRemoveErr("");
      qc.invalidateQueries({ queryKey: ["staff", orgId] });
    },
    onError: (e: Error) => setRemoveErr(e.message),
  });

  const active = staff.filter(s => s.status === "active");
  const removed = staff.filter(s => s.status === "removed");

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${DARK}`, borderRadius: "10px", padding: "1.25rem 1.5rem", marginBottom: "2.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 0.2rem" }}>Staff Accounts</p>
          {capacity && (
            <p style={{ fontSize: "0.78rem", color: MUTED, margin: 0 }}>
              {capacity.seats_used} / {capacity.total_seats} seats used
              {capacity.seats_available <= 0 && <span style={{ color: "#991B1B", fontWeight: 700 }}> · No seats available</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => { setInviteOpen(true); setInviteResult(null); setInviteErr(""); setInviteEmail(""); setInviteName(""); }}
          disabled={capacity ? capacity.seats_available <= 0 : false}
          style={{ background: DARK, border: "none", color: "#fff", fontWeight: 600, fontSize: "0.8125rem", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", opacity: capacity && capacity.seats_available <= 0 ? 0.5 : 1 }}
        >
          + Invite Staff
        </button>
      </div>

      {/* Seat meter */}
      {capacity && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ height: 6, borderRadius: 3, background: BORDER, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (capacity.seats_used / capacity.total_seats) * 100)}%`, background: capacity.seats_available <= 0 ? "#DC2626" : TEAL, borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <p style={{ fontSize: "0.72rem", color: MUTED, margin: "0.3rem 0 0" }}>
            {capacity.seats_included} included + {capacity.extra_seats} purchased
          </p>
        </div>
      )}

      {isLoading && <p style={{ color: MUTED, fontSize: "0.875rem" }}>Loading staff…</p>}

      {!isLoading && active.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {active.map(m => (
            <div key={m.member_id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.75rem", background: BG, borderRadius: "6px", border: `1px solid ${BORDER}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: 0 }}>{m.full_name ?? m.email}</p>
                <p style={{ color: MUTED, fontSize: "0.75rem", margin: 0 }}>{m.email} · {m.role}</p>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                {!m.orientation_done && <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "4px" }}>Orientation pending</span>}
                {m.orientation_done && !m.roe_done && <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "4px" }}>ROE pending</span>}
                {m.can_use_tools && <span style={{ background: "#DCFCE7", color: "#166534", fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "4px" }}>Active</span>}
                <button
                  onClick={() => { setRemoveTarget({ id: m.member_id, name: m.full_name ?? m.email }); setRemoveErr(""); setRemoveReason(""); }}
                  style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", cursor: "pointer" }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && active.length === 0 && (
        <p style={{ color: MUTED, fontSize: "0.875rem", textAlign: "center", padding: "1rem 0" }}>No active staff yet. Invite your first team member.</p>
      )}

      {removed.length > 0 && (
        <details style={{ marginTop: "0.75rem" }}>
          <summary style={{ color: MUTED, fontSize: "0.78rem", cursor: "pointer" }}>Removed staff ({removed.length})</summary>
          <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {removed.map(m => (
              <div key={m.member_id} style={{ display: "flex", gap: "0.5rem", padding: "0.4rem 0.75rem", background: BG, borderRadius: "5px", fontSize: "0.78rem", color: MUTED, border: `1px solid ${BORDER}` }}>
                <span style={{ flex: 1 }}>{m.full_name ?? m.email}</span>
                <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: "0.68rem", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "3px" }}>Removed</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setInviteOpen(false)}>
          <div style={{ background: SURFACE, borderRadius: "12px", padding: "2rem", width: "100%", maxWidth: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: TEXT }}>Invite Staff Member</h3>
              <button onClick={() => setInviteOpen(false)} style={{ background: "none", border: "none", fontSize: "1.25rem", color: MUTED, cursor: "pointer" }}>✕</button>
            </div>
            {inviteResult ? (
              <div>
                <p style={{ color: SAGE, fontWeight: 600, marginBottom: "0.75rem" }}>✓ Invitation created</p>
                <p style={{ fontSize: "0.78rem", color: MUTED, marginBottom: "0.4rem" }}>Share this link with the new staff member:</p>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "0.6rem 0.75rem", fontSize: "0.8rem", fontFamily: "monospace", wordBreak: "break-all", marginBottom: "0.75rem" }}>
                  {inviteResult.link}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteResult.link).catch(() => {}); }}
                  style={{ width: "100%", background: TEAL, border: "none", color: "#fff", fontWeight: 600, padding: "0.65rem", borderRadius: "6px", cursor: "pointer", marginBottom: "0.5rem" }}
                >
                  Copy Link
                </button>
                <p style={{ fontSize: "0.72rem", color: MUTED, textAlign: "center", margin: 0 }}>Link expires in 7 days</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: TEXT, display: "block", marginBottom: "0.25rem" }}>Email *</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    style={{ width: "100%", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: TEXT, display: "block", marginBottom: "0.25rem" }}>Full Name (optional)</label>
                  <input value={inviteName} onChange={e => setInviteName(e.target.value)}
                    style={{ width: "100%", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: TEXT, display: "block", marginBottom: "0.25rem" }}>Role</label>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value as "staff" | "org_admin")}
                    style={{ width: "100%", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", background: SURFACE, boxSizing: "border-box" }}>
                    <option value="staff">Staff</option>
                    <option value="org_admin">Organization Admin</option>
                  </select>
                </div>
                {inviteErr && <p style={{ color: "#991B1B", fontSize: "0.78rem", margin: 0 }}>{inviteErr}</p>}
                <button
                  onClick={() => inviteMutation.mutate()}
                  disabled={inviteMutation.isPending || !inviteEmail}
                  style={{ background: DARK, border: "none", color: "#fff", fontWeight: 700, padding: "0.75rem", borderRadius: "8px", cursor: "pointer", opacity: !inviteEmail ? 0.5 : 1 }}
                >
                  {inviteMutation.isPending ? "Creating invitation…" : "Create Invitation Link"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remove confirmation modal */}
      {removeTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setRemoveTarget(null)}>
          <div style={{ background: SURFACE, borderRadius: "12px", padding: "2rem", width: "100%", maxWidth: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700, color: TEXT }}>Remove Staff Member</h3>
            <p style={{ color: MUTED, fontSize: "0.875rem", marginBottom: "1rem" }}>
              Remove <strong>{removeTarget.name}</strong> from your organization? Their historical activity will be preserved.
            </p>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: TEXT, display: "block", marginBottom: "0.25rem" }}>Reason (optional)</label>
            <input value={removeReason} onChange={e => setRemoveReason(e.target.value)}
              placeholder="e.g. No longer with organization"
              style={{ width: "100%", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.9rem", marginBottom: "1rem", boxSizing: "border-box" }} />
            {removeErr && <p style={{ color: "#991B1B", fontSize: "0.78rem", marginBottom: "0.5rem" }}>{removeErr}</p>}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setRemoveTarget(null)} style={{ flex: 1, background: SURFACE, border: `1.5px solid ${BORDER}`, color: TEXT, fontWeight: 600, padding: "0.65rem", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
              <button
                onClick={() => removeMutation.mutate({ memberId: removeTarget.id, reason: removeReason })}
                disabled={removeMutation.isPending}
                style={{ flex: 1, background: "#DC2626", border: "none", color: "#fff", fontWeight: 700, padding: "0.65rem", borderRadius: "8px", cursor: "pointer" }}
              >
                {removeMutation.isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, role, signOut } = useAuth();
  const { data: requests = [], isLoading } = useMyRequests();
  const requestsRef = useRef<HTMLDivElement>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [verifyLocationId, setVerifyLocationId] = useState<string | null>(null);

  // Handle ?verify=listing&location=<id> from listing-check email links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verify") === "listing") {
      const locId = params.get("location");
      if (locId) {
        setVerifyLocationId(locId);
        // Clean the URL without triggering a navigation
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
      }
    }
  }, []);

  const { data: announcements = [] } = useAnnouncements();
  const { data: savedIds = [], isLoading: savedLoading } = useSavedResources(user?.id);
  const { data: savedOrgs = [], isLoading: savedOrgsLoading } = useQuery({
    queryKey: ["saved_orgs", savedIds],
    queryFn: async () => {
      if (savedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug, org_type, county, description")
        .in("id", savedIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: savedIds.length > 0,
    networkMode: "always",
    retry: false,
  });

  const { data: myOrg } = useQuery({
    queryKey: ["my_org", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("organizations")
        .select("id,name,org_type,county,membership_tier,is_active,is_verified")
        .eq("user_id", user.id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user,
    networkMode: "always",
    retry: false,
  });

  // Membership row for invited staff (org_admin or staff role via invitation)
  const { data: myMembership } = useQuery({
    queryKey: ["my_membership", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("org_members")
        .select("id,org_id,location_id,role,invitation_id,joined_at,status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user && !myOrg, // only needed when user is not an org owner
    networkMode: "always",
    retry: false,
  });

  // If user is an invited org_admin, also load their org info
  const { data: staffOrg } = useQuery({
    queryKey: ["staff_org", myMembership?.org_id],
    queryFn: async () => {
      if (!myMembership?.org_id) return null;
      const { data } = await supabase
        .from("organizations")
        .select("id,name,org_type,county,membership_tier")
        .eq("id", myMembership.org_id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!myMembership?.org_id,
    networkMode: "always",
    retry: false,
  });

  // Gate status for invited staff
  const { data: staffGate } = useQuery({
    queryKey: ["staff_gate", myMembership?.org_id],
    queryFn: async () => {
      if (!myMembership?.org_id) return null;
      const { data, error } = await supabase.rpc("check_staff_gate", { p_org_id: myMembership.org_id });
      if (error) return null;
      return data as { is_member: boolean; orientation_done: boolean; roe_done: boolean; can_use_tools: boolean; is_owner: boolean } | null;
    },
    enabled: !!myMembership?.org_id,
    networkMode: "always",
    retry: false,
  });

  const { data: myLocations } = useQuery({
    queryKey: ["my_locations", myOrg?.id],
    queryFn: async () => {
      if (!myOrg) return [];
      const { data } = await supabase
        .from("locations")
        .select("id,name,location_type,county,city,is_active,is_verified")
        .eq("org_id", myOrg.id)
        .order("created_at");
      return data ?? [];
    },
    enabled: !!myOrg,
    networkMode: "always",
    retry: false,
  });

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

  const workspaceCards = [
    {
      label: "Partner Directory",
      description: "Search and filter organizations across Georgia's community support network.",
      href: "/directory",
      accentColor: TEAL,
    },
    {
      label: "My Resources",
      description: "View saved organizations, build collections, and organize your resource library.",
      href: "/resources",
      accentColor: SAGE,
    },
    {
      label: "Tools & Knowledge",
      description: "Templates, guides, and resources to support your coordination work.",
      href: "/knowledge",
      accentColor: DARK,
    },
    {
      label: "My Network",
      description: "Your organization profile, connections, and coordination activity.",
      href: "/network",
      accentColor: "#7C6A9A",
    },
    {
      label: "My Requests",
      description: "Track connection requests you've submitted through TSE.",
      href: "#requests",
      onClick: () => requestsRef.current?.scrollIntoView({ behavior: "smooth" }),
      accentColor: TEAL,
    },
    {
      label: "Account Settings",
      description: "Update your display name and account preferences.",
      href: "#",
      onClick: () => setShowProfile(true),
      accentColor: MUTED,
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

        {/* Gate banner for invited staff with incomplete orientation/ROE */}
        {myMembership?.invitation_id && staffGate && !staffGate.can_use_tools && (
          <div style={{ backgroundColor: "#FFFBEB", border: `1px solid #FDE68A`, borderLeft: `4px solid #F59E0B`, borderRadius: "10px", padding: "1.25rem 1.5rem", marginBottom: "2.5rem" }}>
            <p style={{ fontWeight: 700, color: "#92400E", margin: "0 0 0.5rem", fontSize: "0.9375rem" }}>Complete your onboarding to access coordination tools</p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.875rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: staffGate.orientation_done ? "#166534" : "#92400E" }}>
                {staffGate.orientation_done ? "✓" : "○"} Orientation
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: staffGate.roe_done ? "#166534" : "#92400E" }}>
                {staffGate.roe_done ? "✓" : "○"} Rules of Engagement
              </span>
            </div>
            <p style={{ color: "#92400E", margin: "0.5rem 0 0", fontSize: "0.8125rem" }}>
              Your invitation link includes orientation and ROE steps. Once complete, you'll have full access.
            </p>
          </div>
        )}

        {/* Status banner */}
        <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${TEAL}`, borderRadius: "10px", padding: "1.25rem 1.5rem", marginBottom: "2.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "1.5rem" }}>✅</span>
          <div>
            <p style={{ fontWeight: 600, color: TEXT, margin: 0, fontSize: "0.9375rem" }}>Your account is active</p>
            <p style={{ color: MUTED, margin: "0.2rem 0 0", fontSize: "0.875rem" }}>
              You have access to the full Lattice partner directory. Connection requests are facilitated through The Seed Exchange.
            </p>
          </div>
        </div>

        {/* Staff membership panel — shown when user is invited staff (not org owner) */}
        {myMembership && !myOrg && staffOrg && (
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${TEAL}`, borderRadius: "10px", padding: "1.25rem 1.5rem", marginBottom: "2.5rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 0.75rem" }}>My Organization (Staff)</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "1rem", color: TEXT, margin: "0 0 0.25rem" }}>{staffOrg.name}</p>
                <p style={{ fontSize: "0.8125rem", color: MUTED, margin: 0 }}>
                  {staffOrg.county ? `${staffOrg.county} County · ` : ""}
                  Role: <strong>{myMembership.role === "org_admin" ? "Organization Admin" : "Staff"}</strong>
                  {myMembership.joined_at ? ` · Joined ${new Date(myMembership.joined_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "9999px", background: staffGate?.can_use_tools ? "#ECFDF5" : "#FEF9C3", color: staffGate?.can_use_tools ? SAGE : "#92400E", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {staffGate?.can_use_tools ? "Onboarding complete" : "Onboarding pending"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Your Organization */}
        {myOrg && (
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${TEAL}`, borderRadius: "10px", padding: "1.25rem 1.5rem", marginBottom: "2.5rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 0.75rem" }}>Your Organization</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "1rem", color: TEXT, margin: "0 0 0.25rem" }}>{myOrg.name}</p>
                <p style={{ fontSize: "0.8125rem", color: MUTED, margin: 0 }}>
                  {ORG_TYPE_LABELS[myOrg.org_type ?? ""] ?? myOrg.org_type ?? "—"}
                  {myOrg.county ? ` · ${myOrg.county} County` : ""}
                  {myOrg.membership_tier ? ` · ${myOrg.membership_tier.charAt(0).toUpperCase() + myOrg.membership_tier.slice(1)} tier` : ""}
                </p>
              </div>
              <span style={{
                backgroundColor: myOrg.is_active ? "#ECFDF5" : "#FEF3C7",
                color: myOrg.is_active ? SAGE : "#92400E",
                fontSize: "0.75rem", fontWeight: 600,
                padding: "0.2rem 0.6rem", borderRadius: "9999px",
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}>
                {myOrg.is_active ? "Active" : "Pending approval"}
              </span>
            </div>
            {myLocations && myLocations.length > 0 && (
              <div style={{ marginTop: "1rem", borderTop: `1px solid ${BORDER}`, paddingTop: "1rem" }}>
                <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 0.5rem" }}>
                  Locations ({myLocations.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {myLocations.map(loc => (
                    <div key={loc.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
                      <span style={{ color: loc.location_type === "virtual" ? "#7C6A9A" : loc.location_type === "mobile" ? "#C8622A" : TEAL, fontSize: "0.75rem" }}>
                        {loc.location_type === "virtual" ? "⬡" : loc.location_type === "mobile" ? "⬟" : "●"}
                      </span>
                      <span style={{ color: TEXT, fontWeight: 500 }}>{loc.name}</span>
                      {loc.county && <span style={{ color: MUTED }}>· {loc.county} Co.</span>}
                      <span style={{
                        marginLeft: "auto", fontSize: "0.68rem", fontWeight: 600,
                        padding: "0.1rem 0.4rem", borderRadius: "4px",
                        background: loc.is_verified ? "#ECFDF5" : "#F7F9F8",
                        color: loc.is_verified ? SAGE : MUTED,
                      }}>
                        {loc.is_verified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Staff panel — shown when the user owns an org */}
        {myOrg && (
          <StaffPanel
            orgId={myOrg.id}
            locationId={myLocations && myLocations.length > 0 ? myLocations[0].id : null}
          />
        )}

        {/* Staff panel — shown when the user is an invited org_admin */}
        {!myOrg && myMembership?.role === "org_admin" && myMembership.org_id && (
          <StaffPanel
            orgId={myMembership.org_id}
            locationId={myMembership.location_id ?? null}
          />
        )}

        {/* Workspace nav cards */}
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, color: TEXT, marginBottom: "1.25rem" }}>My Workspace</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1.25rem", marginBottom: "3rem" }}>
          {workspaceCards.map((card) => (
            <div key={card.label} style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${card.accentColor}`, borderRadius: "8px", padding: "1.375rem" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: TEXT, margin: "0 0 0.375rem" }}>{card.label}</h3>
              <p style={{ fontSize: "0.8375rem", color: MUTED, margin: "0 0 1rem", lineHeight: 1.55 }}>{card.description}</p>
              {card.onClick ? (
                <button onClick={card.onClick} style={{ background: "none", border: "none", padding: 0, color: TEAL, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Open →
                </button>
              ) : (
                <Link to={card.href} style={{ color: TEAL, fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
                  Open →
                </Link>
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

        {/* Saved Organizations */}
        <div style={{ marginTop: "3rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: TEXT, margin: 0 }}>Saved Organizations</h2>
            <Link to="/directory" style={{ color: TEAL, fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
              Browse Directory →
            </Link>
          </div>

          {(savedLoading || savedOrgsLoading) && (
            <p style={{ color: MUTED, fontSize: "0.875rem" }}>Loading saved organizations…</p>
          )}

          {!savedLoading && !savedOrgsLoading && savedIds.length === 0 && (
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "2.5rem 1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>🔖</p>
              <p style={{ fontWeight: 600, color: TEXT, marginBottom: "0.25rem" }}>No saved organizations yet</p>
              <p style={{ color: MUTED, fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                Browse the directory to save resources for quick access.
              </p>
              <Link to="/directory" style={{ display: "inline-block", backgroundColor: TEAL, color: "#FFFFFF", padding: "0.625rem 1.5rem", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
                Browse the Directory
              </Link>
            </div>
          )}

          {!savedLoading && !savedOrgsLoading && savedOrgs.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
              {savedOrgs.map((org: { id: string; name: string; slug: string; org_type: string; county: string; description: string }) => (
                <Link
                  key={org.id}
                  to={`/directory/${org.slug}`}
                  style={{ textDecoration: "none" }}
                >
                  <div style={{
                    background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px",
                    padding: "1.25rem", transition: "border-color 0.15s, box-shadow 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.375rem" }}>
                      <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.9375rem", margin: 0, lineHeight: 1.3 }}>{org.name}</p>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                        <path d="M3 2h10a1 1 0 011 1v11l-6-3-6 3V3a1 1 0 011-1z" fill={TEAL} stroke={TEAL} strokeWidth="1.5" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <p style={{ color: MUTED, fontSize: "0.775rem", margin: "0 0 0.5rem" }}>{org.county} County</p>
                    {org.description && (
                      <p style={{
                        color: MUTED, fontSize: "0.8125rem", lineHeight: 1.55, margin: 0,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {org.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: TEXT, margin: "0 0 1rem" }}>Network Announcements</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {announcements.map((ann) => (
                <div key={ann.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${TEAL}`, borderRadius: "0 8px 8px 0", padding: "1rem 1.25rem" }}>
                  {ann.title && <p style={{ color: TEXT, fontWeight: 700, fontSize: "0.875rem", margin: "0 0 0.25rem" }}>{ann.title}</p>}
                  <p style={{ color: TEXT, fontSize: "0.9rem", lineHeight: 1.65, margin: "0 0 0.3rem" }}>{ann.body}</p>
                  <p style={{ color: MUTED, fontSize: "0.75rem", margin: 0 }}>{new Date(ann.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
    {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
    {verifyLocationId && <ListingVerifyModal locationId={verifyLocationId} onClose={() => setVerifyLocationId(null)} />}
    </>
  );
}
