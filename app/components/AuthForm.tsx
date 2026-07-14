"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  mode: "signup" | "login";
}

// Shared by /signup and /login — the two forms differ only in wording and which
// endpoint they post to, so keeping them as one component means a fix to the
// error handling can't land on only one of them.
export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Something went wrong. Try again.");
        return;
      }

      // The session cookie is set by the response. refresh() makes the server
      // components re-run so /keys sees the new session.
      router.push("/keys");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-sub">
          {isSignup
            ? "Sign up to generate API keys for the WalletNest API."
            : "Sign in to manage your API keys."}
        </p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignup ? 10 : undefined}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="••••••••••"
            />
            {isSignup && <p className="hint">At least 10 characters.</p>}
          </label>

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="auth-alt">
          {isSignup ? (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              No account yet? <Link href="/signup">Sign up</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
