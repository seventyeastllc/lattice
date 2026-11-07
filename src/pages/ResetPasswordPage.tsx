import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type PageState = "loading" | "ready" | "submitting" | "done" | "error";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase appends #access_token=...&type=recovery to the redirect URL.
    // onAuthStateChange fires PASSWORD_RECOVERY when the token is valid.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setState("ready");
      }
    });

    // If there's no recovery token at all (direct navigation), show error.
    const hash = window.location.hash;
    if (!hash.includes("access_token") && !hash.includes("type=recovery")) {
      // Give the listener 1.5s to fire before showing the invalid-link message.
      const timer = setTimeout(() => {
        setState((s) => s === "loading" ? "error" : s);
        setErrorMsg("This link is invalid or has already been used. Please request a new one.");
      }, 1500);
      return () => { clearTimeout(timer); subscription.unsubscribe(); };
    }

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match.");
      return;
    }

    setState("submitting");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setState("ready");
      setFormError(error.message);
    } else {
      setState("done");
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "0.625rem 0.875rem",
    border: "1.5px solid #E2E8E6",
    borderRadius: "8px",
    fontSize: "0.9375rem",
    color: "#1A2B35",
    outline: "none",
    transition: "border-color 0.15s",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F9F8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ marginBottom: "2rem", textAlign: "center" }}>
        <img
          src="/Lattice%20Icon%201.png"
          alt="Lattice"
          style={{ height: "48px", marginBottom: "0.75rem" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <p style={{ color: "#5C7380", fontSize: "0.875rem" }}>Set a new password for your account</p>
      </div>

      <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8E6", borderRadius: "12px", padding: "2.5rem", width: "100%", maxWidth: "420px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

        {/* Loading */}
        {state === "loading" && (
          <p style={{ color: "#5C7380", fontSize: "0.9375rem", textAlign: "center" }}>Verifying reset link…</p>
        )}

        {/* Invalid / expired link */}
        {state === "error" && (
          <>
            <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "1rem 1.25rem", fontSize: "0.9rem", color: "#B91C1C", marginBottom: "1.5rem" }}>
              {errorMsg ?? "This reset link is invalid or has expired."}
            </div>
            <p style={{ fontSize: "0.875rem", color: "#5C7380" }}>
              <Link to="/login" style={{ color: "#2A9D8F", textDecoration: "none" }}>← Go to sign in</Link> to request a new reset link.
            </p>
          </>
        )}

        {/* New password form */}
        {(state === "ready" || state === "submitting") && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1A2B35", marginBottom: "1.75rem" }}>
              Set new password
            </h1>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label htmlFor="new-password" style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1A2B35" }}>
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "#2A9D8F")}
                  onBlur={(e) => (e.target.style.borderColor = "#E2E8E6")}
                />
                <span style={{ fontSize: "0.78rem", color: "#9DB4AE" }}>Minimum 8 characters</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label htmlFor="confirm-password" style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1A2B35" }}>
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "#2A9D8F")}
                  onBlur={(e) => (e.target.style.borderColor = "#E2E8E6")}
                />
              </div>

              {formError && (
                <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#B91C1C" }}>
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={state === "submitting"}
                style={{ backgroundColor: state === "submitting" ? "#4A7C6F" : "#2A9D8F", color: "#FFFFFF", padding: "0.75rem", borderRadius: "8px", border: "none", fontSize: "0.9375rem", fontWeight: 600, cursor: state === "submitting" ? "not-allowed" : "pointer", marginTop: "0.25rem" }}
              >
                {state === "submitting" ? "Saving…" : "Set new password"}
              </button>
            </form>
          </>
        )}

        {/* Success */}
        {state === "done" && (
          <>
            <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "1rem 1.25rem", fontSize: "0.9rem", color: "#166534", marginBottom: "1.5rem" }}>
              Your password has been updated.
            </div>
            <button
              onClick={() => navigate("/login")}
              style={{ backgroundColor: "#2A9D8F", color: "#FFFFFF", padding: "0.75rem 1.5rem", borderRadius: "8px", border: "none", fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", width: "100%" }}
            >
              Sign in with new password
            </button>
          </>
        )}
      </div>

      <Link to="/" style={{ marginTop: "1.5rem", fontSize: "0.875rem", color: "#5C7380", textDecoration: "none" }}>
        ← Back to home
      </Link>
    </div>
  );
}
