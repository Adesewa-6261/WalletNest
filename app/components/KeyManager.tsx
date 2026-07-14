"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface KeyView {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function KeyManager({
  email,
  initialKeys,
}: {
  email: string;
  initialKeys: KeyView[];
}) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The plaintext of a key the user just created. Held in memory only, and only
  // until they navigate away — the server cannot show it again.
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        setError("Could not create the key. Try again.");
        return;
      }

      const { key, plaintext } = await res.json();
      setJustCreated(plaintext);
      setCopied(false);
      setKeys((prev) => [
        { ...key, lastUsedAt: null, revokedAt: null },
        ...prev,
      ]);
      setName("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string, keyName: string) {
    if (
      !confirm(
        `Revoke "${keyName}"?\n\nAny app using this key will start failing immediately. This cannot be undone.`
      )
    ) {
      return;
    }

    const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not revoke that key.");
      return;
    }

    setKeys((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k
      )
    );
  }

  async function copyKey() {
    if (!justCreated) return;
    await navigator.clipboard.writeText(justCreated);
    setCopied(true);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const active = keys.filter((k) => !k.revokedAt);

  return (
    <main className="keys-shell">
      <header className="keys-head">
        <div>
          <h1>API keys</h1>
          <div className="who">{email}</div>
        </div>
        <button className="linkish" onClick={logout}>
          Sign out
        </button>
      </header>

      {error && <div className="form-error">{error}</div>}

      {justCreated && (
        <div className="reveal">
          <h2>Copy your key now</h2>
          <p>
            This is the only time it will ever be shown. We store a hash, not the
            key, so we genuinely cannot show it to you again.
          </p>
          <div className="reveal-key">
            <code>{justCreated}</code>
            <button onClick={copyKey}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
        </div>
      )}

      <form className="create-bar" onSubmit={createKey}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name — e.g. 'my bot', 'staging'"
          maxLength={60}
        />
        <button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create key"}
        </button>
      </form>

      {keys.length === 0 ? (
        <p className="empty">
          No keys yet. Create one above to start calling the API.
        </p>
      ) : (
        keys.map((k) => (
          <div
            key={k.id}
            className={`key-row ${k.revokedAt ? "revoked" : ""}`}
          >
            <div>
              <div className="key-name">
                {k.name}
                {k.revokedAt && <span className="pill">revoked</span>}
              </div>
              <div className="key-meta">
                {k.keyPrefix}… · created {formatDate(k.createdAt)} · last used{" "}
                {formatDate(k.lastUsedAt)}
              </div>
            </div>
            {!k.revokedAt && (
              <button
                className="btn-revoke"
                onClick={() => revoke(k.id, k.name)}
              >
                Revoke
              </button>
            )}
          </div>
        ))
      )}

      {active.length > 0 && (
        <p className="hint" style={{ marginTop: 20 }}>
          Send your key as <code>Authorization: Bearer …</code>, plus your own{" "}
          <code>X-Alchemy-Key</code>. Revoking takes effect immediately — there
          is no cache to wait out.
        </p>
      )}
    </main>
  );
}
