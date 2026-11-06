import { Link } from "react-router-dom";

const tiers = [
  {
    name: "Community",
    price: "Free",
    highlight: false,
    features: [
      "Listed in the verified directory",
      "Receive facilitated connection requests",
      "Basic organizational profile",
      "Network email updates",
    ],
  },
  {
    name: "Partner",
    price: "$25 / mo",
    highlight: true,
    foundingBadge: true,
    features: [
      "Everything in Community",
      "Full member dashboard",
      "Service listing management",
      "Coordination request tracking",
      "Founding member recognition",
    ],
  },
  {
    name: "Network Leader",
    price: "$75 / mo",
    highlight: false,
    features: [
      "Everything in Partner",
      "Priority coordinator support",
      "Early access to new features",
      "Outcomes data access (coming soon)",
      "Network leadership listing",
    ],
  },
];

export default function WhyLattice() {
  return (
    <>
      <style>{`
        .membership-section {
          background: #ffffff;
          padding: 7rem 2rem;
        }
        .membership-inner {
          max-width: 1280px;
          margin: 0 auto;
        }
        .membership-top {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem;
          margin-bottom: 4rem;
          align-items: start;
        }
        .membership-eyebrow {
          color: #2A9D8F;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin: 0 0 0.875rem;
        }
        .membership-h2 {
          color: #1A2B35;
          font-size: clamp(1.875rem, 3.5vw, 2.5rem);
          font-weight: 800;
          line-height: 1.15;
          margin: 0;
        }
        .membership-founding {
          border: 1px solid #E2E8E6;
          border-left: 4px solid #E9A26B;
          background: #FFFAF5;
          padding: 1.5rem 1.75rem;
          border-radius: 2px;
        }
        .membership-founding-label {
          color: #C47D3B;
          font-size: 0.675rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin: 0 0 0.5rem;
        }
        .membership-founding-text {
          color: #1A2B35;
          font-size: 0.9375rem;
          line-height: 1.7;
          margin: 0;
        }
        .membership-founding-text strong {
          color: #C47D3B;
        }
        .membership-stats-row {
          display: flex;
          gap: 2.5rem;
          margin-top: 1.75rem;
          flex-wrap: wrap;
        }
        .membership-stat-item {}
        .membership-stat-num {
          color: #1A2B35;
          font-size: 2rem;
          font-weight: 800;
          margin: 0;
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .membership-stat-label {
          color: #5C7380;
          font-size: 0.8rem;
          margin: 0.3rem 0 0;
        }
        .tier-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }
        .tier-card {
          border: 1px solid #E2E8E6;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: box-shadow 0.2s;
        }
        .tier-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.07); }
        .tier-card.highlighted {
          border-color: #2A9D8F;
          border-top: 3px solid #2A9D8F;
        }
        .tier-founding-badge {
          position: absolute;
          top: -1px;
          right: 1.5rem;
          background: #E9A26B;
          color: #ffffff;
          font-size: 0.625rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0.3rem 0.75rem;
          border-radius: 0 0 4px 4px;
        }
        .tier-name {
          color: #1A2B35;
          font-size: 1.0625rem;
          font-weight: 800;
          margin: 0 0 0.375rem;
        }
        .tier-price {
          color: #2A9D8F;
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0 0 1.25rem;
          letter-spacing: -0.02em;
        }
        .tier-price.free {
          color: #1A2B35;
        }
        .tier-divider {
          border: none;
          border-top: 1px solid #E2E8E6;
          margin: 0 0 1.25rem;
        }
        .tier-features {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          flex: 1;
        }
        .tier-features li {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          color: #374151;
          font-size: 0.875rem;
          line-height: 1.55;
        }
        .tier-check {
          width: 16px;
          height: 16px;
          background: rgba(42,157,143,0.12);
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
        }
        .tier-cta {
          margin-top: 2rem;
          display: block;
          text-align: center;
          padding: 0.875rem;
          font-size: 0.9375rem;
          font-weight: 700;
          text-decoration: none;
          border-radius: 2px;
          border: 1.5px solid #1E3A4A;
          color: #1E3A4A;
          background: transparent;
          transition: background 0.15s, color 0.15s;
        }
        .tier-cta:hover {
          background: #1E3A4A;
          color: #ffffff;
        }
        .tier-cta.primary {
          background: #2A9D8F;
          border-color: #2A9D8F;
          color: #ffffff;
        }
        .tier-cta.primary:hover { background: #248a7d; border-color: #248a7d; }
        @media (max-width: 1000px) {
          .membership-top { grid-template-columns: 1fr; gap: 2rem; }
          .tier-grid { grid-template-columns: 1fr; gap: 1rem; }
          .membership-section { padding: 5rem 1.25rem; }
        }
      `}</style>

      <section className="membership-section" id="why">
        <div className="membership-inner">
          <div className="membership-top">
            <div>
              <p className="membership-eyebrow">Membership</p>
              <h2 className="membership-h2">Join the network that keeps coordination moving.</h2>
              <div className="membership-stats-row">
                <div className="membership-stat-item">
                  <p className="membership-stat-num">800+</p>
                  <p className="membership-stat-label">Providers in the network</p>
                </div>
                <div className="membership-stat-item">
                  <p className="membership-stat-num">15</p>
                  <p className="membership-stat-label">Counties covered</p>
                </div>
                <div className="membership-stat-item">
                  <p className="membership-stat-num">Live</p>
                  <p className="membership-stat-label">Platform status</p>
                </div>
              </div>
            </div>

            <div className="membership-founding">
              <p className="membership-founding-label">Founding Member Window</p>
              <p className="membership-founding-text">
                Lattice is newly launched and the founding member window is open.
                Organizations that join now will be listed with a{" "}
                <strong>Founding Member</strong> badge and get permanent recognition
                as early builders of this network. Pricing is locked for founding
                members as long as the membership remains active.
              </p>
            </div>
          </div>

          <div className="tier-grid">
            {tiers.map((t) => (
              <div key={t.name} className={`tier-card${t.highlight ? " highlighted" : ""}`}>
                {t.foundingBadge && (
                  <span className="tier-founding-badge">Founding Member</span>
                )}
                <p className="tier-name">{t.name}</p>
                <p className={`tier-price${t.price === "Free" ? " free" : ""}`}>{t.price}</p>
                <hr className="tier-divider" />
                <ul className="tier-features">
                  {t.features.map((f) => (
                    <li key={f}>
                      <span className="tier-check">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3.5 6L6.5 2.5" stroke="#2A9D8F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/join"
                  className={`tier-cta${t.highlight ? " primary" : ""}`}
                >
                  {t.price === "Free" ? "Join for Free" : "Apply to Join"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
