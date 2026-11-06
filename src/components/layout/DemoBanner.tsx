import { useAuth } from "@/context/AuthContext";
import type { DemoRole } from "@/context/AuthContext";

const roles: { value: DemoRole; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

export default function DemoBanner() {
  const { demoRole, setDemoRole } = useAuth();
  if (!demoRole) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: "#0f2535",
      borderTop: "2px solid #2A9D8F",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "1rem",
      padding: "0.5rem 1rem",
      fontSize: "0.8125rem",
      color: "#fff",
      flexWrap: "wrap",
    }}>
      <span style={{ fontSize: "1rem" }}>🧪</span>
      <strong style={{ color: "#2A9D8F" }}>Demo Mode</strong>
      <span style={{ color: "#A8C0CC" }}>View as:</span>
      <div style={{ display: "flex", gap: "0.375rem" }}>
        {roles.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setDemoRole(value)}
            style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "1rem",
              border: "1.5px solid",
              borderColor: demoRole === value ? "#2A9D8F" : "#2d4f63",
              background: demoRole === value ? "#2A9D8F" : "transparent",
              color: demoRole === value ? "#fff" : "#7fb5c8",
              fontWeight: demoRole === value ? 700 : 400,
              fontSize: "0.8125rem",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <span style={{ color: "#6a8fa0", fontSize: "0.75rem" }}>Nothing you submit is real.</span>
    </div>
  );
}
