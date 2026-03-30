import { execa } from "execa";
import fs from "fs/promises";
import path from "path";
import type { UserChoices } from "./types.js";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function write(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function appendEnv(envPath: string, vars: Record<string, string>) {
  const existing = await fs.readFile(envPath, "utf8").catch(() => "");
  const lines = Object.entries(vars)
    .filter(([key]) => !existing.includes(key))
    .map(([key, val]) => `${key}="${val}"`)
    .join("\n");
  if (lines) await fs.appendFile(envPath, `\n${lines}\n`);
}

async function install(
  packageManager: UserChoices["packageManager"],
  projectDir: string,
  deps: string[],
  devDeps: string[] = [],
) {
  const cmd = packageManager === "npm" ? "install" : "add";
  if (deps.length) {
    await execa(packageManager, [cmd, ...deps], {
      cwd: projectDir,
      stdio: "inherit",
    });
  }
  if (devDeps.length) {
    const devFlag = packageManager === "npm" ? "--save-dev" : "-D";
    await execa(packageManager, [cmd, devFlag, ...devDeps], {
      cwd: projectDir,
      stdio: "inherit",
    });
  }
}

// ─────────────────────────────────────────────
// Patch layout.tsx to wrap with a provider
// ─────────────────────────────────────────────

async function patchLayout(
  layoutPath: string,
  providerImport: string,
  wrapOpen: string,
  wrapClose: string,
) {
  let layout = await fs.readFile(layoutPath, "utf8");

  // Inject import after the last existing import line
  const lastImportIdx = layout.lastIndexOf("import ");
  const afterImport = layout.indexOf("\n", lastImportIdx) + 1;
  layout =
    layout.slice(0, afterImport) +
    providerImport +
    "\n" +
    layout.slice(afterImport);

  // Wrap {children} with provider
  layout = layout.replace(
    "{children}",
    `${wrapOpen}\n          {children}\n          ${wrapClose}`,
  );

  await fs.writeFile(layoutPath, layout, "utf8");
}

// ─────────────────────────────────────────────
// NextAuth v5 (Auth.js)
// ─────────────────────────────────────────────

async function setupNextAuth(choices: UserChoices, projectDir: string) {
  const { packageManager } = choices;

  console.log("  📦 Installing NextAuth v5…");
  await install(packageManager, projectDir, ["next-auth@beta"]);

  const envPath = path.join(projectDir, ".env.local");
  await appendEnv(envPath, {
    // Generate with: openssl rand -base64 33
    AUTH_SECRET: "REPLACE_WITH_OUTPUT_OF_openssl_rand_-base64_33",
    AUTH_GITHUB_ID: "your-github-client-id",
    AUTH_GITHUB_SECRET: "your-github-client-secret",
    AUTH_GOOGLE_ID: "your-google-client-id",
    AUTH_GOOGLE_SECRET: "your-google-client-secret",
  });

  // auth.ts — root config file (v5 pattern)
  await write(
    path.join(projectDir, "auth.ts"),
    `import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub,
    Google,
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = nextUrl.pathname.startsWith("/dashboard");
      if (isProtected && !isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }
      return true;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
`,
  );

  // app/api/auth/[...nextauth]/route.ts
  await write(
    path.join(projectDir, "app", "api", "auth", "[...nextauth]", "route.ts"),
    `import { handlers } from "@/auth";
export const { GET, POST } = handlers;
`,
  );

  // middleware.ts — runs auth() on every request
  await write(
    path.join(projectDir, "middleware.ts"),
    `import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // req.auth is populated when the user is signed in
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
`,
  );

  // lib/auth-helpers.ts — server-side helper
  await write(
    path.join(projectDir, "lib", "auth-helpers.ts"),
    `import { auth } from "@/auth";
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
`,
  );

  // app/login/page.tsx — placeholder sign-in page
  await write(
    path.join(projectDir, "app", "login", "page.tsx"),
    `import { signIn } from "@/auth";

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
`,
  );

  console.log("\n  ✅ NextAuth v5 ready.");
  console.log("  📌 Next steps:");
  console.log("     1. Set AUTH_SECRET in .env.local:");
  console.log("        openssl rand -base64 33");
  console.log("     2. Create OAuth apps and fill in provider credentials");
  console.log("     3. Visit /login to test sign-in\n");
}

// ─────────────────────────────────────────────
// Clerk
// ─────────────────────────────────────────────

async function setupClerk(choices: UserChoices, projectDir: string) {
  const { packageManager } = choices;

  console.log("  📦 Installing @clerk/nextjs…");
  await install(packageManager, projectDir, ["@clerk/nextjs"]);

  // .env.local keys
  const envPath = path.join(projectDir, ".env.local");
  await appendEnv(envPath, {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_REPLACE_ME",
    CLERK_SECRET_KEY: "sk_test_REPLACE_ME",
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/dashboard",
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/dashboard",
  });

  // middleware.ts
  await write(
    path.join(projectDir, "middleware.ts"),
    `import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/settings(.*)",
  "/profile(.*)",
  "/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect(); // redirects to /sign-in if unauthenticated
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
`,
  );

  // Patch app/layout.tsx to wrap with <ClerkProvider>
  const layoutPath = path.join(projectDir, "app", "layout.tsx");
  await patchLayout(
    layoutPath,
    `import { ClerkProvider } from "@clerk/nextjs";`,
    "<ClerkProvider>",
    "</ClerkProvider>",
  );

  // app/sign-in/[[...sign-in]]/page.tsx
  await write(
    path.join(projectDir, "app", "sign-in", "[[...sign-in]]", "page.tsx"),
    `import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignIn />
    </main>
  );
}
`,
  );

  // app/sign-up/[[...sign-up]]/page.tsx
  await write(
    path.join(projectDir, "app", "sign-up", "[[...sign-up]]", "page.tsx"),
    `import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignUp />
    </main>
  );
}
`,
  );

  // lib/auth-helpers.ts
  await write(
    path.join(projectDir, "lib", "auth-helpers.ts"),
    `import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Use in Server Components / Route Handlers.
 * Returns the Clerk Auth object, redirects to /sign-in if not authenticated.
 */
export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
}

/**
 * Returns the full Clerk User object for the currently signed-in user.
 */
export async function getCurrentUser() {
  return await currentUser();
}
`,
  );

  console.log("\n  ✅ Clerk ready.");
  console.log("  📌 Next steps:");
  console.log("     1. Create a Clerk application at https://clerk.com");
  console.log("     2. Copy your API keys into .env.local");
  console.log("     3. Visit /sign-in to test authentication\n");
}

// ─────────────────────────────────────────────
// JWT (custom — jose + bcryptjs)
// ─────────────────────────────────────────────

async function setupJWT(choices: UserChoices, projectDir: string) {
  const { packageManager } = choices;

  console.log("  📦 Installing jose + bcryptjs…");
  // jose  — edge-compatible JWT (jsonwebtoken does NOT work in middleware)
  // bcryptjs — password hashing (pure JS, works everywhere)
  await install(
    packageManager,
    projectDir,
    ["jose", "bcryptjs"],
    ["@types/bcryptjs"],
  );

  // .env.local
  const envPath = path.join(projectDir, ".env.local");
  await appendEnv(envPath, {
    // Generate with: openssl rand -base64 32
    JWT_SECRET: "REPLACE_WITH_OUTPUT_OF_openssl_rand_-base64_32",
    JWT_EXPIRES_IN: "15m",
    JWT_REFRESH_EXPIRES_IN: "7d",
  });

  // lib/jwt.ts — sign + verify (jose, edge-safe)
  await write(
    path.join(projectDir, "lib", "jwt.ts"),
    `import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export interface JWTUser extends JWTPayload {
  id: string;
  email: string;
  role?: string;
}

/**
 * Sign a JWT. Works in both Node.js (API routes) and the Edge Runtime (middleware).
 */
export async function signJWT(
  payload: Omit<JWTUser, keyof JWTPayload>,
  expiresIn: string = process.env.JWT_EXPIRES_IN ?? "15m",
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

/**
 * Verify a JWT and return its payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyJWT(token: string): Promise<JWTUser> {
  const { payload } = await jwtVerify(token, secret);
  return payload as JWTUser;
}
`,
  );

  // lib/auth-helpers.ts — cookie + session helpers
  await write(
    path.join(projectDir, "lib", "auth-helpers.ts"),
    `import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT, type JWTUser } from "./jwt";

export const AUTH_COOKIE = "auth-token";

/**
 * Read and verify the auth cookie in a Server Component or Route Handler.
 * Returns the decoded JWT payload, or null if missing/invalid.
 */
export async function getSession(): Promise<JWTUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyJWT(token);
  } catch {
    return null;
  }
}

/**
 * Like getSession(), but redirects to /login if the user is not authenticated.
 */
export async function requireAuth(): Promise<JWTUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
`,
  );

  // middleware.ts — verify JWT on every protected request (jose, edge-safe)
  await write(
    path.join(projectDir, "middleware.ts"),
    `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/jwt";

const PROTECTED_ROUTES = ["/dashboard", "/settings", "/profile", "/admin"];
const PUBLIC_ROUTES = ["/login", "/register", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const payload = await verifyJWT(token);
    const response = NextResponse.next();
    // Forward user info as request headers for Server Components
    response.headers.set("x-user-id", payload.id);
    response.headers.set("x-user-email", payload.email);
    if (payload.role) response.headers.set("x-user-role", payload.role);
    return response;
  } catch {
    // Token invalid or expired — clear cookie and redirect
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth-token");
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
`,
  );

  // app/api/auth/login/route.ts
  await write(
    path.join(projectDir, "app", "api", "auth", "login", "route.ts"),
    `import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signJWT } from "@/lib/jwt";

// TODO: replace with your real DB query
async function findUserByEmail(_email: string) {
  // e.g. return db.user.findUnique({ where: { email } });
  return null as null | { id: string; email: string; passwordHash: string; role: string };
}

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await findUserByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signJWT({ id: user.id, email: user.email, role: user.role });

  const response = NextResponse.json({ message: "Logged in" });
  response.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15, // 15 minutes — match JWT_EXPIRES_IN
  });

  return response;
}
`,
  );

  // app/api/auth/logout/route.ts
  await write(
    path.join(projectDir, "app", "api", "auth", "logout", "route.ts"),
    `import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out" });
  response.cookies.delete("auth-token");
  return response;
}
`,
  );

  // app/api/auth/register/route.ts
  await write(
    path.join(projectDir, "app", "api", "auth", "register", "route.ts"),
    `import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signJWT } from "@/lib/jwt";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // TODO: check if user already exists in your DB
  // const existing = await db.user.findUnique({ where: { email } });
  // if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);

  // TODO: save user to your DB
  // const user = await db.user.create({ data: { email, passwordHash } });
  const user = { id: "placeholder-id", email, role: "user" }; // replace with real DB call

  const token = await signJWT({ id: user.id, email: user.email, role: user.role });

  const response = NextResponse.json({ message: "Registered" }, { status: 201 });
  response.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });

  return response;
}
`,
  );

  console.log("\n  ✅ JWT auth ready.");
  console.log("  📌 Next steps:");
  console.log("     1. Set JWT_SECRET in .env.local:");
  console.log("        openssl rand -base64 32");
  console.log("     2. Wire up your DB queries in the TODO blocks in:");
  console.log("        app/api/auth/login/route.ts");
  console.log("        app/api/auth/register/route.ts");
  console.log(
    "     3. POST to /api/auth/login with { email, password } to test\n",
  );
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export async function setupAuth(choices: UserChoices): Promise<void> {
  const { authentication, projectName } = choices;
  const projectDir = path.join(process.cwd(), projectName);

  console.log(`\n🔐  Setting up authentication (${authentication})…\n`);

  try {
    switch (authentication) {
      case "nextauth":
        await setupNextAuth(choices, projectDir);
        break;
      case "clerk":
        await setupClerk(choices, projectDir);
        break;
      case "jwt":
        await setupJWT(choices, projectDir);
        break;
    }
  } catch (error) {
    console.error(`\n❌ Auth setup failed: ${error}`);
    throw error;
  }
}
