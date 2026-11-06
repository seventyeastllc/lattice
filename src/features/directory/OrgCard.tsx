import { useState } from "react";
import { Link } from "react-router-dom";
import type { DirectoryOrg, OrgType } from "@/types/directory";
import { SERVICE_CATEGORY_LABELS } from "@/types/directory";

interface Props {
  org: DirectoryOrg;
  onConnect: (org: DirectoryOrg) => void;
  isProvider?: boolean;
  isSaved?: boolean;
  onSaveToggle?: (orgId: string) => void;
}

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

function serviceLabel(svc: { name: string; category: string }): string {
  return SERVICE_CATEGORY_LABELS[svc.category] ?? svc.name;
}

export default function OrgCard({ org, onConnect, isProvider = false, isSaved = false, onSaveToggle }: Props) {
  const [hovered, setBtnHovered] = useState(false);
  const [cardHovered, setCardHovered] = useState(false);
  const [phoneHovered, setPhoneHovered] = useState(false);
  const typeColor = ORG_TYPE_COLOR[org.org_type] ?? "#5C7380";

  const visibleServices = org.services.slice(0, 2);
  const extraServices   = org.services.length - 2;

  return (
    <div
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
      style={{
        background: "#ffffff",
        border: `1px solid ${cardHovered ? "#2A9D8F" : "#E2E8E6"}`,
        borderTop: `3px solid ${typeColor}`,
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: cardHovered ? "0 4px 16px rgba(26,43,53,0.09)" : "none",
        position: "relative",
      }}
    >
      {/* Bookmark button — members only */}
      {isProvider && onSaveToggle && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSaveToggle(org.id); }}
          aria-label={isSaved ? "Remove from saved" : "Save organization"}
          style={{
            position: "absolute", top: "0.625rem", right: "0.625rem", zIndex: 2,
            background: isSaved ? "rgba(42,157,143,0.1)" : "rgba(255,255,255,0.9)",
            border: `1px solid ${isSaved ? "rgba(42,157,143,0.3)" : "#E2E8E6"}`,
            borderRadius: "4px", width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.15s", padding: 0,
          }}
        >
          {isSaved ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 2h10a1 1 0 011 1v11l-6-3-6 3V3a1 1 0 011-1z" fill="#2A9D8F" stroke="#2A9D8F" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 2h10a1 1 0 011 1v11l-6-3-6 3V3a1 1 0 011-1z" stroke="#5C7380" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      )}
      {/* Main content — linked to profile */}
      <Link
        to={`/directory/${org.slug}`}
        style={{ textDecoration: "none", color: "inherit", flex: 1, display: "flex", flexDirection: "column" }}
      >
      <div style={{ padding: "1.25rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.625rem" }}>

        {/* Name + badge */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.375rem" }}>
            <h3 style={{ color: "#1A2B35", fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.35, margin: 0 }}>
              {org.name}
            </h3>
          </div>
          <span style={{
            display: "inline-block",
            background: `${typeColor}18`,
            color: typeColor,
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "0.2rem 0.5rem",
          }}>
            {ORG_TYPE_LABELS[org.org_type]}
          </span>
        </div>

        {/* County */}
        <p style={{ color: "#5C7380", fontSize: "0.775rem", fontWeight: 500, margin: 0 }}>
          {org.county} County
        </p>

        {/* Description — clamped to 3 lines */}
        {org.description && (
          <p style={{
            color: "#1A2B35",
            fontSize: "0.8375rem",
            lineHeight: 1.6,
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {org.description}
          </p>
        )}

        {/* Service tags */}
        {org.services.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "auto", paddingTop: "0.25rem" }}>
            {visibleServices.map((s) => (
              <span key={s.category || s.name} style={{
                background: "#F7F9F8",
                border: "1px solid #E2E8E6",
                color: "#5C7380",
                fontSize: "0.7rem",
                fontWeight: 500,
                padding: "0.2rem 0.5rem",
              }}>
                {serviceLabel(s)}
              </span>
            ))}
            {extraServices > 0 && (
              <span style={{
                background: "#F7F9F8",
                border: "1px solid #E2E8E6",
                color: "#5C7380",
                fontSize: "0.7rem",
                fontWeight: 500,
                padding: "0.2rem 0.5rem",
              }}>
                +{extraServices} more
              </span>
            )}
          </div>
        )}
      </div>
      </Link>

      {/* Divider */}
      <div style={{ height: "1px", background: "#E2E8E6", margin: "0 1.25rem" }} />

      {/* Contact + CTA */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {isProvider ? (
          <>
            {org.contact && (
              <div>
                <p style={{ color: "#1A2B35", fontSize: "0.8375rem", fontWeight: 700, margin: "0 0 0.1rem" }}>
                  {org.contact.full_name}
                </p>
                {org.contact.title && (
                  <p style={{ color: "#5C7380", fontSize: "0.775rem", margin: "0 0 0.25rem" }}>
                    {org.contact.title}
                  </p>
                )}
                {org.contact.phone && (
                  <a
                    href={`tel:${org.contact.phone.replace(/\D/g, "")}`}
                    onMouseEnter={() => setPhoneHovered(true)}
                    onMouseLeave={() => setPhoneHovered(false)}
                    style={{
                      color: phoneHovered ? "#2A9D8F" : "#1E3A4A",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                      textDecoration: "none",
                      transition: "color 0.15s",
                      display: "block",
                    }}
                  >
                    {org.contact.phone}
                  </a>
                )}
              </div>
            )}

            {/* Capability flags */}
            {(org.has_funding_available || org.contact?.accepts_case_conference) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {org.has_funding_available && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: "#2A9D8F", fontSize: "0.72rem", fontWeight: 600 }}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="6.25" stroke="#2A9D8F" strokeWidth="1.5"/>
                      <path d="M4.5 7.25L6.25 9L9.5 5.5" stroke="#2A9D8F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Has Funding
                  </span>
                )}
                {org.contact?.accepts_case_conference && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: "#4A7C6F", fontSize: "0.72rem", fontWeight: 600 }}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="6.25" stroke="#4A7C6F" strokeWidth="1.5"/>
                      <path d="M4.5 7.25L6.25 9L9.5 5.5" stroke="#4A7C6F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Case Conference
                  </span>
                )}
              </div>
            )}

            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onConnect(org); }}
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
              style={{
                background: hovered ? "#2A9D8F" : "#1E3A4A",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.8125rem",
                padding: "0.575rem 1rem",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
                width: "100%",
                marginTop: "0.25rem",
              }}
            >
              Request Connection
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="#5C7380" strokeWidth="1.4"/>
                <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#5C7380" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span style={{ color: "#5C7380", fontSize: "0.775rem" }}>Members only</span>
            </div>
            <Link
              to="/join"
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
              style={{
                display: "block",
                textAlign: "center",
                background: "transparent",
                color: hovered ? "#1E3A4A" : "#5C7380",
                fontWeight: 600,
                fontSize: "0.8125rem",
                padding: "0.575rem 1rem",
                border: `1px solid ${hovered ? "#1E3A4A" : "#E2E8E6"}`,
                textDecoration: "none",
                transition: "all 0.15s",
              }}
            >
              Join to Connect →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
