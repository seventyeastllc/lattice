const stats = [
  { number: "800+", label: "Resource Providers Mapped" },
  { number: "15", label: "Counties in Northwest Georgia" },
  { number: "8+", label: "Service Categories" },
  { number: "Now Live", label: "Join the Network Today" },
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
