import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import { supabase } from "@/lib/supabase";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const DARK    = "#1E3A4A";
const TEAL    = "#2A9D8F";
const SAGE    = "#4A7C6F";
const BG      = "#F7F9F8";
const SURFACE = "#FFFFFF";
const BORDER  = "#E2E8E6";
const TEXT    = "#1A2B35";
const MUTED   = "#5C7380";
const RED     = "#DC2626";
const GOLD    = "#D97706";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tier = "participant" | "collaborator" | "strategic" | "anchor";

interface TierDef {
  id: Tier;
  category: string;
  label: string;
  description: string;
  price: string;
  period: string;
  color: string;
  icon: string;
  perks: string[];
}

interface PrmLead {
  record_id: string;
  org_name: string | null;
  county: string | null;
  primary_category: string | null;
  contact_name: string | null;
  contact_title: string | null;
  main_phone: string | null;
  direct_phone: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  follow_up_notes: string | null;
  partnership_status: string | null;
  promoted_to_directory: boolean;
  claimed_by_email: string | null;
  claim_status: string | null;
}

interface FormData {
  org_name: string;
  org_type: string;
  county: string;
  website: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  description: string;
  services: string[];
  accepts_case_conference: boolean;
  has_funding: boolean;
  referral: string;
}

const EMPTY_FORM: FormData = {
  org_name: "", org_type: "", county: "", website: "",
  contact_name: "", contact_title: "", contact_email: "", contact_phone: "",
  description: "", services: [], accepts_case_conference: false, has_funding: false, referral: "",
};

// ─── Tier definitions ─────────────────────────────────────────────────────────
const TIERS: TierDef[] = [
  {
    id: "participant", category: "Foundational Access", label: "Network Participant",
    description: "For organizations beginning structured participation within The Seed Exchange network.",
    price: "Free", period: "", color: SAGE, icon: "♥",
    perks: [
      "Verified directory profile within Lattice",
      "Referral submission and receipt access",
      "Participation in shared referral standards",
      "Monthly partner coordination huddles",
      "Inclusion in collective outcome reporting",
    ],
  },
  {
    id: "collaborator", category: "Priority Routing", label: "Network Collaborator",
    description: "For established organizations seeking deeper integration within structured referral pathways.",
    price: "$49", period: "/ mo", color: TEAL, icon: "⬡",
    perks: [
      "All Network Participant benefits",
      "Priority referral routing within Lattice",
      "Access to quarterly network impact summaries",
      "Discounted coordination trainings",
      "Participation in partner roundtables",
    ],
  },
  {
    id: "strategic", category: "Escalation & Alignment", label: "Strategic Partner",
    description: "For organizations serving complex households and requiring coordinated case visibility and escalation pathways.",
    price: "$149", period: "/ mo", color: "#C8622A", icon: "◈",
    perks: [
      "All Collaborator benefits",
      "Priority case escalation pathway",
      "Custom performance dashboard access",
      "Biannual strategic alignment sessions",
      "Participation in standards advisory discussions",
    ],
  },
  {
    id: "anchor", category: "Early Build Cohort", label: "Founding Strategic Circle",
    description: "A limited founding cohort helping shape the initial standards, workflows, and performance model of the Seed Exchange network.",
    price: "Custom", period: "", color: DARK, icon: "◎",
    perks: [
      "Strategic Partner-level access",
      "Advisory participation during platform refinement",
      "Recognition as Founding Strategic Circle Member",
      "Co-design input on early performance standards",
      "Early access to system enhancements",
    ],
  },
];

const SERVICE_OPTIONS = [
  "Housing Stability", "Income & Benefits", "Health & Wellness",
  "Life Navigation", "Food Access", "Legal Aid", "Childcare & Education", "Employment",
];

const COUNTY_OPTIONS = [
  "Fulton", "DeKalb", "Cobb", "Gwinnett", "Clayton",
  "Cherokee", "Henry", "Forsyth", "Rockdale", "Douglas",
  "Bartow", "Carroll", "Haralson", "Paulding", "Floyd",
  "Polk", "Gordon", "Pickens", "Dawson", "Hall",
];

const ORG_TYPE_OPTIONS = [
  { value: "nonprofit",   label: "Nonprofit" },
  { value: "faith_based", label: "Faith-Based Organization" },
  { value: "school",      label: "School / Educational Institution" },
  { value: "medical",     label: "Medical / Healthcare" },
  { value: "housing",     label: "Housing Authority" },
  { value: "government",  label: "Government Agency" },
  { value: "other",       label: "Other" },
];

// Map PRM category text to org_type values
function inferOrgType(category: string | null): string {
  if (!category) return "";
  const c = category.toLowerCase();
  if (c.includes("health") || c.includes("medical") || c.includes("clinic") || c.includes("hospital")) return "medical";
  if (c.includes("church") || c.includes("faith") || c.includes("ministry") || c.includes("pastor")) return "faith_based";
  if (c.includes("school") || c.includes("education")) return "school";
  if (c.includes("housing") || c.includes("shelter")) return "housing";
  if (c.includes("government") || c.includes("county") || c.includes("city") || c.includes("dfcs")) return "government";
  return "nonprofit";
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "0.625rem 0.875rem",
  border: `1.5px solid ${BORDER}`,
  borderRadius: "6px", fontSize: "0.9rem",
  color: TEXT, background: SURFACE, outline: "none", fontFamily: "inherit",
};

const prefilledStyle: React.CSSProperties = {
  ...inputStyle,
  background: "rgba(42,157,143,0.07)",
  borderColor: "rgba(42,157,143,0.4)",
};

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label style={{ fontSize: "0.875rem", fontWeight: 600, color: TEXT }}>
        {label}
        {required && <span style={{ color: TEAL, marginLeft: "0.2rem" }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: "0.78rem", color: MUTED, margin: 0 }}>{hint}</p>}
      {children}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  const steps = ["Find your org", "Choose tier", "Your organization", "Review & submit"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "2.5rem", overflowX: "auto" }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.78rem", fontWeight: 700,
                background: done ? TEAL : active ? DARK : BORDER,
                color: done || active ? "#fff" : MUTED, flexShrink: 0,
              }}>
                {done ? "✓" : n}
              </div>
              <span style={{
                fontSize: "0.8125rem", fontWeight: active ? 600 : 400,
                color: active ? TEXT : MUTED, whiteSpace: "nowrap",
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? TEAL : BORDER, margin: "0 0.75rem", minWidth: 12 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 0 — Search & Claim ──────────────────────────────────────────────────
function ClaimSearchStep({ onClaim, onNew }: {
  onClaim: (lead: PrmLead) => void;
  onNew: () => void;
}) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<PrmLead[]>([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<PrmLead | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearched(false); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("prm_leads")
        .select("record_id,org_name,county,primary_category,contact_name,contact_title,main_phone,direct_phone,email,street_address,city,state,zip,website,follow_up_notes,partnership_status,promoted_to_directory,claimed_by_email,claim_status")
        .or(`org_name.ilike.%${q}%,email.ilike.%${q}%,contact_name.ilike.%${q}%,county.ilike.%${q}%`)
        .not("partnership_status", "eq", "Do Not Contact")
        .not("claim_status", "eq", "approved")
        .order("org_name")
        .limit(8);
      setResults((data as PrmLead[]) ?? []);
      setSearched(true);
      setLoading(false);
    }, 350);
  }, [query]);

  const ORG_TYPE_COLOR: Record<string, string> = {
    nonprofit: TEAL, faith_based: "#7B68C8", school: "#E07A3A",
    medical: "#3A8FE0", housing: SAGE, government: MUTED, other: MUTED,
  };

  return (
    <div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.375rem" }}>
        Is your organization already in our records?
      </h2>
      <p style={{ color: MUTED, fontSize: "0.9375rem", margin: "0 0 1.75rem", lineHeight: 1.6 }}>
        We've pre-loaded information on organizations from across Georgia. Search by name, county, or contact email — if we find you, we'll pre-fill your application so you don't start from scratch.
      </p>

      {/* Search input */}
      <div style={{ position: "relative" }}>
        <svg style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: MUTED }}
          width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.6"/>
          <path d="M12 12L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        <input
          style={{ ...inputStyle, paddingLeft: "2.75rem", fontSize: "1rem" }}
          type="text" value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Search by organization name, county, or email…"
          autoFocus
          onFocus={e => (e.target.style.borderColor = TEAL)}
          onBlur={e => (e.target.style.borderColor = BORDER)}
        />
        {loading && (
          <div style={{ position: "absolute", right: "0.875rem", top: "50%", transform: "translateY(-50%)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: "spin 0.8s linear infinite" }}>
              <circle cx="8" cy="8" r="6" stroke={BORDER} strokeWidth="2.5" fill="none"/>
              <path d="M8 2a6 6 0 016 6" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: "0.8125rem", color: MUTED, marginTop: "0.5rem" }}>
        Try: <strong style={{ color: TEXT }}>Cherokee</strong>, <strong style={{ color: TEXT }}>Grace Place</strong>, or <strong style={{ color: TEXT }}>Bartow</strong>
      </p>

      {/* Results */}
      {searched && results.length === 0 && query.trim().length >= 2 && (
        <div style={{
          textAlign: "center", padding: "2rem",
          border: `1px dashed ${BORDER}`, borderRadius: "8px", marginTop: "1.25rem",
        }}>
          <p style={{ fontWeight: 600, color: TEXT, margin: "0 0 0.25rem" }}>No records found for "{query}"</p>
          <p style={{ color: MUTED, fontSize: "0.875rem", margin: 0 }}>
            That's okay — you can add your organization as a new listing below.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: MUTED, margin: "0 0 0.625rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {results.length} match{results.length !== 1 ? "es" : ""} found — select yours
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {results.map(lead => {
              const isSel = selected?.record_id === lead.record_id;
              const orgType = inferOrgType(lead.primary_category);
              const typeColor = ORG_TYPE_COLOR[orgType] ?? MUTED;
              const alreadyClaimed = lead.claim_status === "pending";
              return (
                <div
                  key={lead.record_id}
                  onClick={() => !alreadyClaimed && setSelected(isSel ? null : lead)}
                  style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    padding: "0.875rem 1rem",
                    border: `1.5px solid ${isSel ? TEAL : BORDER}`,
                    borderRadius: "8px", background: SURFACE,
                    cursor: alreadyClaimed ? "default" : "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    boxShadow: isSel ? `0 0 0 3px rgba(42,157,143,0.12)` : "none",
                    opacity: alreadyClaimed ? 0.65 : 1,
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: typeColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: TEXT }}>{lead.org_name}</div>
                    <div style={{ fontSize: "0.8rem", color: MUTED, marginTop: "0.1rem" }}>
                      {[lead.county && `${lead.county} County`, lead.contact_name].filter(Boolean).join(" · ")}
                      {alreadyClaimed && (
                        <span style={{ marginLeft: "0.5rem", color: GOLD, fontWeight: 600 }}>· Claim pending review</span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em",
                    textTransform: "uppercase", padding: "0.2rem 0.5rem",
                    background: `${typeColor}18`, color: typeColor, flexShrink: 0,
                    borderRadius: "3px",
                  }}>
                    {orgType.replace("_", "-")}
                  </span>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${isSel ? TEAL : BORDER}`,
                    background: isSel ? TEAL : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {isSel && (
                      <svg width="10" height="9" viewBox="0 0 10 9" fill="none">
                        <path d="M1.5 4.5L3.75 7L8.5 1.5" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected lead preview */}
      {selected && (
        <div style={{
          marginTop: "1.25rem", padding: "1.25rem 1.5rem",
          background: "rgba(42,157,143,0.06)",
          border: `1.5px solid rgba(42,157,143,0.35)`,
          borderRadius: "8px",
        }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEAL, margin: "0 0 0.75rem" }}>
            We'll pre-fill your application from this record
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem 1.5rem" }}>
            {[
              ["Organization", selected.org_name],
              ["County", selected.county ? `${selected.county} County` : null],
              ["Contact on file", selected.contact_name],
              ["Phone on file", selected.main_phone || selected.direct_phone],
              ["Email on file", selected.email],
              ["Record ID", selected.record_id],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string}>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                <div style={{ fontSize: "0.875rem", color: TEXT, fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.78rem", color: MUTED, margin: "0.875rem 0 0" }}>
            You'll be able to update any pre-filled information in the next step.
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: "2rem", flexWrap: "wrap", gap: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.875rem", color: MUTED }}>Not in our records?</span>
          <button
            onClick={onNew}
            style={{
              background: "transparent", border: `1.5px solid ${BORDER}`,
              color: MUTED, fontWeight: 600, fontSize: "0.875rem",
              padding: "0.5rem 1.125rem", borderRadius: "6px", cursor: "pointer",
            }}
          >
            Add new listing
          </button>
        </div>
        <button
          onClick={() => selected && onClaim(selected)}
          disabled={!selected}
          style={{
            background: selected ? TEAL : "rgba(0,0,0,0.1)",
            color: selected ? "#fff" : MUTED,
            fontWeight: 700, fontSize: "0.9375rem",
            padding: "0.75rem 2rem", border: "none",
            borderRadius: "8px", cursor: selected ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          Claim this listing →
        </button>
      </div>
    </div>
  );
}

// ─── Step 1 — Tier picker ─────────────────────────────────────────────────────
function TierPicker({ selected, onSelect, onNext, onBack }: {
  selected: Tier | null; onSelect: (t: Tier) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.375rem" }}>
        Choose your membership tier
      </h2>
      <p style={{ color: MUTED, fontSize: "0.9375rem", margin: "0 0 2rem", lineHeight: 1.6 }}>
        Every tier includes a verified listing in the Lattice directory. Select the level of coordination that fits where your organization is right now.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {TIERS.map((tier) => {
          const isSel = selected === tier.id;
          return (
            <div key={tier.id} onClick={() => onSelect(tier.id)} style={{
              position: "relative", background: isSel ? `${tier.color}08` : SURFACE,
              border: `1.5px solid ${isSel ? tier.color : BORDER}`,
              borderRadius: "10px", padding: "1.5rem", cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: isSel ? `0 0 0 3px ${tier.color}20, 0 4px 16px rgba(0,0,0,0.07)` : "0 1px 4px rgba(0,0,0,0.05)",
              display: "flex", flexDirection: "column", gap: "1rem",
            }}>
              {isSel && (
                <div style={{
                  position: "absolute", top: "0.875rem", right: "0.875rem",
                  width: 22, height: 22, borderRadius: "50%", background: tier.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4.5L4 7.5L10 1" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "8px",
                  background: `${tier.color}18`, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "1.1rem", color: tier.color, flexShrink: 0,
                }}>
                  {tier.icon}
                </div>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: tier.color, lineHeight: 1.3 }}>
                  {tier.category}
                </span>
              </div>
              <div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: TEXT, margin: "0 0 0.5rem", lineHeight: 1.3, paddingRight: isSel ? "1.5rem" : 0 }}>
                  {tier.label}
                </h3>
                <p style={{ fontSize: "0.8125rem", color: MUTED, margin: 0, lineHeight: 1.6 }}>{tier.description}</p>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                <span style={{ fontSize: "1.5rem", fontWeight: 800, color: TEXT }}>{tier.price}</span>
                {tier.period && <span style={{ fontSize: "0.8125rem", color: MUTED }}>{tier.period}</span>}
              </div>
              <div style={{ height: 1, background: BORDER }} />
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {tier.perks.map((perk) => (
                  <li key={perk} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                    <span style={{ display: "block", width: 5, height: 5, borderRadius: "50%", background: tier.color, flexShrink: 0, marginTop: "0.45rem" }} />
                    <span style={{ fontSize: "0.8rem", color: TEXT, lineHeight: 1.5 }}>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
        <button onClick={onBack} style={{ background: "transparent", border: `1.5px solid ${BORDER}`, color: MUTED, fontWeight: 500, fontSize: "0.9rem", padding: "0.7rem 1.5rem", borderRadius: "8px", cursor: "pointer" }}>
          ← Back
        </button>
        <button onClick={onNext} disabled={!selected} style={{
          background: selected ? TEAL : "rgba(0,0,0,0.1)",
          color: selected ? "#fff" : MUTED,
          fontWeight: 600, fontSize: "0.9375rem", padding: "0.75rem 2rem",
          border: "none", borderRadius: "8px", cursor: selected ? "pointer" : "not-allowed",
          transition: "background 0.15s", whiteSpace: "nowrap",
        }}>
          {selected ? `Continue as ${TIERS.find(t => t.id === selected)?.label} →` : "Select a tier to continue"}
        </button>
      </div>
    </div>
  );
}

// ─── Step 2 — Application form ────────────────────────────────────────────────
function AppForm({ tier, form, prefilled, onChange, onBack, onNext }: {
  tier: TierDef; form: FormData; prefilled: boolean;
  onChange: (p: Partial<FormData>) => void; onBack: () => void; onNext: () => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.org_name.trim())      e.org_name      = "Organization name is required.";
    if (!form.org_type)             e.org_type      = "Please select an organization type.";
    if (!form.county)               e.county        = "Please select a county.";
    if (!form.contact_name.trim())  e.contact_name  = "Contact name is required.";
    if (!form.contact_email.trim()) e.contact_email = "Contact email is required.";
    if (!form.contact_phone.trim()) e.contact_phone = "Contact phone is required.";
    if (!form.description.trim())   e.description   = "Please provide a brief description.";
    if (form.services.length === 0) e.services      = "Select at least one service area.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => (e.target.style.borderColor = TEAL);
  const blur  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = (e.target as HTMLInputElement).dataset.prefilled ? "rgba(42,157,143,0.4)" : BORDER);
  const errStyle: React.CSSProperties = { fontSize: "0.78rem", color: RED, marginTop: "0.25rem" };

  function fieldStyle(field: keyof FormData): React.CSSProperties {
    const val = form[field];
    const hasVal = typeof val === "string" ? val.trim().length > 0 : false;
    return prefilled && hasVal ? prefilledStyle : inputStyle;
  }

  return (
    <div>
      {prefilled && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          background: "rgba(42,157,143,0.08)", border: `1px solid rgba(42,157,143,0.3)`,
          borderRadius: "6px", padding: "0.75rem 1rem", marginBottom: "1.5rem",
          fontSize: "0.8125rem", color: TEAL, fontWeight: 500,
        }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#2A9D8F" strokeWidth="1.4"/>
            <path d="M5 8.5L7 10.5L11 6" stroke="#2A9D8F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Fields highlighted in green were pre-filled from your existing record. Review and correct anything that has changed.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: 0 }}>Your organization</h2>
        <span style={{ background: `${tier.color}18`, color: tier.color, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.25rem 0.7rem", borderRadius: "3px" }}>
          {tier.label}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Organization */}
        <SectionCard title="Organization details">
          <Field label="Organization name" required>
            <input style={fieldStyle("org_name")} value={form.org_name}
              onChange={e => onChange({ org_name: e.target.value })} onFocus={focus} onBlur={blur}
              placeholder="Full legal or operating name" />
            {errors.org_name && <p style={errStyle}>{errors.org_name}</p>}
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <Field label="Organization type" required>
              <select
                style={{ ...(form.org_type && prefilled ? prefilledStyle : inputStyle), appearance: "none", backgroundImage: chevron, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center", paddingRight: "2rem" }}
                value={form.org_type} onChange={e => onChange({ org_type: e.target.value })} onFocus={focus} onBlur={blur}
              >
                <option value="">Select type…</option>
                {ORG_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {errors.org_type && <p style={errStyle}>{errors.org_type}</p>}
            </Field>
            <Field label="Primary county" required>
              <select
                style={{ ...(form.county && prefilled ? prefilledStyle : inputStyle), appearance: "none", backgroundImage: chevron, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center", paddingRight: "2rem" }}
                value={form.county} onChange={e => onChange({ county: e.target.value })} onFocus={focus} onBlur={blur}
              >
                <option value="">Select county…</option>
                {COUNTY_OPTIONS.map(c => <option key={c} value={c}>{c} County</option>)}
              </select>
              {errors.county && <p style={errStyle}>{errors.county}</p>}
            </Field>
          </div>
          <Field label="Website" hint="Optional">
            <input style={fieldStyle("website")} value={form.website}
              onChange={e => onChange({ website: e.target.value })} onFocus={focus} onBlur={blur}
              placeholder="https://" type="url" />
          </Field>
          <Field label="Brief description" required hint="2–3 sentences. Appears on your public directory card.">
            <textarea
              style={{ ...fieldStyle("description"), minHeight: "90px", resize: "vertical" }}
              value={form.description} onChange={e => onChange({ description: e.target.value })} onFocus={focus} onBlur={blur}
              placeholder="Describe who you serve and what you provide…" />
            {errors.description && <p style={errStyle}>{errors.description}</p>}
          </Field>
          <Field label="Service areas" required hint="Select all that apply.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
              {SERVICE_OPTIONS.map(s => {
                const on = form.services.includes(s);
                return (
                  <button key={s} type="button"
                    onClick={() => onChange({ services: on ? form.services.filter(x => x !== s) : [...form.services, s] })}
                    style={{ padding: "0.35rem 0.875rem", border: `1.5px solid ${on ? TEAL : BORDER}`, borderRadius: "9999px", background: on ? `${TEAL}15` : SURFACE, color: on ? TEAL : MUTED, fontSize: "0.8125rem", fontWeight: on ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                    {s}
                  </button>
                );
              })}
            </div>
            {errors.services && <p style={errStyle}>{errors.services}</p>}
          </Field>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
              ["accepts_case_conference", "Open to case conferences"] as const,
              ["has_funding", "Has funding / resources available"] as const,
            ].map(([key, label]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: TEXT }}>
                <input type="checkbox" checked={form[key] as boolean}
                  onChange={e => onChange({ [key]: e.target.checked })}
                  style={{ accentColor: TEAL, width: 16, height: 16 }} />
                {label}
              </label>
            ))}
          </div>
        </SectionCard>

        {/* Contact */}
        <SectionCard title="Primary contact" subtitle="This person will be listed in the directory and receive coordination requests via TSE.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <Field label="Full name" required>
              <input style={fieldStyle("contact_name")} value={form.contact_name}
                onChange={e => onChange({ contact_name: e.target.value })} onFocus={focus} onBlur={blur}
                placeholder="First Last" />
              {errors.contact_name && <p style={errStyle}>{errors.contact_name}</p>}
            </Field>
            <Field label="Title / role">
              <input style={fieldStyle("contact_title")} value={form.contact_title}
                onChange={e => onChange({ contact_title: e.target.value })} onFocus={focus} onBlur={blur}
                placeholder="Case Manager, Director, etc." />
            </Field>
            <Field label="Email address" required>
              <input style={inputStyle} type="email" value={form.contact_email}
                onChange={e => onChange({ contact_email: e.target.value })} onFocus={focus} onBlur={blur}
                placeholder="you@organization.org" />
              {errors.contact_email && <p style={errStyle}>{errors.contact_email}</p>}
            </Field>
            <Field label="Phone number" required>
              <input style={fieldStyle("contact_phone")} type="tel" value={form.contact_phone}
                onChange={e => onChange({ contact_phone: e.target.value })} onFocus={focus} onBlur={blur}
                placeholder="(770) 555-0100" />
              {errors.contact_phone && <p style={errStyle}>{errors.contact_phone}</p>}
            </Field>
          </div>
        </SectionCard>

        {/* Referral */}
        <SectionCard title="How did you find us?">
          <Field label="Referral source" hint="Optional — helps us understand how partners find us.">
            <input style={inputStyle} value={form.referral}
              onChange={e => onChange({ referral: e.target.value })} onFocus={focus} onBlur={blur}
              placeholder="Colleague referral, TSE event, social media, etc." />
          </Field>
        </SectionCard>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2rem" }}>
        <button onClick={onBack} style={{ background: "transparent", border: `1.5px solid ${BORDER}`, color: MUTED, fontWeight: 500, fontSize: "0.9rem", padding: "0.7rem 1.5rem", borderRadius: "8px", cursor: "pointer" }}>
          ← Back
        </button>
        <button onClick={() => validate() && onNext()} style={{ background: DARK, color: "#fff", fontWeight: 600, fontSize: "0.9375rem", padding: "0.75rem 2rem", border: "none", borderRadius: "8px", cursor: "pointer" }}>
          Review application →
        </button>
      </div>
    </div>
  );
}

const chevron = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235C7380' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")";

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, margin: 0 }}>{title}</p>
      {subtitle && <p style={{ fontSize: "0.8125rem", color: MUTED, margin: "-0.75rem 0 0", lineHeight: 1.5 }}>{subtitle}</p>}
      {children}
    </div>
  );
}

// ─── Step 3 — Review & submit ─────────────────────────────────────────────────
function ReviewStep({ tier, form, lead, onBack, onSubmit, submitting }: {
  tier: TierDef; form: FormData; lead: PrmLead | null;
  onBack: () => void; onSubmit: () => void; submitting: boolean;
}) {
  return (
    <div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT, margin: "0 0 0.5rem" }}>Review your application</h2>
      <p style={{ color: MUTED, fontSize: "0.9rem", margin: "0 0 2rem", lineHeight: 1.6 }}>
        Look this over before submitting. A TSE coordinator will review and follow up within 2–3 business days.
      </p>

      {lead && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(42,157,143,0.08)", border: `1px solid rgba(42,157,143,0.3)`, borderRadius: "6px", padding: "0.75rem 1rem", marginBottom: "1.25rem", fontSize: "0.8125rem", color: TEAL, fontWeight: 500 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#2A9D8F" strokeWidth="1.4"/><path d="M5 8.5L7 10.5L11 6" stroke="#2A9D8F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Claiming record {lead.record_id} — {lead.org_name}
        </div>
      )}

      <ReviewSection title="Membership tier">
        <ReviewRow label="Tier" value={tier.label} accent={tier.color} />
        <ReviewRow label="Price" value={tier.price + tier.period} />
      </ReviewSection>
      <ReviewSection title="Organization">
        <ReviewRow label="Name" value={form.org_name} />
        <ReviewRow label="Type" value={ORG_TYPE_OPTIONS.find(o => o.value === form.org_type)?.label ?? form.org_type} />
        <ReviewRow label="County" value={`${form.county} County`} />
        {form.website && <ReviewRow label="Website" value={form.website} />}
        <ReviewRow label="Description" value={form.description} />
        <ReviewRow label="Services" value={form.services.join(", ")} />
        {form.accepts_case_conference && <ReviewRow label="" value="✓ Open to case conferences" />}
        {form.has_funding && <ReviewRow label="" value="✓ Has funding / resources available" />}
      </ReviewSection>
      <ReviewSection title="Primary contact">
        <ReviewRow label="Name" value={form.contact_name} />
        {form.contact_title && <ReviewRow label="Title" value={form.contact_title} />}
        <ReviewRow label="Email" value={form.contact_email} />
        <ReviewRow label="Phone" value={form.contact_phone} />
      </ReviewSection>

      <div style={{ background: `${TEAL}0D`, border: `1px solid ${TEAL}40`, borderRadius: "8px", padding: "1rem 1.25rem", marginBottom: "2rem", fontSize: "0.8125rem", color: MUTED, lineHeight: 1.6 }}>
        <strong style={{ color: TEXT }}>Privacy note: </strong>
        Your contact information will only be shared with network members through TSE-facilitated connections.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ background: "transparent", border: `1.5px solid ${BORDER}`, color: MUTED, fontWeight: 500, fontSize: "0.9rem", padding: "0.7rem 1.5rem", borderRadius: "8px", cursor: "pointer" }}>
          ← Edit
        </button>
        <button onClick={onSubmit} disabled={submitting} style={{ background: submitting ? SAGE : TEAL, color: "#fff", fontWeight: 700, fontSize: "0.9375rem", padding: "0.75rem 2.25rem", border: "none", borderRadius: "8px", cursor: submitting ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
          {submitting ? "Submitting…" : "Submit application"}
        </button>
      </div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", marginBottom: "1.25rem", overflow: "hidden" }}>
      <div style={{ background: BG, padding: "0.625rem 1.25rem", borderBottom: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, margin: 0 }}>{title}</p>
      </div>
      <div style={{ padding: "0.75rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {children}
      </div>
    </div>
  );
}

function ReviewRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: "1rem", fontSize: "0.875rem" }}>
      {label && <span style={{ color: MUTED, minWidth: "100px", flexShrink: 0 }}>{label}</span>}
      <span style={{ color: accent ?? TEXT, fontWeight: accent ? 700 : 400 }}>{value}</span>
    </div>
  );
}

// ─── Success ──────────────────────────────────────────────────────────────────
function SuccessState({ tier, name }: { tier: TierDef; name: string }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${TEAL}15`, border: `2px solid ${TEAL}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", fontSize: "2rem" }}>✓</div>
      <h2 style={{ fontSize: "1.875rem", fontWeight: 700, color: TEXT, margin: "0 0 0.75rem" }}>Application received.</h2>
      <p style={{ color: MUTED, fontSize: "1rem", lineHeight: 1.7, maxWidth: 480, margin: "0 auto 0.75rem" }}>
        Thanks, {name.split(" ")[0]}. Your <span style={{ color: tier.color, fontWeight: 600 }}>{tier.label}</span> application is in. A TSE coordinator will review and reach out within 2–3 business days.
      </p>
      <p style={{ color: MUTED, fontSize: "0.875rem", margin: "0 auto 2.5rem", maxWidth: 440, lineHeight: 1.6 }}>
        In the meantime, explore the directory to see the network you're joining.
      </p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <Link to="/directory" style={{ background: DARK, color: "#fff", fontWeight: 600, fontSize: "0.9375rem", padding: "0.75rem 1.75rem", borderRadius: "8px", textDecoration: "none" }}>Browse the Directory</Link>
        <Link to="/" style={{ background: "transparent", border: `1.5px solid ${BORDER}`, color: MUTED, fontWeight: 500, fontSize: "0.9375rem", padding: "0.75rem 1.75rem", borderRadius: "8px", textDecoration: "none" }}>Back to home</Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function JoinPage() {
  const [step, setStep]             = useState<0 | 1 | 2 | 3 | "done">(0);
  const [selectedLead, setLead]     = useState<PrmLead | null>(null);
  const [prefilled, setPrefilled]   = useState(false);
  const [selected, setSelected]     = useState<Tier | null>(null);
  const [form, setForm]             = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const tier = TIERS.find(t => t.id === selected) ?? TIERS[0];

  function patch(p: Partial<FormData>) { setForm(prev => ({ ...prev, ...p })); }

  function handleClaim(lead: PrmLead) {
    setLead(lead);
    setPrefilled(true);
    setForm(prev => ({
      ...prev,
      org_name:      lead.org_name      ?? prev.org_name,
      org_type:      inferOrgType(lead.primary_category),
      county:        lead.county        ?? prev.county,
      website:       lead.website       ?? prev.website,
      contact_name:  lead.contact_name  ?? prev.contact_name,
      contact_title: lead.contact_title ?? prev.contact_title,
      contact_phone: lead.main_phone || lead.direct_phone || prev.contact_phone,
      contact_email: lead.email         ?? prev.contact_email,
    }));
    setStep(1);
  }

  function handleNew() {
    setLead(null);
    setPrefilled(false);
    setForm(EMPTY_FORM);
    setStep(1);
  }

  async function handleSubmit() {
    setSubmitting(true);
    const slug = form.org_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) + "-" + Date.now().toString(36);

    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: form.org_name, slug,
        org_type: form.org_type,
        county: form.county, description: form.description,
        website: form.website || null,
        membership_tier: selected,
        payment_status: (selected === "participant" || selected === "anchor") ? "exempt" : "unpaid",
        has_funding_available: form.has_funding,
        claimed_lead_id: selectedLead?.record_id ?? null,
        is_active: false, is_verified: false,
      })
      .select("id")
      .single();

    if (orgError || !orgData) { console.error(orgError); setSubmitting(false); return; }

    const orgId = (orgData as { id: string }).id;

    await supabase.from("contacts").insert({
      organization_id: orgId,
      full_name: form.contact_name, title: form.contact_title || null,
      email: form.contact_email, phone: form.contact_phone,
      is_primary: true, accepts_case_conference: form.accepts_case_conference,
    });

    // Mark the prm_lead as claimed
    if (selectedLead?.record_id) {
      await supabase.from("prm_leads")
        .update({ claim_status: "pending", claimed_by_email: form.contact_email, claimed_at: new Date().toISOString(), promoted_to_directory: true })
        .eq("record_id", selectedLead.record_id);
    }

    // Send confirmation email (fire-and-forget — don't block on failure)
    supabase.functions.invoke("application-confirmation", {
      body: {
        name:       form.contact_name,
        org_name:   form.org_name,
        tier_label: tier.label,
        tier_color: tier.color,
        email:      form.contact_email,
      },
    }).catch(() => {/* non-blocking */});

    setSubmitting(false);
    setStep("done");
  }

  return (
    <>
      <style>{`
        .join-page { background: ${BG}; min-height: 100vh; display: flex; flex-direction: column; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div className="join-page">
        <NavBar />
        <div style={{ background: DARK, padding: "3rem 2rem 2.5rem" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <p style={{ color: TEAL, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.25em", textTransform: "uppercase", margin: "0 0 0.75rem" }}>Network membership</p>
            <h1 style={{ color: "#ffffff", fontSize: "clamp(1.875rem, 3vw, 2.5rem)", fontWeight: 800, margin: "0 0 0.75rem", lineHeight: 1.15 }}>Join the Network</h1>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "1rem", lineHeight: 1.7, margin: 0, maxWidth: 560 }}>
              Lattice is a curated, vetted network. Every organization is reviewed before being listed. Apply below and a TSE coordinator will follow up.
            </p>
          </div>
        </div>

        <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 2rem 5rem", width: "100%", boxSizing: "border-box" }}>
          {step !== "done" && <StepBar step={(step as number) + 1} />}

          {step === 0 && <ClaimSearchStep onClaim={handleClaim} onNew={handleNew} />}
          {step === 1 && <TierPicker selected={selected} onSelect={setSelected} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && selected && <AppForm tier={tier} form={form} prefilled={prefilled} onChange={patch} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
          {step === 3 && selected && <ReviewStep tier={tier} form={form} lead={selectedLead} onBack={() => setStep(2)} onSubmit={handleSubmit} submitting={submitting} />}
          {step === "done" && <SuccessState tier={tier} name={form.contact_name} />}
        </div>
        <Footer />
      </div>
    </>
  );
}
