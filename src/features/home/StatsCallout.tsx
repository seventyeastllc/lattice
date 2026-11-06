const stats = [
  { number: "800+", label: "Resource Providers Mapped" },
  { number: "15",   label: "Counties Currently Represented" },
  { number: "8+",   label: "Service Categories" },
  { number: "Live", label: "Network Is Open" },
];

export default function StatsCallout() {
  return (
    <>
      <style>{`
        .stats-section {
          background: #2A9D8F;
          padding: 3.5rem 2rem;
        }
        .stats-grid {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
        }
        .stat-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 0.5rem 2rem;
          border-right: 1px solid rgba(255,255,255,0.18);
        }
        .stat-cell:last-child { border-right: none; }
        .stat-number {
          color: #ffffff;
          font-size: clamp(2.5rem, 4vw, 3.5rem);
          font-weight: 800;
          line-height: 1;
          margin: 0;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .stat-label {
          color: rgba(255,255,255,0.78);
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin: 0.625rem 0 0;
        }
        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem 0;
          }
          .stat-cell {
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.18);
            padding-bottom: 1.5rem;
          }
          .stat-cell:nth-child(2n) { border-right: none; }
          .stat-cell:nth-last-child(-n+2) { border-bottom: none; }
        }
      `}</style>

      <section className="stats-section">
        <div className="stats-grid">
          {stats.map((s) => (
            <div key={s.label} className="stat-cell">
              <p className="stat-number">{s.number}</p>
              <p className="stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
