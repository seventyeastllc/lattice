import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import ConnectionModal from "@/features/directory/ConnectionModal";
import { useOrgBySlug } from "@/hooks/useOrgBySlug";
import { useAuth } from "@/context/AuthContext";
import { SERVICE_CATEGORY_LABELS } from "@/types/directory";
import type { OrgType } from "@/types/directory";

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  nonprofit:   "Nonprofit",
  faith_based: "Faith-Based",
  school:      "School / Education",
  medical:     "Medical / Health",
  housing:     "Housing",
  government:  "Government",
  community:   "Community Org",
  other:       "Organization",
};

const ORG_TYPE_COLOR: Record<OrgType, string> = {
  nonprofit:   "#2A9D8F",
  faith_based: "#7B68C8",
  school:      "#E07A3A",
  medical:     "#3A8FE0",
  housing:     "#4A7C6F",
  government:  "#5C7380",
  community:   "#2A6F9D",
  other:       "#5C7380",
};

export default function OrgProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const isProvider = !!user;
  const { data: org, isLoading, isError } = useOrgBySlug(slug);
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <style>{`
        .profile-page { background: #F7F9F8; min-height: 100vh; display: flex; flex-direction: column; }
        .profile-content { max-width: 1024px; margin: 0 auto; padding: 2.5rem 2rem 5rem; flex: 1; width: 100%; box-sizing: border-box; }
        .profile-grid { display: grid; grid-template-columns: 1fr 320px; gap: 2rem; align-items: start; }
        .profile-card { background: #ffffff; border: 1px solid #E2E8E6; padding: 1.75rem; }
        .profile-section-title { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #5C7380; margin: 0 0 1rem; }
        .service-tag { display: inline-flex; align-items: center; gap: 0.4rem; background: #F7F9F8; border: 1px solid #E2E8E6; color: #1A2B35; font-size: 0.8rem; font-weight: 500; padding: 0.3rem 0.7rem; border-radius: 3px; }
        .phase2-placeholder { background: rgba(233,162,107,0.07); border: 1px solid rgba(233,162,107,0.3); border-left: 3px solid #E9A26B; border-radius: 4px; padding: 1.25rem 1.5rem; }
        @media (max-width: 720px) {
          .profile-grid { grid-template-columns: 1fr; }
          .profile-content { padding: 1.5rem 1rem 4rem; }
        }
      `}</style>

      <div className="profile-page">
        <NavBar />

        {/* Page header */}
        <div style={{ background: "#1E3A4A", padding: "2.5rem 2rem 2rem" }}>
          <div style={{ maxWidth: 1024, margin: "0 auto" }}>
            <Link
              to="/directory"
              style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.8125rem", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem", marginBottom: "1.25rem", transition: "color 0.15s" }}
            >
              ← Partner Directory
            </Link>

            {isLoading && (
              <div>
                <div style={{ width: 220, height: 28, background: "rgba(255,255,255,0.1)", borderRadius: 4, marginBottom: "0.75rem" }} />
                <div style={{ width: 140, height: 18, background: "rgba(255,255,255,0.07)", borderRadius: 4 }} />
              </div>
            )}

            {!isLoading && org && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                  <span style={{
                    background: `${ORG_TYPE_COLOR[org.org_type]}22`,
                    color: ORG_TYPE_COLOR[org.org_type],
                    fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em",
                    textTransform: "uppercase", padding: "0.2rem 0.6rem",
                  }}>
                    {ORG_TYPE_LABELS[org.org_type]}
                  </span>
                  {org.is_verified ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "rgba(42,157,143,0.15)", color: "#2A9D8F", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.2rem 0.6rem" }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9L10 3.5" stroke="#2A9D8F" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Verified Listing
                    </span>
                  ) : (
                    <span style={{ background: "rgba(233,162,107,0.18)", color: "#E9A26B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.2rem 0.6rem" }}>
                      Unverified
                    </span>
                  )}
                </div>
                <h1 style={{ color: "#ffffff", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, margin: "0 0 0.5rem", lineHeight: 1.15 }}>
                  {org.name}
                </h1>
                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem", margin: 0 }}>
                  {org.county} County
                </p>
              </>
            )}

            {!isLoading && (isError || (!org && !isLoading)) && (
              <h1 style={{ color: "#ffffff", fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>
                Organization Not Found
              </h1>
            )}
          </div>
        </div>

        <div className="profile-content">
          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {[200, 120, 160].map((h, i) => (
                <div key={i} style={{ background: "#ffffff", border: "1px solid #E2E8E6", height: h, borderRadius: 2 }} />
              ))}
            </div>
          )}

          {!isLoading && (isError || !org) && (
            <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
              <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#1A2B35", margin: "0 0 0.5rem" }}>Organization not found</p>
              <p style={{ color: "#5C7380", margin: "0 0 1.5rem" }}>This listing may have been removed or the URL may be incorrect.</p>
              <Link to="/directory" style={{ background: "#1E3A4A", color: "#ffffff", fontWeight: 600, fontSize: "0.9rem", padding: "0.7rem 1.75rem", textDecoration: "none", borderRadius: 4 }}>
                Back to Directory
              </Link>
            </div>
          )}

          {!isLoading && org && (
            <div className="profile-grid">
              {/* Left column — main content */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                {/* Description */}
                <div className="profile-card">
                  <p className="profile-section-title">About</p>
                  <p style={{ color: "#1A2B35", fontSize: "0.9375rem", lineHeight: 1.75, margin: 0 }}>
                    {org.description || "No description available."}
                  </p>
                </div>

                {/* Services */}
                {org.services.length > 0 && (
                  <div className="profile-card">
                    <p className="profile-section-title">Services Offered</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {org.services.map((s, i) => (
                        <span key={i} className="service-tag">
                          <span style={{
                            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                            background: "#2A9D8F", flexShrink: 0,
                          }} />
                          <span style={{ color: "#5C7380", fontSize: "0.72rem" }}>
                            {SERVICE_CATEGORY_LABELS[s.category] ?? s.category}
                          </span>
                          <span style={{ color: "#1A2B35" }}>{s.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Eligibility & Access — Phase 2 placeholder */}
                <div className="profile-card">
                  <p className="profile-section-title">Eligibility &amp; Access</p>
                  <div className="phase2-placeholder">
                    <p style={{ color: "#E9A26B", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.4rem" }}>
                      Coming in Phase 2
                    </p>
                    <p style={{ color: "#5C7380", fontSize: "0.875rem", lineHeight: 1.65, margin: 0 }}>
                      Eligibility guidance, documentation requirements, and intake instructions will appear here once TSE adds this information to the listing.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right column — contact + coordination */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="profile-card">
                  <p className="profile-section-title">Contact &amp; Coordination</p>

                  {isProvider ? (
                    <>
                      {org.contact ? (
                        <div style={{ marginBottom: "1.25rem" }}>
                          <p style={{ color: "#1A2B35", fontWeight: 700, fontSize: "0.9375rem", margin: "0 0 0.1rem" }}>
                            {org.contact.full_name}
                          </p>
                          {org.contact.title && (
                            <p style={{ color: "#5C7380", fontSize: "0.8125rem", margin: "0 0 0.5rem" }}>
                              {org.contact.title}
                            </p>
                          )}
                          {org.contact.phone && (
                            <a
                              href={`tel:${org.contact.phone.replace(/\D/g, "")}`}
                              style={{ color: "#1E3A4A", fontWeight: 700, fontSize: "0.9375rem", textDecoration: "none", display: "block" }}
                            >
                              {org.contact.phone}
                            </a>
                          )}
                        </div>
                      ) : (
                        <p style={{ color: "#5C7380", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                          No contact listed for this organization.
                        </p>
                      )}

                      {/* Capability flags */}
                      {(org.has_funding_available || org.contact?.accepts_case_conference) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
                          {org.has_funding_available && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#2A9D8F", fontSize: "0.8125rem", fontWeight: 600 }}>
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <circle cx="7" cy="7" r="6.25" stroke="#2A9D8F" strokeWidth="1.5"/>
                                <path d="M4.5 7.25L6.25 9L9.5 5.5" stroke="#2A9D8F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Has Funding Available
                            </span>
                          )}
                          {org.contact?.accepts_case_conference && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#4A7C6F", fontSize: "0.8125rem", fontWeight: 600 }}>
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <circle cx="7" cy="7" r="6.25" stroke="#4A7C6F" strokeWidth="1.5"/>
                                <path d="M4.5 7.25L6.25 9L9.5 5.5" stroke="#4A7C6F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Accepts Case Conference
                            </span>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => setShowModal(true)}
                        style={{
                          background: "#2A9D8F", color: "#ffffff", fontWeight: 600,
                          fontSize: "0.9rem", padding: "0.75rem 1rem", border: "none",
                          cursor: "pointer", width: "100%", borderRadius: 2,
                        }}
                      >
                        Request Connection
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="#5C7380" strokeWidth="1.4"/>
                          <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#5C7380" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                        <span style={{ color: "#5C7380", fontSize: "0.8125rem" }}>Contact details are for network members only.</span>
                      </div>
                      <Link
                        to="/join"
                        style={{
                          display: "block", textAlign: "center", background: "#1E3A4A",
                          color: "#ffffff", fontWeight: 600, fontSize: "0.9rem",
                          padding: "0.75rem 1rem", textDecoration: "none", borderRadius: 2,
                        }}
                      >
                        Join to Connect →
                      </Link>
                      <p style={{ color: "#5C7380", fontSize: "0.75rem", textAlign: "center", marginTop: "0.75rem", lineHeight: 1.5 }}>
                        Already a member?{" "}
                        <Link to="/login" style={{ color: "#2A9D8F", textDecoration: "none", fontWeight: 600 }}>
                          Sign in
                        </Link>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <Footer />
      </div>

      {showModal && org && isProvider && (
        <ConnectionModal org={org} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
