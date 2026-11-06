import { Link } from "react-router-dom";

const SAGE = "#F0F4F2";
const TEAL = "#2A9D8F";
const DARK = "#102D3B";
const NAVY = "#1E3A4A";
const TEXT = "#1A2B35";
const MUTED = "#5C7380";
const WHITE = "#ffffff";

function GeometricShapes() {
  return (
    <svg
      viewBox="0 0 600 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden="true"
    >
      {/* Large navy diagonal rectangle */}
      <rect x="380" y="-40" width="280" height="180" rx="6" transform="rotate(18 380 -40)" fill={NAVY} opacity="0.08" />
      {/* Teal accent rectangle */}
      <rect x="460" y="60" width="160" height="90" rx="4" transform="rotate(18 460 60)" fill={TEAL} opacity="0.12" />
      {/* Blue-grey small rectangle */}
      <rect x="30" y="300" width="100" height="60" rx="4" transform="rotate(-12 30 300)" fill="#264F6A" opacity="0.07" />
      {/* Green dot cluster */}
      <circle cx="520" cy="380" r="48" fill="#3D9970" opacity="0.07" />
      <circle cx="560" cy="420" r="28" fill={TEAL} opacity="0.09" />
      {/* Small teal square */}
      <rect x="70" y="60" width="40" height="40" rx="3" transform="rotate(25 70 60)" fill={TEAL} opacity="0.08" />
    </svg>
  );
}

function CardResourceDirectory() {
  const tags = ["Housing", "Emergency", "Atlanta"];
  const results = [
    { name: "SafeHaven Family Shelter", tag: "Housing Stability", teal: true },
    { name: "Metro Food Bank Network", tag: "Food & Basic Needs", teal: false },
    { name: "Fulton Co. Health Access", tag: "Health & Wellness", teal: false },
  ];
  return (
    <div style={{ background: WHITE, borderRadius: 12, boxShadow: "0 8px 32px rgba(16,45,59,0.13)", padding: "1.25rem", width: 300, minWidth: 260 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: TEXT, letterSpacing: "0.08em", textTransform: "uppercase" }}>Resource Directory</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6.5" cy="6.5" r="4" stroke={MUTED} strokeWidth="1.4"/><path d="M9.5 9.5L12 12" stroke={MUTED} strokeWidth="1.4" strokeLinecap="round"/></svg>
      </div>
      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "0.875rem" }}>
        {tags.map(t => (
          <span key={t} style={{ background: "#EEF7F5", color: TEAL, fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: 20 }}>{t}</span>
        ))}
      </div>
      {/* Result rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {results.map(r => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.625rem", background: r.teal ? "#EEF7F5" : "#F8FAFA", borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: TEXT, lineHeight: 1.3 }}>{r.name}</div>
              <div style={{ fontSize: "0.65rem", color: MUTED, marginTop: 2 }}>{r.tag}</div>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: r.teal ? TEAL : "#D1E8E4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 5h4M5 3l2 2-2 2" stroke={r.teal ? WHITE : TEAL} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardResourceProfile() {
  const tabs = ["Overview", "Services", "Connect"];
  const services = ["Emergency Housing Placement", "Rapid Rehousing Assistance", "Utility Stabilization"];
  return (
    <div style={{ background: WHITE, borderRadius: 12, boxShadow: "0 12px 40px rgba(16,45,59,0.16)", padding: "1.25rem", width: 288, minWidth: 250 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.875rem" }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EEF7F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="3" width="12" height="12" rx="2" stroke={TEAL} strokeWidth="1.5"/><path d="M6 9h6M9 6v6" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>SafeHaven Family Shelter</div>
          <div style={{ fontSize: "0.65rem", color: MUTED, marginTop: 1 }}>Housing Stability · Atlanta, GA</div>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${SAGE}`, marginBottom: "0.75rem" }}>
        {tabs.map((t, i) => (
          <span key={t} style={{ fontSize: "0.7rem", fontWeight: i === 1 ? 700 : 500, color: i === 1 ? TEAL : MUTED, padding: "0.3rem 0.6rem", borderBottom: i === 1 ? `2px solid ${TEAL}` : "2px solid transparent", cursor: "default" }}>{t}</span>
        ))}
      </div>
      {/* Key services label */}
      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Key Services</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {services.map(s => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: TEAL, flexShrink: 0 }} />
            <span style={{ fontSize: "0.7rem", color: TEXT, lineHeight: 1.4 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardToolsUpdates() {
  const rows = [
    { icon: "📋", label: "Eligibility Screener", sub: "Updated 2 days ago", badge: "Tool" },
    { icon: "📢", label: "Winter Shelter Capacity Notice", sub: "Network · Nov 5", badge: "Update" },
    { icon: "🔗", label: "Connection Request Sent", sub: "SafeHaven · Pending", badge: "Network" },
  ];
  return (
    <div style={{ background: WHITE, borderRadius: 12, boxShadow: "0 6px 24px rgba(16,45,59,0.10)", padding: "1.125rem", width: 272, minWidth: 240 }}>
      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: TEXT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.875rem" }}>Tools & Updates</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0.625rem", background: "#F8FAFA", borderRadius: 8 }}>
            <span style={{ fontSize: "1rem", lineHeight: 1 }}>{r.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
              <div style={{ fontSize: "0.63rem", color: MUTED, marginTop: 1 }}>{r.sub}</div>
            </div>
            <span style={{ fontSize: "0.6rem", fontWeight: 700, color: TEAL, background: "#EEF7F5", padding: "0.15rem 0.45rem", borderRadius: 10, flexShrink: 0 }}>{r.badge}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <>
      <style>{`
        .hero-c3 {
          background: ${SAGE};
          position: relative;
          overflow: hidden;
          padding: 5rem 2rem 5rem;
          box-sizing: border-box;
        }
        .hero-c3-inner {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 46% 54%;
          align-items: center;
          gap: 3rem;
          position: relative;
          z-index: 2;
        }
        .hero-c3-cards {
          position: relative;
          height: 440px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hero-c3-card-a {
          position: absolute;
          top: 0;
          left: 20px;
          z-index: 3;
        }
        .hero-c3-card-b {
          position: absolute;
          top: 60px;
          left: 60px;
          z-index: 4;
        }
        .hero-c3-card-c {
          position: absolute;
          bottom: 0;
          right: 0;
          z-index: 2;
        }
        @media (max-width: 860px) {
          .hero-c3-inner {
            grid-template-columns: 1fr;
            gap: 2.5rem;
          }
          .hero-c3-cards {
            height: 380px;
          }
          .hero-c3-card-a { left: 0; }
          .hero-c3-card-b { left: 24px; }
          .hero-c3-card-c { right: 0; }
        }
        @media (max-width: 540px) {
          .hero-c3 { padding: 3.5rem 1.25rem 3.5rem; }
          .hero-c3-cards { height: 320px; }
        }
      `}</style>

      <section className="hero-c3">
        <GeometricShapes />

        <div className="hero-c3-inner">
          {/* Left column — copy */}
          <div>
            <p style={{ color: TEAL, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 1.25rem" }}>
              Visibility · Access · Coordination · Capacity
            </p>

            <h1 style={{ color: TEXT, fontSize: "clamp(2.25rem,4.5vw,3.5rem)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 1.5rem", maxWidth: 500 }}>
              Access starts with{" "}
              <span style={{ position: "relative", display: "inline-block" }}>
                visibility.
                <svg viewBox="0 0 160 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", bottom: -6, left: 0, width: "100%", height: 14 }} aria-hidden="true">
                  <path d="M4 10 Q40 3 80 8 Q120 13 156 6" stroke={TEAL} strokeWidth="3" strokeLinecap="round" fill="none"/>
                </svg>
              </span>
            </h1>

            <p style={{ color: MUTED, fontSize: "1.0625rem", lineHeight: 1.75, margin: "0 0 2rem", maxWidth: 420 }}>
              The coordination platform for Georgia's community support network.
              One place to discover resources, navigate eligibility, access practical
              tools, and strengthen connections among the organizations supporting
              individuals and families.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <Link
                to="/directory"
                style={{ background: DARK, color: WHITE, fontSize: "0.9375rem", fontWeight: 700, padding: "0.75rem 2rem", borderRadius: 6, textDecoration: "none" }}
              >
                Explore the Network
              </Link>
              <Link
                to="/join"
                style={{ background: "transparent", color: DARK, fontSize: "0.9375rem", fontWeight: 600, padding: "0.75rem 2rem", borderRadius: 6, textDecoration: "none", border: `1.5px solid ${DARK}` }}
              >
                Join the Network
              </Link>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "1.75rem" }}>
              <img src="/Lattice-icon-transparent.png" alt="" style={{ height: 20, width: 20, objectFit: "contain", opacity: 0.5 }} />
              <span style={{ fontSize: "0.75rem", color: MUTED, fontWeight: 500 }}>800+ organizations mapped across Georgia</span>
            </div>
          </div>

          {/* Right column — illustrative cards */}
          <div className="hero-c3-cards" aria-hidden="true">
            <div className="hero-c3-card-a"><CardResourceDirectory /></div>
            <div className="hero-c3-card-b"><CardResourceProfile /></div>
            <div className="hero-c3-card-c"><CardToolsUpdates /></div>
          </div>
        </div>
      </section>
    </>
  );
}
