import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const DARK    = "#1E3A4A";
const TEAL    = "#2A9D8F";
const SAGE    = "#4A7C6F";
const BG      = "#F0F4F3";
const SURFACE = "#FFFFFF";
const BORDER  = "#E2E8E6";
const TEXT    = "#1A2B35";
const MUTED   = "#5C7380";

// ─── Constants ────────────────────────────────────────────────────────────────
const PARTNERSHIP_STATUSES = [
  "Prospect", "In Discussion", "Referred", "Active Partner",
  "Inactive", "Declined", "Do Not Contact",
];

const CATEGORIES = [
  "Housing Assistance", "Emergency Shelter", "Transitional Housing",
  "Permanent Supportive Housing", "Domestic Violence", "Mental Health",
  "Substance Abuse", "Food Assistance", "Shelter & Housing",
  "Financial Assistance", "Employment", "Legal Services",
  "Healthcare", "Childcare", "Transportation", "Education", "Other",
];

const PRIORITIES   = ["High", "Medium", "Low"];
const COC_STATUSES = ["Atlanta Regional CoC (ARC)", "Balance of State (BOS) CoC",
  "Georgia Mountains CoC", "Savannah/Chatham CoC", "Augusta CoC"];
const CONTACT_VALID = ["Yes", "No", "Partial", "Needs Verification"];
const CONTACT_METHODS = ["Phone", "Email", "In Person", "Text", "LinkedIn", "Referral"];

const GA_COUNTIES = [
  "Appling","Atkinson","Bacon","Baker","Baldwin","Banks","Barrow","Bartow",
  "Ben Hill","Berrien","Bibb","Bleckley","Brantley","Brooks","Bryan","Bulloch",
  "Burke","Butts","Calhoun","Camden","Candler","Carroll","Catoosa","Charlton",
  "Chatham","Chattahoochee","Chattooga","Cherokee","Clarke","Clay","Clayton",
  "Clinch","Cobb","Coffee","Colquitt","Columbia","Cook","Coweta","Crawford",
  "Crisp","Dade","Dawson","Decatur","DeKalb","Dodge","Dooly","Dougherty",
  "Douglas","Early","Echols","Effingham","Elbert","Emanuel","Evans","Fannin",
  "Fayette","Floyd","Forsyth","Franklin","Fulton","Gilmer","Glascock","Glynn",
  "Gordon","Grady","Greene","Gwinnett","Habersham","Hall","Hancock","Haralson",
  "Harris","Hart","Heard","Henry","Houston","Irwin","Jackson","Jasper",
  "Jeff Davis","Jefferson","Jenkins","Johnson","Jones","Lamar","Lanier",
  "Laurens","Lee","Liberty","Lincoln","Long","Lowndes","Lumpkin","McDuffie",
  "McIntosh","Macon","Madison","Marion","Meriwether","Miller","Mitchell",
  "Monroe","Montgomery","Morgan","Murray","Muscogee","Newton","Oconee",
  "Oglethorpe","Paulding","Peach","Pickens","Pierce","Pike","Polk","Pulaski",
  "Putnam","Quitman","Rabun","Randolph","Richmond","Rockdale","Schley",
  "Screven","Seminole","Spalding","Stephens","Stewart","Sumter","Talbot",
  "Taliaferro","Tattnall","Taylor","Telfair","Terrell","Thomas","Tift",
  "Toombs","Towns","Treutlen","Troup","Turner","Twiggs","Union","Upson",
  "Walker","Walton","Ware","Warren","Washington","Wayne","Webster","Wheeler",
  "White","Whitfield","Wilcox","Wilkes","Wilkinson","Worth",
];

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PrmLead {
  id: string;
  record_id: string;
  org_name: string;
  dba_name: string | null;
  source_doc: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  service_area: string | null;
  coc_status: string | null;
  coc_name: string | null;
  coc_county_class: string | null;
  contact_name: string | null;
  contact_title: string | null;
  main_phone: string | null;
  direct_phone: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  primary_category: string | null;
  sub_category: string | null;
  service_tags: string | null;
  population_served: string | null;
  eligibility_notes: string | null;
  hours: string | null;
  fees: string | null;
  referral_required: boolean | null;
  intake_process: string | null;
  required_docs: string | null;
  partnership_status: string;
  priority: string;
  relationship_owner: string | null;
  contact_info_valid: string | null;
  date_added: string | null;
  date_last_verified: string | null;
  last_contact_date: string | null;
  last_contact_method: string | null;
  follow_up_notes: string | null;
  next_follow_up_date: string | null;
  duplicate_flag: boolean | null;
  duplicate_of: string | null;
  verified_active: string | null;
  data_quality_flag: string | null;
  issues_notes: string | null;
  tse_invite_contact: string | null;
  promoted_to_directory: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    "Prospect":        { bg: "#EFF6FF", color: "#1D4ED8" },
    "In Discussion":   { bg: "#FEF9C3", color: "#854D0E" },
    "Referred":        { bg: "#F0FDF4", color: "#166534" },
    "Active Partner":  { bg: "#DCFCE7", color: "#14532D" },
    "Inactive":        { bg: "#F3F4F6", color: "#374151" },
    "Declined":        { bg: "#FEE2E2", color: "#991B1B" },
    "Do Not Contact":  { bg: "#FEE2E2", color: "#7F1D1D" },
  };
  const s = map[status] ?? { bg: "#F3F4F6", color: MUTED };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "9999px", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color = priority === "High" ? "#DC2626" : priority === "Medium" ? "#D97706" : MUTED;
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 6 }} />;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Data hooks ───────────────────────────────────────────────────────────────
function useLeads() {
  return useQuery<PrmLead[]>({
    queryKey: ["prm-leads"],
    networkMode: "always",
    retry: false,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prm_leads")
        .select("*")
        .order("org_name");
      if (error) return [];
      return (data ?? []) as PrmLead[];
    },
  });
}

// ─── Add Lead Modal ───────────────────────────────────────────────────────────
function AddLeadModal({ onClose, nextId }: { onClose: () => void; nextId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    record_id: nextId,
    org_name: "",
    contact_name: "",
    email: "",
    main_phone: "",
    county: "",
    primary_category: "",
    partnership_status: "Prospect",
    priority: "Medium",
    follow_up_notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.org_name.trim()) { setError("Organization name is required."); return; }
    setSaving(true); setError(null);
    const { error: err } = await supabase.from("prm_leads").insert({
      ...form,
      promoted_to_directory: false,
      date_added: new Date().toISOString().slice(0, 10),
    });
    if (err) { setError(err.message); setSaving(false); return; }
    qc.invalidateQueries({ queryKey: ["prm-leads"] });
    onClose();
  }

  const iStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: TEXT, fontFamily: "inherit", background: SURFACE, outline: "none" };
  const lStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 600, color: TEXT, display: "block", marginBottom: "0.25rem" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,43,53,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: SURFACE, width: "100%", maxWidth: 540, borderRadius: 6, overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ background: DARK, padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: TEAL, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 0.25rem" }}>New Lead</p>
            <h2 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Add to CRM</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
            <div>
              <label style={lStyle}>Record ID</label>
              <input style={iStyle} value={form.record_id} onChange={f("record_id")} />
            </div>
            <div>
              <label style={lStyle}>Priority</label>
              <select style={iStyle} value={form.priority} onChange={f("priority")}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lStyle}>Organization Name *</label>
            <input style={iStyle} required value={form.org_name} onChange={f("org_name")} placeholder="Full organization name" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
            <div>
              <label style={lStyle}>Contact Name</label>
              <input style={iStyle} value={form.contact_name} onChange={f("contact_name")} placeholder="Primary contact" />
            </div>
            <div>
              <label style={lStyle}>Email</label>
              <input style={iStyle} type="email" value={form.email} onChange={f("email")} placeholder="contact@org.org" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
            <div>
              <label style={lStyle}>Phone</label>
              <input style={iStyle} value={form.main_phone} onChange={f("main_phone")} placeholder="(xxx) xxx-xxxx" />
            </div>
            <div>
              <label style={lStyle}>County</label>
              <select style={iStyle} value={form.county} onChange={f("county")}>
                <option value="">— Select county —</option>
                {GA_COUNTIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
            <div>
              <label style={lStyle}>Category</label>
              <select style={iStyle} value={form.primary_category} onChange={f("primary_category")}>
                <option value="">— Select —</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lStyle}>Partnership Status</label>
              <select style={iStyle} value={form.partnership_status} onChange={f("partnership_status")}>
                {PARTNERSHIP_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lStyle}>Follow-Up Note</label>
            <textarea style={{ ...iStyle, resize: "vertical", minHeight: 72 }} value={form.follow_up_notes} onChange={f("follow_up_notes")} placeholder="Brief note on last touchpoint or next action..." />
          </div>
          {error && <p style={{ color: "#DC2626", fontSize: "0.825rem", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600, fontSize: "0.875rem", padding: "0.65rem", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 2, background: saving ? SAGE : TEAL, color: "#fff", border: "none", fontWeight: 600, fontSize: "0.875rem", padding: "0.65rem", cursor: "pointer" }}>
              {saving ? "Saving…" : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Promote to Directory Modal ───────────────────────────────────────────────
function PromoteModal({ lead, onClose }: { lead: PrmLead; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: lead.org_name,
    description: [lead.service_tags, lead.eligibility_notes].filter(Boolean).join(" · ") || "",
    org_type: "",
    county: lead.county ?? "",
    phone: lead.main_phone ?? "",
    email: lead.email ?? "",
    website: lead.website ?? "",
    address: lead.street_address ?? "",
    city: lead.city ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const ORG_TYPE_MAP: Record<string, string> = {
    "Nonprofit": "nonprofit", "Faith-Based": "faith_based", "Medical / Health": "medical",
    "Housing Assistance": "housing", "Emergency Shelter": "housing",
    "Transitional Housing": "housing", "Permanent Supportive Housing": "housing",
    "Government": "government", "Education": "school", "Other": "other",
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function handlePromote(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true); setError(null);
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data, error: orgErr } = await supabase.from("organizations").insert({
      name: form.name,
      slug,
      description: form.description || null,
      org_type: ORG_TYPE_MAP[form.org_type] ?? "other",
      county: form.county || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      address: form.address || null,
      city: form.city || null,
      state: "GA",
      is_active: true,
      is_verified: false,
      has_funding_available: false,
    }).select("id").single();

    if (orgErr) { setError(orgErr.message); setSaving(false); return; }

    await supabase.from("prm_leads").update({
      promoted_to_directory: true,
      organization_id: data.id,
    }).eq("id", lead.id);

    qc.invalidateQueries({ queryKey: ["prm-leads"] });
    qc.invalidateQueries({ queryKey: ["admin-organizations"] });
    onClose();
  }

  const iStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: TEXT, fontFamily: "inherit", background: SURFACE, outline: "none" };
  const lStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 600, color: TEXT, display: "block", marginBottom: "0.25rem" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,43,53,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: SURFACE, width: "100%", maxWidth: 560, borderRadius: 6, overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ background: SAGE, padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 0.25rem" }}>Promote to Directory</p>
            <h2 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>{lead.org_name}</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "1rem 1.5rem", background: "#F0FDF4", borderBottom: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.8125rem", color: "#166534", margin: 0, lineHeight: 1.5 }}>
            This will create a new organization record in the directory marked <strong>unverified</strong>. Review and verify it from the Organizations tab before it appears publicly.
          </p>
        </div>
        <form onSubmit={handlePromote} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={lStyle}>Organization Name *</label>
            <input style={iStyle} required value={form.name} onChange={f("name")} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
            <div>
              <label style={lStyle}>Org Type</label>
              <select style={iStyle} value={form.org_type} onChange={f("org_type")}>
                <option value="">— Select —</option>
                {["Nonprofit","Faith-Based","Medical / Health","Housing Assistance","Government","Education","Other"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lStyle}>County</label>
              <select style={iStyle} value={form.county} onChange={f("county")}>
                <option value="">— Select —</option>
                {GA_COUNTIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
            <div>
              <label style={lStyle}>Phone</label>
              <input style={iStyle} value={form.phone} onChange={f("phone")} />
            </div>
            <div>
              <label style={lStyle}>Email</label>
              <input style={iStyle} type="email" value={form.email} onChange={f("email")} />
            </div>
          </div>
          <div>
            <label style={lStyle}>Website</label>
            <input style={iStyle} value={form.website} onChange={f("website")} />
          </div>
          <div>
            <label style={lStyle}>Description / Services</label>
            <textarea style={{ ...iStyle, resize: "vertical", minHeight: 80 }} value={form.description} onChange={f("description")} placeholder="Brief description of services offered..." />
          </div>
          {error && <p style={{ color: "#DC2626", fontSize: "0.825rem", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600, fontSize: "0.875rem", padding: "0.65rem", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 2, background: saving ? MUTED : SAGE, color: "#fff", border: "none", fontWeight: 600, fontSize: "0.875rem", padding: "0.65rem", cursor: "pointer" }}>
              {saving ? "Creating…" : "Create Directory Listing →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Lead Detail Panel ────────────────────────────────────────────────────────
function DetailPanel({ lead, onClose }: { lead: PrmLead; onClose: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<PrmLead>(lead);
  const [showPromote, setShowPromote] = useState(false);
  const [saving, setSaving]   = useState(false);

  const mutation = useMutation({
    mutationFn: async (updates: Partial<PrmLead>) => {
      const { error } = await supabase.from("prm_leads").update(updates).eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prm-leads"] }); setEditing(false); },
  });

  const d = (k: keyof PrmLead) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setDraft(prev => ({ ...prev, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    await mutation.mutateAsync(draft);
    setSaving(false);
  }

  const iStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, padding: "0.4rem 0.6rem", fontSize: "0.825rem", color: TEXT, fontFamily: "inherit", background: SURFACE, outline: "none", borderRadius: 4 };
  const lStyle: React.CSSProperties = { fontSize: "0.7rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.2rem" };
  const rowStyle: React.CSSProperties = { marginBottom: "0.875rem" };

  function Field({ label, val, k, type = "text", options }: { label: string; val: string | null | undefined; k: keyof PrmLead; type?: string; options?: string[] }) {
    if (!editing) return (
      <div style={rowStyle}>
        <span style={lStyle}>{label}</span>
        <span style={{ fontSize: "0.875rem", color: val ? TEXT : MUTED }}>{val || "—"}</span>
      </div>
    );
    if (options) return (
      <div style={rowStyle}>
        <label style={lStyle}>{label}</label>
        <select style={iStyle} value={(draft[k] as string) ?? ""} onChange={d(k)}>
          <option value="">—</option>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
    );
    if (type === "textarea") return (
      <div style={rowStyle}>
        <label style={lStyle}>{label}</label>
        <textarea style={{ ...iStyle, resize: "vertical", minHeight: 72 }} value={(draft[k] as string) ?? ""} onChange={d(k)} />
      </div>
    );
    return (
      <div style={rowStyle}>
        <label style={lStyle}>{label}</label>
        <input style={iStyle} type={type} value={(draft[k] as string) ?? ""} onChange={d(k)} />
      </div>
    );
  }

  return (
    <>
      {showPromote && <PromoteModal lead={lead} onClose={() => setShowPromote(false)} />}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 480, background: SURFACE, borderLeft: `1px solid ${BORDER}`, zIndex: 200, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.08)" }}>
        {/* Header */}
        <div style={{ background: DARK, padding: "1.25rem 1.5rem", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, marginRight: "1rem" }}>
              <p style={{ color: TEAL, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.25rem" }}>{lead.record_id}</p>
              <h2 style={{ color: "#fff", fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.5rem", lineHeight: 1.3 }}>{lead.org_name}</h2>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <StatusBadge status={lead.partnership_status} />
                {lead.primary_category && <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)" }}>{lead.primary_category}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
          {/* Action bar */}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            {lead.partnership_status === "Active Partner" && !lead.promoted_to_directory && (
              <button onClick={() => setShowPromote(true)} style={{ background: SAGE, color: "#fff", border: "none", fontSize: "0.775rem", fontWeight: 700, padding: "0.4rem 0.875rem", borderRadius: 4, cursor: "pointer" }}>
                Promote to Directory →
              </button>
            )}
            {lead.promoted_to_directory && (
              <span style={{ fontSize: "0.75rem", color: "#2A9D8F", background: "rgba(42,157,143,0.15)", padding: "0.3rem 0.75rem", borderRadius: 4, fontWeight: 600 }}>
                ✓ In Directory
              </span>
            )}
            {!editing ? (
              <button onClick={() => setEditing(true)} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.775rem", fontWeight: 600, padding: "0.4rem 0.875rem", borderRadius: 4, cursor: "pointer" }}>
                Edit
              </button>
            ) : (
              <>
                <button onClick={save} disabled={saving} style={{ background: TEAL, color: "#fff", border: "none", fontSize: "0.775rem", fontWeight: 700, padding: "0.4rem 0.875rem", borderRadius: 4, cursor: "pointer" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => { setEditing(false); setDraft(lead); }} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.775rem", fontWeight: 600, padding: "0.4rem 0.875rem", borderRadius: 4, cursor: "pointer" }}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>

          {/* Follow-up note — always prominent */}
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "0.875rem 1rem", marginBottom: "1.5rem" }}>
            <span style={{ ...lStyle, color: "#92400E" }}>Follow-Up Notes</span>
            {editing ? (
              <textarea style={{ ...iStyle, background: "transparent", border: "none", padding: 0, marginTop: "0.25rem", minHeight: 60 }}
                value={draft.follow_up_notes ?? ""} onChange={d("follow_up_notes")} placeholder="Last touchpoint, next steps..." />
            ) : (
              <p style={{ fontSize: "0.875rem", color: lead.follow_up_notes ? "#78350F" : MUTED, margin: "0.25rem 0 0", lineHeight: 1.5 }}>
                {lead.follow_up_notes || "No notes yet."}
              </p>
            )}
          </div>

          {/* CRM Tracking */}
          <Section label="CRM Tracking">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <Field label="Partnership Status" val={draft.partnership_status} k="partnership_status" options={PARTNERSHIP_STATUSES} />
              <Field label="Priority"           val={draft.priority}           k="priority"           options={PRIORITIES} />
              <Field label="Contact Info Valid" val={draft.contact_info_valid} k="contact_info_valid" options={CONTACT_VALID} />
              <Field label="Last Contact Method" val={draft.last_contact_method} k="last_contact_method" options={CONTACT_METHODS} />
              <Field label="Last Contact Date"   val={draft.last_contact_date}   k="last_contact_date"   type="date" />
              <Field label="Next Follow-Up"      val={draft.next_follow_up_date} k="next_follow_up_date" type="date" />
              <Field label="Relationship Owner"  val={draft.relationship_owner}  k="relationship_owner" />
              <Field label="TSE Invite Contact"  val={draft.tse_invite_contact}  k="tse_invite_contact" />
            </div>
          </Section>

          {/* Contact */}
          <Section label="Contact Information">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <Field label="Contact Name"  val={draft.contact_name}  k="contact_name" />
              <Field label="Title / Role"  val={draft.contact_title} k="contact_title" />
              <Field label="Main Phone"    val={draft.main_phone}    k="main_phone"   type="tel" />
              <Field label="Direct Phone"  val={draft.direct_phone}  k="direct_phone" type="tel" />
              <Field label="Email"         val={draft.email}         k="email"         type="email" />
              <Field label="Website"       val={draft.website}       k="website" />
            </div>
          </Section>

          {/* Location */}
          <Section label="Location">
            <Field label="Street Address" val={draft.street_address} k="street_address" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <Field label="City"   val={draft.city}   k="city" />
              <Field label="County" val={draft.county} k="county" options={GA_COUNTIES} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <Field label="CoC Status"    val={draft.coc_status}    k="coc_status"    options={COC_STATUSES} />
              <Field label="Service Area"  val={draft.service_area}  k="service_area" />
            </div>
          </Section>

          {/* Services */}
          <Section label="Services">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <Field label="Primary Category" val={draft.primary_category} k="primary_category" options={CATEGORIES} />
              <Field label="Sub-Category"     val={draft.sub_category}     k="sub_category" />
            </div>
            <Field label="Service Tags"       val={draft.service_tags}       k="service_tags"       type="textarea" />
            <Field label="Population Served"  val={draft.population_served}  k="population_served" />
            <Field label="Eligibility Notes"  val={draft.eligibility_notes}  k="eligibility_notes"  type="textarea" />
          </Section>

          {/* Operations */}
          <Section label="Operational Details">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <Field label="Hours"  val={draft.hours} k="hours" />
              <Field label="Fees"   val={draft.fees}  k="fees" />
            </div>
            <Field label="Issues / Notes" val={draft.issues_notes} k="issues_notes" type="textarea" />
          </Section>

          {/* Meta */}
          <Section label="Record Info">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <div style={rowStyle}>
                <span style={lStyle}>Date Added</span>
                <span style={{ fontSize: "0.825rem", color: MUTED }}>{fmtDate(lead.date_added)}</span>
              </div>
              <div style={rowStyle}>
                <span style={lStyle}>Source Document</span>
                <span style={{ fontSize: "0.825rem", color: MUTED }}>{lead.source_doc || "—"}</span>
              </div>
              <div style={rowStyle}>
                <span style={lStyle}>Verified Active</span>
                <span style={{ fontSize: "0.825rem", color: MUTED }}>{lead.verified_active || "—"}</span>
              </div>
              <div style={rowStyle}>
                <span style={lStyle}>Data Quality</span>
                <span style={{ fontSize: "0.825rem", color: MUTED }}>{lead.data_quality_flag || "—"}</span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 0.875rem", paddingBottom: "0.5rem", borderBottom: `1px solid ${BORDER}` }}>
        {label}
      </p>
      {children}
    </div>
  );
}

// ─── Main CRM View ────────────────────────────────────────────────────────────
export default function CRMView() {
  const { data: leads = [], isLoading } = useLeads();
  const [search,   setSearch]   = useState("");
  const [fStatus,  setFStatus]  = useState("");
  const [fCounty,  setFCounty]  = useState("");
  const [fCat,     setFCat]     = useState("");
  const [fPriority,setFPriority]= useState("");
  const [selected, setSelected] = useState<PrmLead | null>(null);
  const [showAdd,  setShowAdd]  = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter(l => {
      if (fStatus   && l.partnership_status !== fStatus)   return false;
      if (fCounty   && l.county !== fCounty)               return false;
      if (fCat      && l.primary_category !== fCat)        return false;
      if (fPriority && l.priority !== fPriority)           return false;
      if (q && ![l.org_name, l.contact_name, l.email, l.county, l.record_id]
                 .some(v => v?.toLowerCase().includes(q)))  return false;
      return true;
    });
  }, [leads, search, fStatus, fCounty, fCat, fPriority]);

  const nextRecordId = useMemo(() => {
    const nums = leads
      .map(l => parseInt(l.record_id.replace("TSE-", ""), 10))
      .filter(n => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `TSE-${String(max + 1).padStart(4, "0")}`;
  }, [leads]);

  const sStyle: React.CSSProperties = { padding: "0.45rem 0.75rem", border: `1px solid ${BORDER}`, fontSize: "0.825rem", color: TEXT, background: SURFACE, fontFamily: "inherit", outline: "none" };

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.partnership_status] = (c[l.partnership_status] ?? 0) + 1;
    return c;
  }, [leads]);

  return (
    <>
      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} nextId={nextRecordId} />}
      {selected && <DetailPanel lead={selected} onClose={() => setSelected(null)} />}

      {/* Overlay when panel is open */}
      {selected && <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 190 }} />}

      <div>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.2rem" }}>CRM — Provider Pipeline</h1>
            <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>
              {leads.length} total · {statusCounts["Active Partner"] ?? 0} active partners · {statusCounts["Prospect"] ?? 0} prospects
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ background: TEAL, color: "#fff", border: "none", fontWeight: 600, fontSize: "0.875rem", padding: "0.6rem 1.25rem", borderRadius: 6, cursor: "pointer" }}>
            + Add Lead
          </button>
        </div>

        {/* Pipeline status bar */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {PARTNERSHIP_STATUSES.map(s => (
            <button key={s} onClick={() => setFStatus(fStatus === s ? "" : s)}
              style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, border: `1px solid ${fStatus === s ? TEAL : BORDER}`, borderRadius: "9999px", background: fStatus === s ? `${TEAL}15` : SURFACE, color: fStatus === s ? TEAL : MUTED, cursor: "pointer" }}>
              {s} {statusCounts[s] ? `(${statusCounts[s]})` : ""}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <input
            placeholder="Search org, contact, email, ID…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...sStyle, flex: "1 1 200px", minWidth: 180 }}
          />
          <select style={sStyle} value={fCounty} onChange={e => setFCounty(e.target.value)}>
            <option value="">All Counties</option>
            {GA_COUNTIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select style={sStyle} value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select style={sStyle} value={fPriority} onChange={e => setFPriority(e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          {(search || fStatus || fCounty || fCat || fPriority) && (
            <button onClick={() => { setSearch(""); setFStatus(""); setFCounty(""); setFCat(""); setFPriority(""); }}
              style={{ ...sStyle, color: MUTED, cursor: "pointer" }}>Clear</button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 120px 160px 130px 100px 90px", gap: "0.5rem", padding: "0.65rem 1rem", background: BG, borderBottom: `1px solid ${BORDER}` }}>
            {["Record ID", "Organization", "County", "Category", "Status", "Follow-Up", "Priority"].map(h => (
              <p key={h} style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, margin: 0 }}>{h}</p>
            ))}
          </div>

          {isLoading && (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>Loading leads…</p>
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>
                {leads.length === 0 ? "No leads yet. Add your first lead or run the import script to load existing data." : "No results match your filters."}
              </p>
            </div>
          )}

          {filtered.map(lead => (
            <div key={lead.id}
              onClick={() => setSelected(lead)}
              style={{ display: "grid", gridTemplateColumns: "110px 1fr 120px 160px 130px 100px 90px", gap: "0.5rem", padding: "0.75rem 1rem", borderBottom: `1px solid ${BORDER}`, cursor: "pointer", transition: "background 0.1s" }}
              onMouseEnter={e => (e.currentTarget.style.background = BG)}
              onMouseLeave={e => (e.currentTarget.style.background = SURFACE)}
            >
              <p style={{ fontSize: "0.78rem", color: MUTED, margin: 0, fontFamily: "monospace" }}>{lead.record_id}</p>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 600, color: TEXT, fontSize: "0.875rem", margin: "0 0 0.1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.org_name}</p>
                {lead.contact_name && <p style={{ fontSize: "0.75rem", color: MUTED, margin: 0 }}>{lead.contact_name}</p>}
              </div>
              <p style={{ fontSize: "0.8rem", color: MUTED, margin: 0 }}>{lead.county || "—"}</p>
              <p style={{ fontSize: "0.78rem", color: MUTED, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.primary_category || "—"}</p>
              <div><StatusBadge status={lead.partnership_status} /></div>
              <p style={{ fontSize: "0.78rem", color: lead.next_follow_up_date ? TEXT : MUTED, margin: 0 }}>
                {fmtDate(lead.next_follow_up_date)}
              </p>
              <div style={{ display: "flex", alignItems: "center" }}>
                <PriorityDot priority={lead.priority} />
                <span style={{ fontSize: "0.78rem", color: MUTED }}>{lead.priority}</span>
              </div>
            </div>
          ))}
        </div>

        {filtered.length > 0 && (
          <p style={{ fontSize: "0.75rem", color: MUTED, marginTop: "0.75rem", textAlign: "right" }}>
            {filtered.length} of {leads.length} records
          </p>
        )}
      </div>
    </>
  );
}
