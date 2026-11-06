import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useKnowledgeResources } from "@/hooks/useKnowledgeResources";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";

const NAVY   = "#1E3A4A";
const TEAL   = "#2A9D8F";
const BG     = "#F7F9F8";
const BORDER = "#E2E8E6";
const TEXT   = "#1A2B35";
const MUTED  = "#5C7380";
const WHITE  = "#ffffff";

const CATEGORIES = [
  { value: "all",                  label: "All Resources" },
  { value: "templates_checklists", label: "Templates & Checklists" },
  { value: "navigation_guides",    label: "Navigation Guides" },
  { value: "learning_resources",   label: "Learning Resources" },
  { value: "playbooks",            label: "Playbooks" },
];

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  templates_checklists: { bg: "rgba(42,157,143,0.12)", color: TEAL },
  navigation_guides:    { bg: "rgba(30,58,74,0.1)",   color: NAVY },
  learning_resources:   { bg: "rgba(233,162,107,0.15)", color: "#B45309" },
  playbooks:            { bg: "rgba(92,115,128,0.12)", color: MUTED },
};

export default function KnowledgePage() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data: resources = [], isLoading, isError } = useKnowledgeResources(
    activeCategory !== "all" ? activeCategory : undefined
  );

  if (!user) return <Navigate to="/login" replace />;

  const filtered = resources.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column" }}>
      <NavBar />

      {/* Header */}
      <div style={{ background: NAVY, padding: "2.5rem 2rem 2rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <p style={{ color: TEAL, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>My Workspace</p>
          <h1 style={{ color: WHITE, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, margin: "0 0 0.375rem", lineHeight: 1.15 }}>Tools & Knowledge</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9375rem", margin: 0 }}>Guides, templates, and resources to support your coordination work.</p>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 1200, margin: "0 auto", padding: "2rem", width: "100%", boxSizing: "border-box" }}>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              style={{
                padding: "0.4rem 1rem", borderRadius: "20px", border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: "0.8125rem", fontFamily: "inherit",
                background: activeCategory === cat.value ? NAVY : WHITE,
                color: activeCategory === cat.value ? WHITE : MUTED,
                boxShadow: activeCategory === cat.value ? "none" : `0 0 0 1px ${BORDER}`,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 420, marginBottom: "2rem" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="6.5" cy="6.5" r="5.25" stroke={MUTED} strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search resources…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.875rem 0.5rem 2.25rem", border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "0.875rem", color: TEXT, background: WHITE, outline: "none", fontFamily: "inherit" }}
          />
        </div>

        {/* Results */}
        {isLoading && <p style={{ color: MUTED, fontSize: "0.875rem" }}>Loading resources…</p>}
        {isError && <p style={{ color: "#DC2626", fontSize: "0.875rem" }}>Unable to load resources. Please try again.</p>}

        {!isLoading && !isError && filtered.length === 0 && (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "3rem 2rem", textAlign: "center" }}>
            <p style={{ fontWeight: 700, color: TEXT, margin: "0 0 0.5rem" }}>No resources found</p>
            <p style={{ color: MUTED, fontSize: "0.9rem", margin: 0 }}>Check back as the library grows.</p>
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {filtered.map(resource => {
              const catColor = CATEGORY_COLORS[resource.category] ?? { bg: "rgba(92,115,128,0.1)", color: MUTED };
              const catLabel = CATEGORIES.find(c => c.value === resource.category)?.label ?? resource.category;
              return (
                <div key={resource.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "1.375rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  <span style={{ display: "inline-block", background: catColor.bg, color: catColor.color, fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "3px", letterSpacing: "0.08em", textTransform: "uppercase", alignSelf: "flex-start" }}>
                    {catLabel}
                  </span>
                  <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.9375rem", margin: 0, lineHeight: 1.3 }}>{resource.title}</p>
                  {resource.description && (
                    <p style={{ color: MUTED, fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>{resource.description}</p>
                  )}
                  <div style={{ marginTop: "auto", paddingTop: "0.5rem" }}>
                    {resource.url ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: TEAL, fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}
                      >
                        Open resource →
                      </a>
                    ) : (
                      <span style={{ color: MUTED, fontSize: "0.8125rem" }}>Coming soon</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && !isError && (
          <p style={{ color: MUTED, fontSize: "0.75rem", marginTop: "2rem", textAlign: "center", lineHeight: 1.6 }}>
            This library contains sample content for development. Official resources will be published before public launch.
          </p>
        )}
      </div>

      <Footer />
    </div>
  );
}
