const stats = [
  { number: "47", label: "Partner Organizations" },
  { number: "12", label: "Counties Served" },
  { number: "4", label: "Service Categories" },
  { number: "Fall 2026", label: "Platform Launch" },
];

export default function StatsCallout() {
  return (
    <section style={{ background: "#2A9D8F", padding: "4rem 0" }}>
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 2rem",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
        }}
      >
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              padding: "0 2rem",
              borderRight:
                i < stats.length - 1 ? "1px solid rgba(255,255,255,0.2)" : "none",
            }}
          >
            <p
              style={{
                color: "#ffffff",
                fontSize: "3.5rem",
                fontWeight: 800,
                lineHeight: 1,
                margin: 0,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
              }}
            >
              {stat.number}
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.75)",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginTop: "0.75rem",
                marginBottom: 0,
              }}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
