import { redirect } from "next/navigation";
import { getSessionUserId } from "@/app/lib/auth/session";
import { AuthForm } from "@/app/components/AuthForm";
import "../account.css";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // Already signed in? Skip the form.
  if (await getSessionUserId()) redirect("/keys");
  return <AuthForm mode="signup" />;
}
