import { Link, useNavigate } from "react-router-dom";

const DOT_TEXTURE = `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`;

export default function FoundationSection() {
  const navigate = useNavigate();
  return (
    <>
      <style>{`
        .foundation-section {
          background: #1E3A4A;
          background-image: ${DOT_TEXTURE};
          background-size: 24px 24px;
          padding: 7rem 2rem 5rem;
        }
        .foundation-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 5rem;
          align-items: start;
        }
        .foundation-eyebrow {
          color: #2A9D8F;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin: 0 0 0.875rem;
        }
        .foundation-h2 {
          color: #ffffff;
          font-size: clamp(1.875rem, 3vw, 2.5rem);
          font-weight: 800;
          line-height: 1.15;
          margin: 0;
        }
        .foundation-body {
          color: rgba(255,255,255,0.65);
          font-size: 1rem;
          line-height: 1.8;
          margin: 1.25rem 0 0;
        }
        .foundation-ctas {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 2.5rem;
        }
        .foundation-cta-primary {
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
        .foundation-cta-primary:hover { background: #248a7d; }
        .foundation-cta-secondary {
          background: transparent;
          color: #ffffff;
          font-weight: 600;
          font-size: 0.9375rem;
          padding: 1rem 2.25rem;
          border: 1px solid rgba(255,255,255,0.3);
          cursor: pointer;
          font-family: inherit;
          border-radius: 2px;
          transition: border-color 0.15s;
        }
        .foundation-cta-secondary:hover { border-color: #ffffff; }
        .foundation-tse-block {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
          padding: 2rem;
        }
        .foundation-tse-label {
          color: #2A9D8F;
          font-size: 0.675rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin: 0 0 1rem;
        }
        .foundation-tse-name {
          color: #ffffff;
          font-size: 1.125rem;
          font-weight: 800;
          margin: 0 0 0.75rem;
        }
        .foundation-tse-body {
          color: rgba(255,255,255,0.60);
          font-size: 0.9rem;
          line-height: 1.75;
          margin: 0;
        }
        .foundation-tse-link {
          display: inline-block;
          margin-top: 1.25rem;
          color: #2A9D8F;
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.15s;
        }
        .foundation-tse-link:hover { border-bottom-color: #2A9D8F; }
        .foundation-hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.08);
          margin: 5rem 0 2rem;
          max-width: 1280px;
          margin-left: auto;
          margin-right: auto;
        }
        .foundation-footer-row {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 0 0 2rem;
        }
        .foundation-footer-copy {
          color: rgba(255,255,255,0.3);
          font-size: 0.8rem;
          margin: 0;
        }
        .foundation-footer-links {
          display: flex;
          gap: 1.5rem;
        }
        .foundation-footer-link {
          color: rgba(255,255,255,0.4);
          font-size: 0.8rem;
          text-decoration: none;
          transition: color 0.15s;
        }
        .foundation-footer-link:hover { color: rgba(255,255,255,0.75); }
        @media (max-width: 900px) {
          .foundation-inner { grid-template-columns: 1fr; gap: 3rem; }
          .foundation-section { padding: 5rem 1.25rem 3.5rem; }
        }
      `}</style>

      <section className="foundation-section">
        <div className="foundation-inner">
          <div>
            <p className="foundation-eyebrow">Ready to Coordinate</p>
            <h2 className="foundation-h2">Your network is waiting.<br />Join it today.</h2>
            <p className="foundation-body">
              Lattice is live and accepting member organizations across Northwest Georgia.
              Whether you're a case manager looking for verified partners, a faith community
              wanting to serve better, or a provider ready to be found — your place is here.
            </p>
            <div className="foundation-ctas">
              <Link to="/join" className="foundation-cta-primary">
                Join the Network
              </Link>
              <button className="foundation-cta-secondary" onClick={() => navigate("/directory")}>
                Browse the Directory
              </button>
            </div>
          </div>

          <div className="foundation-tse-block">
            <p className="foundation-tse-label">Powered By</p>
            <p className="foundation-tse-name">The Seed Exchange</p>
            <p className="foundation-tse-body">
              Lattice is an initiative of The Seed Exchange (TSE), a Northwest Georgia nonprofit
              dedicated to strengthening coordination across human services. TSE coordinators
              manage every connection, maintain network standards, and keep this platform
              grounded in what actually helps people.
            </p>
            <a
              href="https://seedexchange.org"
              target="_blank"
              rel="noopener noreferrer"
              className="foundation-tse-link"
            >
              Learn about The Seed Exchange →
            </a>
          </div>
        </div>

        <hr className="foundation-hr" />

        <div className="foundation-footer-row">
          <p className="foundation-footer-copy">
            © {new Date().getFullYear()} The Seed Exchange · Lattice Coordination Network · Northwest Georgia
          </p>
          <div className="foundation-footer-links">
            <Link to="/directory" className="foundation-footer-link">Directory</Link>
            <Link to="/join" className="foundation-footer-link">Join</Link>
            <Link to="/login" className="foundation-footer-link">Sign In</Link>
          </div>
        </div>
      </section>
    </>
  );
}
