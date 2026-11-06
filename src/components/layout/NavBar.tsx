import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types";

const TEAL = "#2A9D8F";
const DARK = "#102D3B";
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

  const navLinks = [
    { label: "Directory",   to: "/directory",  router: true },
    { label: "Tools",       to: "/knowledge",  router: true },
    { label: "Membership",  to: "/join",        router: true },
    { label: "Resources",   to: "/resources",   router: true },
    { label: "About",       to: "/#why",        router: false },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#ffffff",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 2rem",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, textDecoration: "none" }}>
          <img src="/Lattice-icon-transparent.png" alt="" style={{ height: 32, width: 32, objectFit: "contain" }} />
          <img src="/Lattice-wordmark-transparent.png" alt="Lattice" style={{ height: 28, objectFit: "contain" }} />
        </Link>

        {/* Desktop nav */}
        <nav style={{ display: "flex", alignItems: "center", gap: "1.75rem" }} className="lattice-desktop-nav">
          {navLinks.map(({ label, to, router }) =>
            router ? (
              <Link
                key={label}
                to={to}
                style={{
                  color: isActive(to) ? TEAL : MUTED,
                  fontWeight: isActive(to) ? 600 : 500,
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}
              >
                {label}
              </Link>
            ) : (
              <a
                key={label}
                href={to}
                style={{ color: MUTED, fontSize: "0.875rem", fontWeight: 500, textDecoration: "none" }}
              >
                {label}
              </a>
            )
          )}

          {/* Right-side actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginLeft: "0.5rem" }}>
            {/* Search icon */}
            <button
              aria-label="Search"
              style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", alignItems: "center", padding: "0.25rem" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {user ? (
              <>
                {(role as UserRole) === "admin" && (
                  <Link
                    to="/admin"
                    style={{
                      background: DARK,
                      color: "#fff",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      padding: "0.4rem 0.9rem",
                      borderRadius: "24px",
                      textDecoration: "none",
                    }}
                  >
                    Admin
                  </Link>
                )}
                <Link
                  to="/dashboard"
                  style={{
                    background: TEAL,
                    color: "#ffffff",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    padding: "0.45rem 1.25rem",
                    borderRadius: "24px",
                    textDecoration: "none",
                  }}
                >
                  My Workspace
                </Link>
                <button
                  onClick={handleSignOut}
                  style={{
                    background: "transparent",
                    border: `1.5px solid ${BORDER}`,
                    color: MUTED,
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    padding: "0.4rem 1rem",
                    borderRadius: "24px",
                    cursor: "pointer",
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    background: "transparent",
                    border: `1.5px solid ${DARK}`,
                    color: DARK,
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    padding: "0.45rem 1.25rem",
                    borderRadius: "24px",
                    textDecoration: "none",
                  }}
                >
                  Sign In
                </Link>
                <Link
                  to="/join"
                  style={{
                    background: DARK,
                    color: "#ffffff",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    padding: "0.45rem 1.25rem",
                    borderRadius: "24px",
                    textDecoration: "none",
                  }}
                >
                  Join Lattice
                </Link>
              </>
            )}
          </div>
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
          {navLinks.map(({ label, to, router }) =>
            router ? (
              <Link
                key={label}
                to={to}
                onClick={() => setMobileOpen(false)}
                style={{ padding: "0.6rem 0", fontSize: "0.95rem", textDecoration: "none", color: isActive(to) ? TEAL : TEXT, fontWeight: isActive(to) ? 600 : 500 }}
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

          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {user ? (
              <>
                {(role as UserRole) === "admin" && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    style={{ background: DARK, color: "#fff", textAlign: "center", padding: "0.75rem", borderRadius: "24px", textDecoration: "none", fontWeight: 700, fontSize: "0.95rem" }}
                  >
                    Admin
                  </Link>
                )}
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  style={{ background: TEAL, color: "#fff", textAlign: "center", padding: "0.75rem", borderRadius: "24px", textDecoration: "none", fontWeight: 700, fontSize: "0.95rem" }}
                >
                  My Workspace
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); handleSignOut(); }}
                  style={{ padding: "0.6rem 0", fontSize: "0.95rem", fontWeight: 500, color: MUTED, background: "none", border: "none", textAlign: "left", cursor: "pointer" }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  style={{ display: "block", border: `1.5px solid ${DARK}`, color: DARK, textAlign: "center", padding: "0.75rem", borderRadius: "24px", textDecoration: "none", fontWeight: 700, fontSize: "0.95rem" }}
                >
                  Sign In
                </Link>
                <Link
                  to="/join"
                  onClick={() => setMobileOpen(false)}
                  style={{ display: "block", background: DARK, color: "#fff", textAlign: "center", padding: "0.75rem", borderRadius: "24px", textDecoration: "none", fontWeight: 700, fontSize: "0.95rem" }}
                >
                  Join Lattice
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .lattice-desktop-nav { display: none !important; }
          .lattice-mobile-menu-btn { display: flex !important; }
          .lattice-mobile-drawer { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
