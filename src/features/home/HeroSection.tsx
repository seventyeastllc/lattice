import { Link, useNavigate } from "react-router-dom";

const DOT_TEXTURE = `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`;

export default function HeroSection() {
  const navigate = useNavigate();
  return (
    <>
      <style>{`
        .hero-section {
          background: #1E3A4A;
          background-image: ${DOT_TEXTURE};
          background-size: 24px 24px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 7rem 2rem 6rem;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }
        .hero-eyebrow {
          color: #2A9D8F;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin: 0 0 1.25rem;
        }
        .hero-headline {
          color: #ffffff;
          font-size: clamp(2.75rem, 5.5vw, 4.5rem);
          font-weight: 800;
          line-height: 1.08;
          margin: 0;
          max-width: 820px;
        }
        .hero-headline em {
          font-style: normal;
          color: #2A9D8F;
        }
        .hero-sub {
          color: rgba(255,255,255,0.68);
          font-size: 1.125rem;
          line-height: 1.8;
          max-width: 580px;
          margin: 1.75rem auto 0;
        }
        .hero-search-bar {
          margin: 3rem auto 0;
          max-width: 560px;
          width: 100%;
          display: flex;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 4px;
          overflow: hidden;
          pointer-events: none;
        }
        .hero-search-bar input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          padding: 0.875rem 1.125rem;
          font-size: 0.9375rem;
          color: rgba(255,255,255,0.55);
          font-family: inherit;
        }
        .hero-search-bar button {
          background: #2A9D8F;
          border: none;
          color: #fff;
          font-size: 0.875rem;
          font-weight: 700;
          padding: 0 1.5rem;
          cursor: pointer;
          font-family: inherit;
          flex-shrink: 0;
        }
        .hero-search-label {
          margin: 0.625rem auto 0;
          font-size: 0.75rem;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.04em;
        }
        .hero-ctas {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 2.5rem;
          justify-content: center;
        }
        .hero-cta-primary {
          background: #2A9D8F;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.9375rem;
          padding: 1rem 2.25rem;
          text-decoration: none;
          display: inline-block;
          border-radius: 2px;
          transition: background 0.15s;
        }
        .hero-cta-primary:hover { background: #248a7d; }
        .hero-cta-secondary {
          background: transparent;
          color: #ffffff;
          font-weight: 600;
          font-size: 0.9375rem;
          padding: 1rem 2.25rem;
          border: 1px solid rgba(255,255,255,0.35);
          cursor: pointer;
          font-family: inherit;
          border-radius: 2px;
          transition: border-color 0.15s;
        }
        .hero-cta-secondary:hover { border-color: #ffffff; }
        .hero-scroll-hint {
          position: absolute;
          bottom: 2.25rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.375rem;
          color: rgba(255,255,255,0.3);
          font-size: 0.6875rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
        @keyframes bounce-down {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }
        .hero-scroll-arrow {
          animation: bounce-down 1.8s ease-in-out infinite;
        }
        @media (max-width: 600px) {
          .hero-section { padding: 5.5rem 1.25rem 5rem; }
          .hero-ctas { flex-direction: column; align-items: stretch; }
          .hero-cta-primary, .hero-cta-secondary { text-align: center; }
        }
      `}</style>

      <section className="hero-section">
        <p className="hero-eyebrow">Coordination Network · Northwest Georgia</p>

        <h1 className="hero-headline">
          Connected<br />
          <em>by design.</em>
        </h1>

        <p className="hero-sub">
          Lattice is the governed coordination network for Northwest Georgia —
          a verified directory of named contacts across nonprofits, faith
          communities, schools, and healthcare providers, ready to coordinate
          around the people you serve.
        </p>

        {/* Decorative search bar — not functional, signals intent */}
        <div className="hero-search-bar" aria-hidden="true">
          <input readOnly placeholder="Search the network — housing, food, medical..." tabIndex={-1} />
          <button tabIndex={-1}>Search</button>
        </div>
        <p className="hero-search-label">800+ verified providers across 15 counties</p>

        <div className="hero-ctas">
          <Link to="/directory" className="hero-cta-primary">
            Explore the Network
          </Link>
          <button className="hero-cta-secondary" onClick={() => navigate("/join")}>
            Join as a Member
          </button>
        </div>

        <div className="hero-scroll-hint" aria-hidden="true">
          <span>Scroll</span>
          <span className="hero-scroll-arrow">
            <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
              <path d="M1 1l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
      </section>
    </>
  );
}
