import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
        >
          Sign in with GitHub
        </button>
      </form>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-500"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
