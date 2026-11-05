import { useState } from "react";

const cards = [
  {
    role: "Case Managers & Referral Coordinators",
    body: "Your job doesn't end at the referral — and neither does ours. Lattice gives you a verified contact at every partner organization, current service availability, and a direct pathway to coordinate — so the connection you make actually lands.",
  },
  {
    role: "Faith-Based Organizations",
    body: "You were never meant to meet every need alone. Lattice helps faith-based organizations stay rooted in what they do best while building stronger connections to providers who can support the gaps — and send people your way when your ministry is exactly what's needed.",
  },
  {
    role: "School Social Workers",
    body: "Schools are often the first place families show signs of crisis. Lattice helps school social workers quickly identify trusted community partners, understand available capacity, and coordinate support before instability escalates.",
  },
  {
    role: "Community Providers",
    body: "If your work helps people move toward stability, your organization plays a vital role in this network. Lattice helps community providers become more visible, connected, and easier to coordinate with across systems of care.",
  },
];

function Card({ role, body }: { role: string; body: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#ffffff",
        border: "1px solid #E2E8E6",
        borderTop: "3px solid #2A9D8F",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        boxShadow: hovered ? "0 4px 24px rgba(0,0,0,0.06)" : "none",
        transition: "box-shadow 0.2s",
      }}
    >
      <h3
        style={{
          color: "#1A2B35",
          fontSize: "1.1rem",
          fontWeight: 700,
          margin: 0,
        }}
      >
        {role}
      </h3>
      <div
        style={{
          borderTop: "1px solid #E2E8E6",
          marginTop: "1rem",
          marginBottom: "1rem",
        }}
      />
      <p
        style={{
          color: "#374151",
          fontSize: "0.95rem",
          lineHeight: 1.8,
          margin: 0,
          flexGrow: 1,
        }}
      >
        {body}
      </p>
    </div>
  );
}

export default function WhoThisIsFor() {
  return (
    <section style={{ background: "#F7F9F8", padding: "8rem 0" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 2rem" }}>
        {/* Eyebrow */}
        <p
          style={{
            color: "#2A9D8F",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Who This Is For
        </p>

        {/* Headline */}
        <h2
          style={{
            color: "#1A2B35",
            fontSize: "clamp(1.875rem, 4vw, 2.75rem)",
            fontWeight: 800,
            lineHeight: 1.2,
            maxWidth: "42rem",
            marginTop: "1rem",
            marginBottom: 0,
          }}
        >
          Coordination works better when the right people can find each other.
        </h2>

        {/* Subhead */}
        <p
          style={{
            color: "#5C7380",
            fontSize: "1rem",
            lineHeight: 1.75,
            maxWidth: "46rem",
            marginTop: "1rem",
            marginBottom: 0,
          }}
        >
          Lattice helps providers, schools, ministries, and community organizations
          strengthen visibility, streamline collaboration, and respond to complex needs
          with greater clarity and connection.
        </p>

        {/* 2×2 Card Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "1.5rem",
            marginTop: "4rem",
          }}
          className="grid-cols-1 md:grid-cols-2"
        >
          {cards.map((c) => (
            <Card key={c.role} {...c} />
          ))}
        </div>
      </div>
    </section>
  );
}
