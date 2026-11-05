export default function DemoBanner() {
  const isDemo = new URLSearchParams(window.location.search).get("demo") === "1";
  if (!isDemo) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: "#1E3A4A",
      borderTop: "2px solid #2A9D8F",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.625rem",
      padding: "0.5rem 1rem",
      fontSize: "0.8125rem",
      color: "#fff",
    }}>
      <span style={{ fontSize: "1rem" }}>🧪</span>
      <strong style={{ color: "#2A9D8F" }}>Demo Mode</strong>
      <span style={{ color: "#A8C0CC" }}>— Nothing you submit here is real. Safe to explore.</span>
    </div>
  );
}
