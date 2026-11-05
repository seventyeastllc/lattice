import { Link } from "react-router-dom";

const DOT_TEXTURE = `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`;

export default function HeroSection() {
  return (
    <>
      <style>{`
        .hero-section {
          min-height: 100vh;
          display: flex;
          flex-direction: row;
          overflow: hidden;
        }
        .hero-left {
          flex: 0 0 55%;
          background: #1E3A4A;
          background-image: ${DOT_TEXTURE};
          background-size: 24px 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 64px 64px 80px;
          box-sizing: border-box;
          position: relative;
        }
        .hero-logo-wrap {
          display: inline-flex;
          align-items: center;
          background: #ffffff;
          border-radius: 6px;
          padding: 10px 20px;
          flex-shrink: 0;
          align-self: flex-start;
        }
        .hero-logo {
          height: 60px;
          width: auto;
          display: block;
          object-fit: contain;
        }
        .hero-content {
          flex: 1;
          display: flex;
          align-items: center;
        }
        .hero-right {
          flex: 0 0 45%;
          position: relative;
          overflow: hidden;
        }
        .hero-right img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 58% top;
          display: block;
        }
        .hero-fade {
          position: absolute;
          top: 0;
          left: 0;
          width: 80px;
          height: 100%;
          background: linear-gradient(to right, #1E3A4A, transparent);
          pointer-events: none;
        }
        @media (max-width: 767px) {
          .hero-section {
            flex-direction: column;
            min-height: unset;
          }
          .hero-right {
            flex: unset;
            width: 100%;
            height: 300px;
            order: -1;
          }
          .hero-right img {
            position: absolute;
          }
          .hero-fade {
            display: none;
          }
          .hero-left {
            flex: unset;
            width: 100%;
            padding: 32px 24px 48px;
          }
          .hero-logo { height: 44px; }
          .hero-logo-wrap { padding: 8px 14px; }
          .hero-content { margin-top: 2rem; }
        }
      `}</style>

      <section className="hero-section">
        {/* LEFT — dark content panel */}
        <div className="hero-left">
          {/* Logo — upper left */}
          <div className="hero-logo-wrap">
            <img
              src="/Lattice%20Logo%20w-icon.png"
              alt="Lattice"
              className="hero-logo"
            />
          </div>

          <div className="hero-content">
          <div style={{ maxWidth: 520 }}>
            {/* Eyebrow */}
            <p
              style={{
                color: "#2A9D8F",
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Coordination Network
            </p>

            {/* Headline */}
            <h1
              style={{
                color: "#ffffff",
                fontSize: "clamp(2.75rem, 4vw, 4rem)",
                fontWeight: 800,
                lineHeight: 1.1,
                marginTop: "1.25rem",
                marginBottom: 0,
              }}
            >
              One platform.
              <br />
              Clear pathways.
              <br />
              No dead ends.
            </h1>

            {/* Subheadline */}
            <p
              style={{
                color: "rgba(255,255,255,0.72)",
                fontSize: "1.1rem",
                lineHeight: 1.8,
                marginTop: "1.5rem",
                marginBottom: 0,
              }}
            >
              Lattice is a governed coordination network that gives case managers,
              partner agencies, faith-based organizations, and community providers a
              verified directory of named contacts — and a direct pathway to
              coordinate around the people they serve.
            </p>

            {/* CTAs */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1rem",
                marginTop: "2.5rem",
              }}
            >
              <Link
                to="/directory"
                style={{
                  background: "#2A9D8F",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  padding: "1rem 2rem",
                  textDecoration: "none",
                  display: "inline-block",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "#248a7d")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "#2A9D8F")
                }
              >
                Browse the Directory
              </Link>
              <a
                href="#join"
                style={{
                  background: "transparent",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  padding: "1rem 2rem",
                  border: "1px solid rgba(255,255,255,0.4)",
                  textDecoration: "none",
                  display: "inline-block",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor = "#ffffff")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(255,255,255,0.4)")
                }
              >
                Join the Network
              </a>
            </div>
          </div>
          </div>
        </div>

        {/* RIGHT — full-bleed image */}
        <div className="hero-right">
          <img
            src="/Lattice%20Hero%20Page%20Image.png"
            alt=""
          />
          <div className="hero-fade" aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
