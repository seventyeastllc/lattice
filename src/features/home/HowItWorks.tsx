import { useState } from "react";

const steps = [
  {
    step: "STEP 01",
    title: "Search with confidence",
    body: "Browse a verified, curated directory of partner organizations. Every listing includes a named point of contact, current service offerings, and capacity status — updated by the network, not scraped from an outdated website.",
  },
  {
    step: "STEP 02",
    title: "Initiate a facilitated connection",
    body: "Request a connection through Lattice. Your request is triaged by a TSE coordinator before it reaches the partner — no cold calls, no general inboxes, no dropped referrals.",
  },
  {
    step: "STEP 03",
    title: "Track and coordinate",
    body: "Lattice keeps a record of every connection request. TSE follows up, tracks movement, and ensures the referral results in something — not just a log entry.",
  },
];

function Step({ step, title, body }: { step: string; title: string; body: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderLeft: `3px solid ${hovered ? "#2A9D8F" : "#E2E8E6"}`,
        paddingLeft: "2rem",
        transition: "border-color 0.2s",
      }}
    >
      <p
        style={{
          color: "#2A9D8F",
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.15em",
          margin: 0,
        }}
      >
        {step}
      </p>
      <h3
        style={{
          color: "#1A2B35",
          fontSize: "1.25rem",
          fontWeight: 700,
          marginTop: "0.6rem",
          marginBottom: 0,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: "#5C7380",
          fontSize: "0.95rem",
          lineHeight: 1.8,
          marginTop: "0.75rem",
          marginBottom: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section style={{ background: "#ffffff", padding: "8rem 0" }}>
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
          The Platform
        </p>

        {/* Headline */}
        <h2
          style={{
            color: "#1A2B35",
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            fontWeight: 800,
            lineHeight: 1.15,
            marginTop: "1rem",
            marginBottom: 0,
          }}
        >
          From search to coordination
          <br />
          in three steps.
        </h2>

        {/* Subhead */}
        <p
          style={{
            color: "#5C7380",
            fontSize: "1rem",
            lineHeight: 1.75,
            maxWidth: "42rem",
            marginTop: "1rem",
            marginBottom: 0,
          }}
        >
          Lattice replaces the outdated resource list, the unanswered call, and the
          stalled referral — with a governed network that keeps coordination moving.
        </p>

        {/* Steps */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "3rem",
            marginTop: "4.5rem",
          }}
        >
          {steps.map((s) => (
            <Step key={s.step} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
