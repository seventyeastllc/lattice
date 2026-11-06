const pillars = [
  {
    badge: "Live",
    badgeColor: "#2A9D8F",
    title: "Verified Directory",
    body: "Every listing includes a named contact, current service availability, and coverage area — maintained by the network, not scraped from outdated websites.",
  },
  {
    badge: "Live",
    badgeColor: "#2A9D8F",
    title: "Facilitated Connections",
    body: "Connection requests are triaged by a live TSE coordinator before reaching a partner — no cold calls, no dropped referrals, no unanswered inboxes.",
  },
  {
    badge: "Live",
    badgeColor: "#2A9D8F",
    title: "Human-in-the-Loop",
    body: "Every pathway is tracked by a coordinator. The measure of success isn't whether the referral was sent — it's whether the person's situation actually changed.",
  },
  {
    badge: "Coming Soon",
    badgeColor: "#E9A26B",
    title: "Outcomes Tracking",
    body: "Dashboard-level visibility into connection outcomes, referral velocity, and coordination patterns across the network — in development.",
  },
];

export default function HowItWorks() {
  return (
    <>
      <style>{`
        .how-section {
          background: #ffffff;
          padding: 7rem 2rem;
        }
        .how-inner {
          max-width: 1280px;
          margin: 0 auto;
        }
        .how-eyebrow {
          color: #2A9D8F;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin: 0 0 0.875rem;
        }
        .how-h2 {
          color: #1A2B35;
          font-size: clamp(1.875rem, 3.5vw, 2.5rem);
          font-weight: 800;
          line-height: 1.15;
          margin: 0;
          max-width: 540px;
        }
        .how-sub {
          color: #5C7380;
          font-size: 1rem;
          line-height: 1.75;
          max-width: 520px;
          margin: 1rem 0 0;
        }
        .how-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          margin-top: 4rem;
        }
        .how-card {
          border: 1px solid #E2E8E6;
          border-top: 3px solid #2A9D8F;
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          background: #ffffff;
          position: relative;
          transition: box-shadow 0.2s;
        }
        .how-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        .how-card.soon { border-top-color: #E9A26B; }
        .how-badge {
          display: inline-flex;
          align-items: center;
          font-size: 0.675rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0.25rem 0.625rem;
          border-radius: 2px;
          align-self: flex-start;
        }
        .how-badge.live {
          background: rgba(42,157,143,0.12);
          color: #2A9D8F;
        }
        .how-badge.soon {
          background: rgba(233,162,107,0.14);
          color: #C47D3B;
        }
        .how-card-title {
          color: #1A2B35;
          font-size: 1.0625rem;
          font-weight: 700;
          margin: 0;
          line-height: 1.3;
        }
        .how-card-body {
          color: #5C7380;
          font-size: 0.9rem;
          line-height: 1.75;
          margin: 0;
          flex: 1;
        }
        @media (max-width: 1100px) {
          .how-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 540px) {
          .how-grid { grid-template-columns: 1fr; }
          .how-section { padding: 5rem 1.25rem; }
        }
      `}</style>

      <section className="how-section">
        <div className="how-inner">
          <p className="how-eyebrow">The Lattice Approach</p>
          <h2 className="how-h2">Built for coordination that actually works.</h2>
          <p className="how-sub">
            Four pillars that separate Lattice from outdated resource lists
            and referral-and-forget software.
          </p>

          <div className="how-grid">
            {pillars.map((p) => {
              const isSoon = p.badge === "Coming Soon";
              return (
                <div key={p.title} className={`how-card${isSoon ? " soon" : ""}`}>
                  <span className={`how-badge ${isSoon ? "soon" : "live"}`}>{p.badge}</span>
                  <h3 className="how-card-title">{p.title}</h3>
                  <p className="how-card-body">{p.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
