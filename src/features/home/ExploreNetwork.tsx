import { Link } from "react-router-dom";

const categories = [
  {
    label: "Housing & Shelter",
    desc: "Emergency, transitional, and permanent housing supports",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M4 12L14 4l10 8v12a1 1 0 01-1 1H5a1 1 0 01-1-1V12z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 25V15h8v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "Food & Nutrition",
    desc: "Pantries, meal programs, and nutrition assistance",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 4v20M9 8c0 2.761 2.239 5 5 5s5-2.239 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.75"/>
      </svg>
    ),
  },
  {
    label: "Medical & Health",
    desc: "Clinics, behavioral health, and care coordination",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="6" width="20" height="17" rx="2" stroke="currentColor" strokeWidth="1.75"/>
        <path d="M14 10v7M10.5 13.5h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
        <path d="M9 6V5a1 1 0 011-1h8a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.75"/>
      </svg>
    ),
  },
  {
    label: "Education & Schools",
    desc: "School social work, tutoring, and youth supports",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 5L4 10l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4 10v8M8 12v7c0 1.657 2.686 3 6 3s6-1.343 6-3v-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "Faith-Based Orgs",
    desc: "Ministries, benevolence programs, and community care",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 4v8M10 8h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
        <path d="M7 12v12h14V12l-7-5-7 5z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "Government & Services",
    desc: "County programs, benefits navigation, and legal aid",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M4 24h20M6 24V12M22 24V12M4 12h20M14 5L4 12h20L14 5z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="11" y="17" width="6" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.75"/>
      </svg>
    ),
  },
];

export default function ExploreNetwork() {
  return (
    <>
      <style>{`
        .explore-section {
          background: #F7F9F8;
          padding: 7rem 2rem;
        }
        .explore-inner {
          max-width: 1280px;
          margin: 0 auto;
        }
        .explore-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 2rem;
          flex-wrap: wrap;
          margin-bottom: 3rem;
        }
        .explore-title-block {}
        .explore-eyebrow {
          color: #2A9D8F;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin: 0 0 0.75rem;
        }
        .explore-h2 {
          color: #1A2B35;
          font-size: clamp(1.875rem, 3.5vw, 2.5rem);
          font-weight: 800;
          line-height: 1.15;
          margin: 0;
        }
        .explore-browse-link {
          color: #2A9D8F;
          font-size: 0.9375rem;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          border-bottom: 1px solid transparent;
          transition: border-color 0.15s;
        }
        .explore-browse-link:hover { border-bottom-color: #2A9D8F; }
        .explore-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: #E2E8E6;
          border: 1px solid #E2E8E6;
        }
        .explore-tile {
          background: #ffffff;
          padding: 2rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          text-decoration: none;
          transition: background 0.15s;
          cursor: pointer;
        }
        .explore-tile:hover { background: #F0F4F3; }
        .explore-tile-icon {
          color: #2A9D8F;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(42,157,143,0.1);
          border-radius: 2px;
          flex-shrink: 0;
        }
        .explore-tile-label {
          color: #1A2B35;
          font-size: 1rem;
          font-weight: 700;
          margin: 0;
        }
        .explore-tile-desc {
          color: #5C7380;
          font-size: 0.875rem;
          line-height: 1.6;
          margin: 0;
        }
        @media (max-width: 900px) {
          .explore-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 540px) {
          .explore-grid { grid-template-columns: 1fr; }
          .explore-section { padding: 5rem 1.25rem; }
        }
      `}</style>

      <section className="explore-section">
        <div className="explore-inner">
          <div className="explore-header">
            <div className="explore-title-block">
              <p className="explore-eyebrow">Explore the Network</p>
              <h2 className="explore-h2">Find providers<br />by what they do.</h2>
            </div>
            <Link to="/directory" className="explore-browse-link">
              Browse all providers →
            </Link>
          </div>

          <div className="explore-grid">
            {categories.map((cat) => (
              <Link key={cat.label} to="/directory" className="explore-tile">
                <div className="explore-tile-icon">{cat.icon}</div>
                <p className="explore-tile-label">{cat.label}</p>
                <p className="explore-tile-desc">{cat.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
