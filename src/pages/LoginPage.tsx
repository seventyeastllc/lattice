import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      navigate("/dashboard");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F7F9F8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      }}
    >
      {/* Logo mark */}
      <div style={{ marginBottom: "2rem", textAlign: "center" }}>
        <img
          src="/Lattice%20Icon%201.png"
          alt="Lattice"
          style={{ height: "48px", marginBottom: "0.75rem" }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <p style={{ color: "#5C7380", fontSize: "0.875rem" }}>
          Sign in to your Lattice account
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8E6",
          borderRadius: "12px",
          padding: "2.5rem",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#1A2B35",
            marginBottom: "1.75rem",
          }}
        >
          Welcome back
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label
              htmlFor="email"
              style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1A2B35" }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "0.625rem 0.875rem",
                border: "1.5px solid #E2E8E6",
                borderRadius: "8px",
                fontSize: "0.9375rem",
                color: "#1A2B35",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2A9D8F")}
              onBlur={(e) => (e.target.style.borderColor = "#E2E8E6")}
            />
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label
                htmlFor="password"
                style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1A2B35" }}
              >
                Password
              </label>
              <a
                href="#"
                style={{
                  fontSize: "0.8125rem",
                  color: "#2A9D8F",
                  textDecoration: "none",
                }}
              >
                Forgot password?
              </a>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: "0.625rem 0.875rem",
                border: "1.5px solid #E2E8E6",
                borderRadius: "8px",
                fontSize: "0.9375rem",
                color: "#1A2B35",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2A9D8F")}
              onBlur={(e) => (e.target.style.borderColor = "#E2E8E6")}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                fontSize: "0.875rem",
                color: "#B91C1C",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: loading ? "#4A7C6F" : "#2A9D8F",
              color: "#FFFFFF",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background-color 0.15s",
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            borderTop: "1px solid #E2E8E6",
            margin: "1.75rem 0 1.25rem",
          }}
        />

        <p style={{ fontSize: "0.875rem", color: "#5C7380", textAlign: "center" }}>
          Not a member?{" "}
          <Link
            to="/#join"
            style={{ color: "#2A9D8F", fontWeight: 500, textDecoration: "none" }}
          >
            Join the Network
          </Link>
        </p>
      </div>

      {/* Back to home */}
      <Link
        to="/"
        style={{
          marginTop: "1.5rem",
          fontSize: "0.875rem",
          color: "#5C7380",
          textDecoration: "none",
        }}
      >
        ← Back to home
      </Link>
    </div>
  );
}
