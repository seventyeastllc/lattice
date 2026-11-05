import { Link } from "react-router-dom";

const navLinks = [
  { label: "Directory", href: "/directory", isRouterLink: true },
  { label: "About", href: "#about", isRouterLink: false },
  { label: "Join the Network", href: "#join", isRouterLink: false },
  { label: "Sign In", href: "/login", isRouterLink: true },
];

export default function Footer() {
  return (
    <footer style={{ background: "#1A2B35", paddingTop: "4rem", paddingBottom: "2rem" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 2rem" }}>
        {/* Top row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "2rem",
          }}
        >
          {/* Logo */}
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", background: "#ffffff", borderRadius: "6px", padding: "10px 20px", marginBottom: 8 }}>
            <img
              src="/Lattice%20Logo%20w-icon.png"
              alt="Lattice"
              style={{
                height: 52,
                width: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </Link>

          {/* Nav links */}
          <nav style={{ display: "flex", alignItems: "center", gap: "1.75rem", flexWrap: "wrap" }}>
            {navLinks.map(({ label, href, isRouterLink }) =>
              isRouterLink ? (
                <Link
                  key={label}
                  to={href}
                  style={{
                    color: "rgba(255,255,255,0.58)",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = "#ffffff")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color =
                      "rgba(255,255,255,0.58)")
                  }
                >
                  {label}
                </Link>
              ) : (
                <a
                  key={label}
                  href={href}
                  style={{
                    color: "rgba(255,255,255,0.58)",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = "#ffffff")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color =
                      "rgba(255,255,255,0.58)")
                  }
                >
                  {label}
                </a>
              )
            )}
          </nav>
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            marginTop: "3rem",
            paddingTop: "2rem",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.38)",
              fontSize: "0.8125rem",
              margin: 0,
            }}
          >
            © 2026 The Seed Exchange LLC. All rights reserved.
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.28)",
              fontSize: "0.75rem",
              margin: 0,
              textAlign: "right",
            }}
          >
            Lattice is not affiliated with HMIS or any CoC Coordinated Entry system.
          </p>
        </div>
      </div>
    </footer>
  );
}
