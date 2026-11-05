const benefits = [
  {
    icon: "✓",
    title: "No PHI stored on this platform",
    body: "Lattice holds coordination data only. Clinical records and case notes stay with the organizations that hold the service relationship.",
  },
  {
    icon: "✓",
    title: "Verified contacts, not general inboxes",
    body: "Every listing is maintained by the network. Named contacts, direct lines, real capacity status.",
  },
  {
    icon: "✓",
    title: "Outcome-oriented by design",
    body: "Success is measured at engagement, sustained contact, and resolution — not at the referral step.",
  },
];

export default function WhyLattice() {
  return (
    <section style={{ background: "#1E3A4A", padding: "8rem 0" }}>
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 2rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "5rem",
          alignItems: "start",
        }}
      >
        {/* LEFT — text */}
        <div>
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
            Why It Works
          </p>

          <h2
            style={{
              color: "#ffffff",
              fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)",
              fontWeight: 800,
              lineHeight: 1.2,
              marginTop: "1rem",
              marginBottom: 0,
            }}
          >
            The referral was made.
            <br />
            So why didn't they
            <br />
            get there?
          </h2>

          <p
            style={{
              color: "rgba(255,255,255,0.70)",
              fontSize: "1rem",
              lineHeight: 1.9,
              marginTop: "1.5rem",
              marginBottom: 0,
            }}
          >
            Most coordination tools stop at the referral. They log it, timestamp it,
            and move on. Lattice doesn't. Every connection request is triaged by a
            live coordinator. Every pathway is tracked. And the measure of success
            isn't whether the referral was sent — it's whether the person's situation
            actually changed.
          </p>

          <p
            style={{
              color: "rgba(255,255,255,0.70)",
              fontSize: "1rem",
              lineHeight: 1.9,
              marginTop: "1.25rem",
              marginBottom: 0,
            }}
          >
            Lattice holds demographics, partnerships, and coordination capacity — not
            clinical records, not HMIS data, not case notes. Your clients' information
            stays where it belongs: with you.
          </p>

          <a
            href="#about"
            style={{
              color: "#2A9D8F",
              fontSize: "0.9375rem",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
              marginTop: "2.5rem",
              transition: "text-decoration 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.textDecoration = "underline")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.textDecoration = "none")
            }
          >
            See how Lattice works →
          </a>
        </div>

        {/* RIGHT — benefit blocks */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {benefits.map((b) => (
            <div
              key={b.title}
              style={{ display: "flex", alignItems: "flex-start", gap: "1.25rem" }}
            >
              {/* Icon square */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: "rgba(42,157,143,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#2A9D8F",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                }}
              >
                {b.icon}
              </div>

              {/* Text */}
              <div>
                <p
                  style={{
                    color: "#ffffff",
                    fontSize: "1rem",
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  {b.title}
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.60)",
                    fontSize: "0.9rem",
                    lineHeight: 1.7,
                    marginTop: "0.4rem",
                    marginBottom: 0,
                  }}
                >
                  {b.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
