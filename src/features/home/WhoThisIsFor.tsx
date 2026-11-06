import { Link } from "react-router-dom";

const audience = [
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <circle cx="13" cy="8" r="4" stroke="currentColor" strokeWidth="1.75"/>
        <path d="M5 22c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      </svg>
    ),
    role: "Case Managers",
    tagline: "Close the loop on every referral.",
    body: "Lattice gives you verified contacts, real capacity status, and a TSE coordinator who tracks every pathway — so the connection you make actually lands.",
    cta: "Explore the directory",
    href: "/directory",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M13 3v5M9 7h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
        <path d="M6 11v13h14V11l-7-6-7 6z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    role: "Faith-Based Organizations",
    tagline: "Stay rooted. Stay connected.",
    body: "Lattice helps faith communities stay focused on what they do best while building stronger bridges to providers who can fill the gaps — and direct people to your ministry when it's the right fit.",
    cta: "Join the network",
    href: "/join",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M13 4L4 9l9 5 9-5-9-5z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4 9v9M8 11.5v7c0 1.657 2.239 3 5 3s5-1.343 5-3v-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      </svg>
    ),
    role: "School Social Workers",
    tagline: "Act before the crisis escalates.",
    body: "Schools often see the signs first. Lattice helps school social workers quickly identify trusted community partners and coordinate support before instability deepens.",
    cta: "See how it works",
    href: "/join",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <circle cx="13" cy="13" r="9" stroke="currentColor" strokeWidth="1.75"/>
        <path d="M9 13h8M13 9v8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      </svg>
    ),
    role: "Community Providers",
    tagline: "Get visible. Get referred.",
    body: "If your work helps people move toward stability, your organization belongs here. Lattice makes community providers easier to find, verify, and coordinate with across all systems of care.",
    cta: "List your organization",
    href: "/join",
  },
];

export default function WhoThisIsFor() {
  return (
    <>
      <style>{`
        .who-section {
          background: #F7F9F8;
          padding: 7rem 2rem;
        }
        .who-inner {
          max-width: 1280px;
          margin: 0 auto;
        }
        .who-eyebrow {
          color: #2A9D8F;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin: 0 0 0.875rem;
        }
        .who-h2 {
          color: #1A2B35;
          font-size: clamp(1.875rem, 3.5vw, 2.5rem);
          font-weight: 800;
          line-height: 1.15;
          margin: 0;
          max-width: 540px;
        }
        .who-sub {
          color: #5C7380;
          font-size: 1rem;
          line-height: 1.75;
          max-width: 520px;
          margin: 1rem 0 0;
        }
        .who-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          margin-top: 4rem;
        }
        .who-card {
          background: #ffffff;
          border: 1px solid #E2E8E6;
          border-top: 3px solid #2A9D8F;
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 0;
          transition: box-shadow 0.2s;
        }
        .who-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        .who-card-icon {
          color: #2A9D8F;
          margin-bottom: 1rem;
        }
        .who-card-role {
          color: #1A2B35;
          font-size: 1rem;
          font-weight: 800;
          margin: 0 0 0.25rem;
        }
        .who-card-tagline {
          color: #2A9D8F;
          font-size: 0.8rem;
          font-weight: 600;
          margin: 0 0 1rem;
        }
        .who-card-divider {
          border: none;
          border-top: 1px solid #E2E8E6;
          margin: 0 0 1rem;
        }
        .who-card-body {
          color: #374151;
          font-size: 0.9rem;
          line-height: 1.75;
          margin: 0 0 1.5rem;
          flex: 1;
        }
        .who-card-link {
          color: #2A9D8F;
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          border-bottom: 1px solid transparent;
          transition: border-color 0.15s;
          margin-top: auto;
          align-self: flex-start;
        }
        .who-card-link:hover { border-bottom-color: #2A9D8F; }
        @media (max-width: 1100px) {
          .who-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 540px) {
          .who-grid { grid-template-columns: 1fr; }
          .who-section { padding: 5rem 1.25rem; }
        }
      `}</style>

      <section className="who-section">
        <div className="who-inner">
          <p className="who-eyebrow">Who Lattice Serves</p>
          <h2 className="who-h2">The right network for the right people.</h2>
          <p className="who-sub">
            Lattice is built for the practitioners, ministries, schools, and
            providers who coordinate care across Northwest Georgia every day.
          </p>

          <div className="who-grid">
            {audience.map((a) => (
              <div key={a.role} className="who-card">
                <div className="who-card-icon">{a.icon}</div>
                <p className="who-card-role">{a.role}</p>
                <p className="who-card-tagline">{a.tagline}</p>
                <hr className="who-card-divider" />
                <p className="who-card-body">{a.body}</p>
                <Link to={a.href} className="who-card-link">
                  {a.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
