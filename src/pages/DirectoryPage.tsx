import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import OrgCard from "@/features/directory/OrgCard";
import ConnectionModal from "@/features/directory/ConnectionModal";
import { useDirectory } from "@/hooks/useDirectory";
import { useAuth } from "@/context/AuthContext";
import type { DirectoryOrg } from "@/types/directory";
import { SERVICE_CATEGORY_LABELS } from "@/types/directory";

const ORG_TYPES = [
  { value: "all",        label: "All Types" },
  { value: "nonprofit",  label: "Nonprofit" },
  { value: "faith_based",label: "Faith-Based" },
  { value: "school",     label: "School / Education" },
  { value: "medical",    label: "Medical / Health" },
  { value: "housing",    label: "Housing" },
  { value: "government", label: "Government" },
  { value: "community",  label: "Community Org" },
];

const SERVICE_OPTIONS = Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export default function DirectoryPage() {
  const { user } = useAuth();
  const isProvider = !!user;
  const { data: orgs = [], isLoading, isError } = useDirectory();

  const [search, setSearch]         = useState("");
  const [county, setCounty]         = useState("all");
  const [orgType, setOrgType]       = useState("all");
  const [service, setService]       = useState("all");
  const [fundingOnly, setFundingOnly] = useState(false);
  const [confOnly, setConfOnly]     = useState(false);
  const [modalOrg, setModalOrg]     = useState<DirectoryOrg | null>(null);

  // Derive county list from live data
  const allCounties = useMemo(
    () => Array.from(new Set(orgs.map((o) => o.county).filter(Boolean))).sort(),
    [orgs]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orgs.filter((org) => {
      if (q && !org.name.toLowerCase().includes(q) && !org.description.toLowerCase().includes(q)) return false;
      if (county !== "all" && org.county !== county) return false;
      if (orgType !== "all" && org.org_type !== orgType) return false;
      if (service !== "all" && !org.services.some((s) => s.category === service)) return false;
      if (fundingOnly && !org.has_funding_available) return false;
      if (confOnly && !org.contact?.accepts_case_conference) return false;
      return true;
    });
  }, [orgs, search, county, orgType, service, fundingOnly, confOnly]);

  const activeFilterCount = [
    county !== "all", orgType !== "all", service !== "all", fundingOnly, confOnly,
  ].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setCounty("all");
    setOrgType("all");
    setService("all");
    setFundingOnly(false);
    setConfOnly(false);
  }

  return (
    <>
      <style>{`
        .dir-page { background: #F7F9F8; min-height: 100vh; display: flex; flex-direction: column; }
        .dir-filter-bar {
          position: sticky; top: 112px; z-index: 40;
          background: rgba(255,255,255,0.97); backdrop-filter: blur(8px);
          border-bottom: 1px solid #E2E8E6; padding: 0.875rem 2rem;
        }
        .dir-filter-inner {
          max-width: 1280px; margin: 0 auto;
          display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
        }
        .dir-search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 340px; }
        .dir-search-wrap svg { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); pointer-events: none; }
        .dir-search {
          width: 100%; box-sizing: border-box;
          padding: 0.5rem 0.875rem 0.5rem 2.25rem;
          border: 1px solid #E2E8E6; font-size: 0.875rem; color: #1A2B35;
          background: #ffffff; outline: none; font-family: inherit; transition: border-color 0.15s;
        }
        .dir-search:focus { border-color: #2A9D8F; }
        .dir-select {
          padding: 0.5rem 2rem 0.5rem 0.75rem;
          border: 1px solid #E2E8E6;
          background: #ffffff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235C7380' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 0.625rem center;
          font-size: 0.875rem; color: #1A2B35; outline: none; cursor: pointer;
          font-family: inherit; appearance: none; transition: border-color 0.15s; min-width: 130px;
        }
        .dir-select:focus { border-color: #2A9D8F; }
        .dir-toggle {
          display: flex; align-items: center; gap: 0.375rem;
          font-size: 0.8125rem; font-weight: 500; color: #5C7380;
          cursor: pointer; white-space: nowrap; user-select: none;
        }
        .dir-toggle input { accent-color: #2A9D8F; width: 15px; height: 15px; cursor: pointer; }
        .dir-toggle:hover { color: #1A2B35; }
        .dir-clear {
          background: none; border: none; color: #2A9D8F; font-size: 0.8125rem;
          font-weight: 600; cursor: pointer; padding: 0.25rem 0; white-space: nowrap;
          text-decoration: underline; text-underline-offset: 2px;
        }
        .dir-main { max-width: 1280px; margin: 0 auto; padding: 2.5rem 2rem 4rem; flex: 1; width: 100%; box-sizing: border-box; }
        .dir-header { margin-bottom: 1.5rem; }
        .dir-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          align-items: start;
        }
        @media (max-width: 1100px) { .dir-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 720px)  { .dir-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px)  { .dir-grid { grid-template-columns: 1fr; } }
        .dir-empty { text-align: center; padding: 4rem 1rem; color: #5C7380; grid-column: 1 / -1; }
        @media (max-width: 720px) { .dir-filter-bar { padding: 0.875rem 1rem; top: 0; } .dir-main { padding: 1.5rem 1rem 3rem; } }
      `}</style>

      <div className="dir-page">
        <NavBar />

        {/* Page header */}
        <div style={{ background: "#1E3A4A", padding: "3rem 2rem 2.5rem" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <p style={{ color: "#2A9D8F", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.25em", textTransform: "uppercase", margin: "0 0 0.75rem" }}>
              Coordination Network
            </p>
            <h1 style={{ color: "#ffffff", fontSize: "clamp(1.875rem, 3vw, 2.5rem)", fontWeight: 800, margin: "0 0 0.75rem", lineHeight: 1.15 }}>
              Partner Directory
            </h1>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "1rem", lineHeight: 1.7, margin: 0, maxWidth: 620 }}>
              A verified network of named contacts across nonprofits, faith communities, schools, and healthcare providers — ready to coordinate around the people you serve.
            </p>
          </div>
        </div>

        {/* Sticky filter bar */}
        <div className="dir-filter-bar">
          <div className="dir-filter-inner">
            <div className="dir-search-wrap">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="5.25" stroke="#5C7380" strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke="#5C7380" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input className="dir-search" type="text" placeholder="Search organizations..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <select className="dir-select" value={county} onChange={(e) => setCounty(e.target.value)}>
              <option value="all">All Counties</option>
              {allCounties.map((c) => <option key={c} value={c}>{c} County</option>)}
            </select>

            <select className="dir-select" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
              {ORG_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>

            <select className="dir-select" value={service} onChange={(e) => setService(e.target.value)}>
              <option value="all">All Services</option>
              {SERVICE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>

            {isProvider && (
              <>
                <label className="dir-toggle">
                  <input type="checkbox" checked={fundingOnly} onChange={(e) => setFundingOnly(e.target.checked)} />
                  Has Funding
                </label>

                <label className="dir-toggle">
                  <input type="checkbox" checked={confOnly} onChange={(e) => setConfOnly(e.target.checked)} />
                  Case Conference
                </label>
              </>
            )}

            {(activeFilterCount > 0 || search) && (
              <button className="dir-clear" onClick={clearFilters}>Clear filters</button>
            )}
          </div>
        </div>

        {/* Public access banner */}
        {!isProvider && (
          <div style={{ background: "#F0F4F3", borderBottom: "1px solid #E2E8E6" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0.875rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="#5C7380" strokeWidth="1.4"/>
                  <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#5C7380" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <p style={{ color: "#5C7380", fontSize: "0.875rem", margin: 0 }}>
                  You're viewing the <strong style={{ color: "#1A2B35" }}>public directory.</strong> Contact details and connection requests are available to network members only.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0 }}>
                <Link to="/login" style={{ color: "#1E3A4A", fontSize: "0.8125rem", fontWeight: 600, textDecoration: "none", padding: "0.4rem 1rem", border: "1px solid #1E3A4A", borderRadius: "4px", whiteSpace: "nowrap" }}>
                  Sign In
                </Link>
                <Link to="/join" style={{ background: "#2A9D8F", color: "#ffffff", fontSize: "0.8125rem", fontWeight: 600, textDecoration: "none", padding: "0.4rem 1rem", borderRadius: "4px", whiteSpace: "nowrap" }}>
                  Join the Network
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="dir-main">
          <div className="dir-header">
            {isLoading ? (
              <p style={{ color: "#5C7380", fontSize: "0.875rem", margin: 0 }}>Loading directory…</p>
            ) : isError ? (
              <p style={{ color: "#B91C1C", fontSize: "0.875rem", margin: 0 }}>Unable to load directory. Showing cached data.</p>
            ) : (
              <p style={{ color: "#5C7380", fontSize: "0.875rem", margin: 0 }}>
                <strong style={{ color: "#1A2B35" }}>{filtered.length}</strong>{" "}
                organization{filtered.length !== 1 ? "s" : ""} found
                {activeFilterCount > 0 && (
                  <span style={{ color: "#2A9D8F", marginLeft: "0.5rem" }}>
                    · {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="dir-grid">
            {filtered.length === 0 && !isLoading ? (
              <div className="dir-empty" style={{ gridColumn: "1 / -1" }}>
                <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#1A2B35", margin: "0 0 0.5rem" }}>No organizations found</p>
                <p style={{ margin: 0 }}>Try adjusting your search or filters.</p>
                <button
                  onClick={clearFilters}
                  style={{ marginTop: "1.25rem", background: "#1E3A4A", color: "#ffffff", fontWeight: 600, fontSize: "0.875rem", padding: "0.625rem 1.5rem", border: "none", cursor: "pointer", borderRadius: "6px" }}
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              filtered.map((org) => (
                <OrgCard key={org.id} org={org} onConnect={setModalOrg} isProvider={isProvider} />
              ))
            )}
          </div>
        </div>

        <Footer />
      </div>

      {modalOrg && isProvider && (
        <ConnectionModal org={modalOrg} onClose={() => setModalOrg(null)} />
      )}
    </>
  );
}
