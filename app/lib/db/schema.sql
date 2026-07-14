-- WalletNest: users and their API keys.
-- Applied by `npm run db:migrate`. Safe to re-run.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Emails are compared case-insensitively: Ada@x.com and ada@x.com are one
-- account. A plain UNIQUE(email) would let both exist and silently split a
-- user in two, so the constraint lives on the lowercased form instead.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- A human label so a user can tell their keys apart ("staging", "my bot").
  name         TEXT NOT NULL,

  -- SHA-256 of the key, hex. The plaintext key is shown once at creation and
  -- never stored, so a database leak cannot be turned back into working keys.
  key_hash     TEXT NOT NULL UNIQUE,

  -- First few characters of the plaintext ("wnk_live_A7x…"), for display only.
  -- Lets a user recognise a key in a list without us storing the secret.
  key_prefix   TEXT NOT NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,

  -- Revocation is a timestamp, not a DELETE: a revoked key's row still proves
  -- the key existed and when it died. NULL means active.
  revoked_at   TIMESTAMPTZ
);

-- Every authenticated API request looks a key up by its hash, so this index is
-- the hot path for the whole API.
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id);
