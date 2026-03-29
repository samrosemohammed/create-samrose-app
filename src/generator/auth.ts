import type { Generator, TemplateContext } from "../types.js";
import { writeFile, mergeJson } from "../utils/helpers.js";
import path from "path";

export const authGenerator: Generator = {
  name: "auth",

  async run(ctx: TemplateContext): Promise<void> {
    const { has } = ctx;
    if (!has.auth) return;

    if (has.authNextAuth) {
      await generateNextAuth(ctx);
    } else if (has.authBetterAuth) {
      await generateBetterAuth(ctx);
    }
  },
};

// ─── Auth.js (NextAuth v5) ────────────────────────────────────────────────────

async function generateNextAuth(ctx: TemplateContext): Promise<void> {
  const { projectDir } = ctx.config;

  await mergeJson(path.join(projectDir, "package.json"), {
    dependencies: {
      "next-auth": "^5.0.0-beta.25",
    },
  });

  // src/auth/index.ts
  await writeFile(
    path.join(projectDir, "src/auth/index.ts"),
    `import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

// ─── Auth configuration ──────────────────────────────────────────────────────
// Add your providers here: https://authjs.dev/getting-started/providers

export const config = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      } else if (isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);
`,
  );

  // src/auth/middleware.ts
  await writeFile(
    path.join(projectDir, "src/middleware.ts"),
    `export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
`,
  );

  // src/app/api/auth/[...nextauth]/route.ts
  await writeFile(
    path.join(projectDir, "src/app/api/auth/[...nextauth]/route.ts"),
    `import { handlers } from "@/auth";

export const { GET, POST } = handlers;
`,
  );
}

// ─── Better Auth ──────────────────────────────────────────────────────────────

async function generateBetterAuth(ctx: TemplateContext): Promise<void> {
  const { projectDir } = ctx.config;

  await mergeJson(path.join(projectDir, "package.json"), {
    dependencies: {
      "better-auth": "^1.0.0",
    },
  });

  // src/lib/auth.ts
  await writeFile(
    path.join(projectDir, "src/lib/auth.ts"),
    buildBetterAuthServer(ctx),
  );

  // src/lib/auth-client.ts
  await writeFile(
    path.join(projectDir, "src/lib/auth-client.ts"),
    `import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env["NEXT_PUBLIC_APP_URL"],
});

export const { signIn, signOut, signUp, useSession } = authClient;
`,
  );

  // Route handler
  await writeFile(
    path.join(projectDir, "src/app/api/auth/[...all]/route.ts"),
    `import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
`,
  );
}

function buildBetterAuthServer(ctx: TemplateContext): string {
  const { has } = ctx;

  if (has.drizzle) {
    return `import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "${has.postgres ? "pg" : has.mysql ? "mysql" : "sqlite"}",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Add social providers here: https://www.better-auth.com/docs/authentication
});

export type Session = typeof auth.$Infer.Session;
`;
  }

  return `import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/db";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "${has.postgres ? "postgresql" : has.mysql ? "mysql" : "sqlite"}",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Add social providers here: https://www.better-auth.com/docs/authentication
});

export type Session = typeof auth.$Infer.Session;
`;
}
