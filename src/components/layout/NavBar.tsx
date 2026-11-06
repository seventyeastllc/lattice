import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types";

export default function NavBar() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid #E2E8E6",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 2rem",
          height: 112,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <img
            src="/Lattice%20Icon%203%20trans.png"
            alt="Lattice"
            style={{ height: 100, width: "auto", display: "block", mixBlendMode: "multiply" }}
          />
        </Link>

        {/* Right side */}
        <nav style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          {[
            { label: "Directory", to: "/directory", isRouterLink: true },
            { label: "About", to: "/#why", isRouterLink: false },
            { label: "Join the Network", to: "/join", isRouterLink: true },
          ].map(({ label, to, isRouterLink }) =>
            isRouterLink ? (
              <Link
                key={label}
                to={to}
                style={{
                  color: "#1A2B35",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.opacity = "0.65")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.opacity = "1")
                }
              >
                {label}
              </Link>
            ) : (
              <a
                key={label}
                href={to}
                style={{
                  color: "#1A2B35",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.opacity = "0.65")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.opacity = "1")
                }
              >
                {label}
              </a>
            )
          )}

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {(role as UserRole) === "admin" && (
                <Link
                  to="/admin"
                  style={{
                    background: "#1E3A4A",
                    color: "#fff",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    padding: "0.4rem 0.9rem",
                    borderRadius: "6px",
                    textDecoration: "none",
                    letterSpacing: "0.01em",
                  }}
                >
                  Admin
                </Link>
              )}
              <Link
                to="/dashboard"
                style={{
                  color: "#2A9D8F",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                My Workspace
              </Link>
              <Link
                to="/resources"
                style={{
                  color: "#1A2B35",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                My Resources
              </Link>
              <Link
                to="/knowledge"
                style={{
                  color: "#1A2B35",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Tools
              </Link>
              <Link
                to="/network"
                style={{
                  color: "#1A2B35",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                My Network
              </Link>
              <button
                onClick={handleSignOut}
                style={{
                  background: "transparent",
                  border: "1.5px solid #E2E8E6",
                  color: "#5C7380",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  padding: "0.45rem 1.1rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              style={{
                background: "#1E3A4A",
                color: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 600,
                padding: "0.5rem 1.5rem",
                textDecoration: "none",
                display: "inline-block",
                borderRadius: "8px",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.opacity = "0.85")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.opacity = "1")
              }
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
