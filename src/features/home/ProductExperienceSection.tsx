export default function ProductExperienceSection() {
  return (
    <>
      <style>{`
        .product-section {
          background: #1E3A4A;
          padding: 7rem 2rem;
          overflow: hidden;
        }
        .product-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          gap: 5rem;
          align-items: center;
        }
        .product-eyebrow {
          color: #2A9D8F;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin: 0 0 0.875rem;
        }
        .product-h2 {
          color: #ffffff;
          font-size: clamp(1.875rem, 3vw, 2.5rem);
          font-weight: 800;
          line-height: 1.15;
          margin: 0;
        }
        .product-sub {
          color: rgba(255,255,255,0.65);
          font-size: 1rem;
          line-height: 1.8;
          margin: 1.25rem 0 0;
        }
        .product-bullets {
          list-style: none;
          padding: 0;
          margin: 2rem 0 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .product-bullets li {
          display: flex;
          align-items: flex-start;
          gap: 0.875rem;
          color: rgba(255,255,255,0.80);
          font-size: 0.9375rem;
          line-height: 1.6;
        }
        .product-bullets li::before {
          content: "";
          width: 6px;
          height: 6px;
          background: #2A9D8F;
          border-radius: 50%;
          margin-top: 0.55rem;
          flex-shrink: 0;
        }
        .product-fictional-label {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #E9A26B;
          background: rgba(233,162,107,0.14);
          border: 1px solid rgba(233,162,107,0.3);
          padding: 0.3rem 0.75rem;
          border-radius: 2px;
          margin-bottom: 1.25rem;
        }
        .product-card {
          background: #ffffff;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .product-card-header {
          background: #1E3A4A;
          padding: 1.25rem 1.5rem 1rem;
          border-bottom: 1px solid #2D4E60;
        }
        .product-card-eyebrow {
          color: #2A9D8F;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin: 0 0 0.375rem;
        }
        .product-card-name {
          color: #ffffff;
          font-size: 1.1875rem;
          font-weight: 800;
          margin: 0 0 0.25rem;
        }
        .product-card-meta {
          color: rgba(255,255,255,0.5);
          font-size: 0.8125rem;
          margin: 0;
        }
        .product-card-body {
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }
        .product-card-row {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
        }
        .product-card-row-label {
          color: #5C7380;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          min-width: 100px;
          padding-top: 1px;
          flex-shrink: 0;
        }
        .product-card-row-value {
          color: #1A2B35;
          font-size: 0.875rem;
          line-height: 1.55;
        }
        .product-card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }
        .product-tag {
          background: rgba(42,157,143,0.1);
          color: #2A9D8F;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.25rem 0.625rem;
          border-radius: 2px;
        }
        .product-card-divider {
          border: none;
          border-top: 1px solid #E2E8E6;
          margin: 0;
        }
        .product-card-footer {
          padding: 1rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        .product-card-contact {
          font-size: 0.8125rem;
          color: #5C7380;
        }
        .product-card-contact strong {
          color: #1A2B35;
          display: block;
          font-size: 0.875rem;
        }
        .product-card-btn {
          background: #2A9D8F;
          color: #ffffff;
          font-size: 0.8125rem;
          font-weight: 700;
          padding: 0.625rem 1.25rem;
          border: none;
          border-radius: 2px;
          cursor: default;
          white-space: nowrap;
        }
        @media (max-width: 900px) {
          .product-inner { grid-template-columns: 1fr; gap: 3.5rem; }
          .product-section { padding: 5rem 1.25rem; }
        }
      `}</style>

      <section className="product-section">
        <div className="product-inner">
          {/* Left — text */}
          <div>
            <p className="product-eyebrow">Product Experience</p>
            <h2 className="product-h2">What a Lattice listing looks like.</h2>
            <p className="product-sub">
              Every verified member gets a full profile: named contact, service
              categories, county coverage, and current capacity — maintained by
              the network and visible to member organizations.
            </p>
            <ul className="product-bullets">
              <li>Named point of contact, not a general inbox</li>
              <li>Current service availability updated by the org</li>
              <li>Service categories tied to real coordination needs</li>
              <li>Direct connection request pathway through TSE</li>
            </ul>
          </div>

          {/* Right — illustrative card */}
          <div>
            <p className="product-fictional-label">Illustrative — not a real organization</p>
            <div className="product-card">
              <div className="product-card-header">
                <p className="product-card-eyebrow">Faith-Based · Nonprofit</p>
                <p className="product-card-name">Cornerstone Community Ministries</p>
                <p className="product-card-meta">Floyd County · Rome, Georgia</p>
              </div>

              <div className="product-card-body">
                <div className="product-card-row">
                  <span className="product-card-row-label">Services</span>
                  <div className="product-card-tags">
                    <span className="product-tag">Food Pantry</span>
                    <span className="product-tag">Clothing Closet</span>
                    <span className="product-tag">Utility Assistance</span>
                    <span className="product-tag">Transitional Housing</span>
                  </div>
                </div>
                <div className="product-card-row">
                  <span className="product-card-row-label">Coverage</span>
                  <span className="product-card-row-value">Floyd, Polk, Chattooga Counties</span>
                </div>
                <div className="product-card-row">
                  <span className="product-card-row-label">Capacity</span>
                  <span className="product-card-row-value" style={{ color: "#2A9D8F", fontWeight: 600 }}>Accepting referrals</span>
                </div>
              </div>

              <hr className="product-card-divider" />

              <div className="product-card-footer">
                <div className="product-card-contact">
                  <strong>Sandra Okafor</strong>
                  Outreach Coordinator
                </div>
                <div className="product-card-btn">Request Connection</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
