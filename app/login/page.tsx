import { redirect } from "next/navigation";
import { getSessionUserId } from "@/app/lib/auth/session";
import { AuthForm } from "@/app/components/AuthForm";
import "../account.css";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUserId()) redirect("/keys");
  return <AuthForm mode="login" />;
}
