import { auth } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Use in Server Components / Route Handlers to get the current session.
 * Redirects to /login if the user is not authenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}
