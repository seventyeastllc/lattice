import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types";

const TEAL = "#2A9D8F";
const DARK = "#1E3A4A";
const TEXT = "#1A2B35";
const MUTED = "#5C7380";
const BORDER = "#E2E8E6";

export default function NavBar() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  }

  const memberLinks = [
    { label: "My Workspace",      to: "/dashboard" },
    { label: "My Resources",      to: "/resources" },
    { label: "Tools & Knowledge", to: "/knowledge" },
    { label: "My Network",        to: "/network" },
  ];

  const anonLinks = [
    { label: "Directory",        to: "/directory",  router: true },
    { label: "About",            to: "/#why",       router: false },
    { label: "Join the Network", to: "/join",        router: true },
  ];

  const activeLinkStyle = { color: TEAL, fontWeight: 700 };
  const inactiveLinkStyle = { color: TEXT, fontWeight: 500 };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: `1px solid ${BORDER}`,
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

        {/* Desktop nav */}
        <nav style={{ display: "flex", alignItems: "center", gap: "2rem" }} className="lattice-desktop-nav">
          {anonLinks.map(({ label, to, router }) =>
            router ? (
              <Link
                key={label}
                to={to}
                style={{ ...(isActive(to) ? activeLinkStyle : inactiveLinkStyle), fontSize: "0.9rem", textDecoration: "none", transition: "opacity 0.15s" }}
              >
                {label}
              </Link>
            ) : (
              <a
                key={label}
                href={to}
                style={{ color: TEXT, fontSize: "0.9rem", fontWeight: 500, textDecoration: "none", transition: "opacity 0.15s" }}
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
                    background: DARK,
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
              {memberLinks.map(({ label, to }) => (
                <Link
                  key={to}
                  to={to}
                  style={{
                    ...(isActive(to) ? activeLinkStyle : { color: TEXT, fontWeight: 500 }),
                    fontSize: "0.875rem",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </Link>
              ))}
              <button
                onClick={handleSignOut}
                style={{
                  background: "transparent",
                  border: `1.5px solid ${BORDER}`,
                  color: MUTED,
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
                background: DARK,
                color: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 600,
                padding: "0.5rem 1.5rem",
                textDecoration: "none",
                display: "inline-block",
                borderRadius: "8px",
                transition: "opacity 0.15s",
              }}
            >
              Sign In
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="lattice-mobile-menu-btn"
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
          style={{
            display: "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.5rem",
            color: DARK,
          }}
        >
          {mobileOpen ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M4 4L18 18M18 4L4 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="lattice-mobile-drawer"
          style={{
            display: "none",
            flexDirection: "column",
            gap: "0.125rem",
            padding: "1rem 1.5rem 1.5rem",
            borderTop: `1px solid ${BORDER}`,
            background: "#fff",
          }}
        >
          {anonLinks.map(({ label, to, router }) =>
            router ? (
              <Link
                key={label}
                to={to}
                onClick={() => setMobileOpen(false)}
                style={{ padding: "0.6rem 0", fontSize: "0.95rem", textDecoration: "none", ...(isActive(to) ? activeLinkStyle : { color: TEXT, fontWeight: 500 }) }}
              >
                {label}
              </Link>
            ) : (
              <a
                key={label}
                href={to}
                onClick={() => setMobileOpen(false)}
                style={{ padding: "0.6rem 0", fontSize: "0.95rem", textDecoration: "none", color: TEXT, fontWeight: 500 }}
              >
                {label}
              </a>
            )
          )}

          {user && (
            <>
              <hr style={{ border: "none", borderTop: `1px solid ${BORDER}`, margin: "0.5rem 0" }} />
              {(role as UserRole) === "admin" && (
                <Link
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  style={{ padding: "0.6rem 0", fontSize: "0.95rem", fontWeight: 700, color: DARK, textDecoration: "none" }}
                >
                  Admin
                </Link>
              )}
              {memberLinks.map(({ label, to }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  style={{ padding: "0.6rem 0", fontSize: "0.95rem", textDecoration: "none", ...(isActive(to) ? activeLinkStyle : { color: TEXT, fontWeight: 500 }) }}
                >
                  {label}
                </Link>
              ))}
              <button
                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                style={{ padding: "0.6rem 0", fontSize: "0.95rem", fontWeight: 500, color: MUTED, background: "none", border: "none", textAlign: "left", cursor: "pointer" }}
              >
                Sign out
              </button>
            </>
          )}

          {!user && (
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              style={{ marginTop: "0.5rem", display: "block", background: DARK, color: "#fff", textAlign: "center", padding: "0.75rem", borderRadius: "8px", textDecoration: "none", fontWeight: 700, fontSize: "0.95rem" }}
            >
              Sign In
            </Link>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .lattice-desktop-nav { display: none !important; }
          .lattice-mobile-menu-btn { display: flex !important; }
          .lattice-mobile-drawer { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
