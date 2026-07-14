import { redirect } from "next/navigation";
import { getSessionUserId } from "@/app/lib/auth/session";
import { findUserById } from "@/app/lib/auth/users";
import { listApiKeys } from "@/app/lib/auth/users";
import { KeyManager, type KeyView } from "@/app/components/KeyManager";
import "../account.css";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  // A valid cookie whose user no longer exists (deleted account, or a database
  // restored from an older backup). Treat it as signed out rather than crashing.
  const user = await findUserById(userId);
  if (!user) redirect("/login");

  const rows = await listApiKeys(userId);

  const keys: KeyView[] = rows.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.key_prefix,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
    revokedAt: k.revoked_at,
  }));

  return <KeyManager email={user.email} initialKeys={keys} />;
}
