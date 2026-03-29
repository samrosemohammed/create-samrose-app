import type { Generator, TemplateContext } from "../types.js";
import { writeFile, writeJson } from "../utils/helpers.js";
import path from "path";

export const baseGenerator: Generator = {
  name: "base",

  async run(ctx: TemplateContext): Promise<void> {
    const { projectDir, projectName, packageManager } = ctx.config;
    const { has } = ctx;

    // ── package.json ────────────────────────────────────────────────────────
    const pkg = {
      name: projectName,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev --turbopack",
        build: "next build",
        start: "next start",
        lint: "next lint",
        typecheck: "tsc --noEmit",
        ...(has.drizzle
          ? {
              "db:generate": "drizzle-kit generate",
              "db:migrate": "drizzle-kit migrate",
              "db:studio": "drizzle-kit studio",
              "db:push": "drizzle-kit push",
            }
          : {
              "db:generate": "prisma generate",
              "db:migrate": "prisma migrate dev",
              "db:studio": "prisma studio",
              "db:push": "prisma db push",
            }),
        ...(has.husky
          ? {
              prepare: "husky",
            }
          : {}),
      },
      dependencies: {
        next: "^15.0.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
      devDependencies: {
        typescript: "^5.4.0",
        "@types/node": "^20.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        eslint: "^9.0.0",
        "eslint-config-next": "^15.0.0",
      },
    };

    await writeJson(path.join(projectDir, "package.json"), pkg);

    // ── tsconfig.json ───────────────────────────────────────────────────────
    const tsconfig = {
      compilerOptions: {
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    };

    await writeJson(path.join(projectDir, "tsconfig.json"), tsconfig);

    // ── next.config.ts ──────────────────────────────────────────────────────
    await writeFile(
      path.join(projectDir, "next.config.ts"),
      `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Add your config overrides here */
};

export default nextConfig;
`,
    );

    // ── .env files ──────────────────────────────────────────────────────────
    const envLines = buildEnvTemplate(ctx);
    await writeFile(path.join(projectDir, ".env"), envLines);
    await writeFile(path.join(projectDir, ".env.example"), envLines);

    // ── .gitignore ───────────────────────────────────────────────────────────
    await writeFile(
      path.join(projectDir, ".gitignore"),
      gitignoreContent(packageManager),
    );

    // ── README.md ────────────────────────────────────────────────────────────
    await writeFile(path.join(projectDir, "README.md"), buildReadme(ctx));

    // ── src/app directory ────────────────────────────────────────────────────
    await writeFile(
      path.join(projectDir, "src/app/layout.tsx"),
      buildRootLayout(ctx),
    );

    await writeFile(
      path.join(projectDir, "src/app/page.tsx"),
      buildHomePage(ctx),
    );

    await writeFile(
      path.join(projectDir, "src/app/globals.css"),
      buildGlobalCss(ctx),
    );

    // ── src/lib ──────────────────────────────────────────────────────────────
    await writeFile(
      path.join(projectDir, "src/lib/utils.ts"),
      buildLibUtils(ctx),
    );

    // ── src/types ────────────────────────────────────────────────────────────
    await writeFile(
      path.join(projectDir, "src/types/index.ts"),
      `// ─── Shared application types ────────────────────────────────────────────────
// Add your shared TypeScript types here.

export {};
`,
    );

    // ── src/config ───────────────────────────────────────────────────────────
    await writeFile(
      path.join(projectDir, "src/config/app.ts"),
      `// ─── Application-level configuration ─────────────────────────────────────────

export const appConfig = {
  name: "${projectName}",
  description: "Built with create-samrose-app",
  url: process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000",
} as const;
`,
    );

    // ── eslint.config.mjs ────────────────────────────────────────────────────
    await writeFile(
      path.join(projectDir, "eslint.config.mjs"),
      `import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
`,
    );
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildEnvTemplate(ctx: TemplateContext): string {
  const { has } = ctx;
  const lines: string[] = [
    "# Application",
    'NEXT_PUBLIC_APP_URL="http://localhost:3000"',
    "",
  ];

  if (has.postgres) {
    lines.push(
      "# Database (PostgreSQL)",
      'DATABASE_URL="postgresql://user:password@localhost:5432/dbname"',
      "",
    );
  } else if (has.mysql) {
    lines.push(
      "# Database (MySQL)",
      'DATABASE_URL="mysql://user:password@localhost:3306/dbname"',
      "",
    );
  } else {
    lines.push("# Database (SQLite)", 'DATABASE_URL="file:./dev.db"', "");
  }

  if (has.authNextAuth) {
    lines.push(
      "# Auth.js",
      'AUTH_SECRET="your-secret-here"',
      'AUTH_URL="http://localhost:3000"',
      "",
    );
  }

  if (has.authBetterAuth) {
    lines.push(
      "# Better Auth",
      'BETTER_AUTH_SECRET="your-secret-here"',
      'BETTER_AUTH_URL="http://localhost:3000"',
      "",
    );
  }

  return lines.join("\n");
}

function gitignoreContent(pm: string): string {
  return `# Dependencies
node_modules/
.pnp
.pnp.js
${pm === "yarn" ? ".yarn/cache\n.yarn/unplugged\n.yarn/build-state.yml\n.yarn/install-state.gz" : ""}

# Build outputs
.next/
out/
dist/

# Env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Database
*.db
*.db-journal
*.sqlite

# Misc
.DS_Store
*.pem
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# TypeScript
*.tsbuildinfo
next-env.d.ts
`;
}

function buildRootLayout(ctx: TemplateContext): string {
  const { has, config } = ctx;
  const imports: string[] = [];
  const classNames: string[] = [];

  if (has.tailwind) {
    imports.push(`import "./globals.css";`);
  }

  return `import type { Metadata } from "next";
${imports.join("\n")}

export const metadata: Metadata = {
  title: "${config.projectName}",
  description: "Built with create-samrose-app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body${has.tailwind ? ` className="antialiased"` : ""}>{children}</body>
    </html>
  );
}
`;
}

function buildHomePage(ctx: TemplateContext): string {
  const { has, config } = ctx;

  if (has.tailwind) {
    return `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">${config.projectName}</h1>
      <p className="mt-4 text-muted-foreground">
        Built with create-samrose-app
      </p>
    </main>
  );
}
`;
  }

  return `export default function Home() {
  return (
    <main>
      <h1>${config.projectName}</h1>
      <p>Built with create-samrose-app</p>
    </main>
  );
}
`;
}

function buildGlobalCss(ctx: TemplateContext): string {
  if (ctx.has.tailwind) {
    return `@import "tailwindcss";
`;
  }
  return `* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}
`;
}

function buildLibUtils(ctx: TemplateContext): string {
  if (ctx.has.shadcn) {
    return `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
  }
  return `// ─── Shared utilities ─────────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
`;
}

function buildReadme(ctx: TemplateContext): string {
  const { config, has } = ctx;
  const pm = config.packageManager;

  return `# ${config.projectName}

Scaffolded with [create-samrose-app](https://github.com/samrose3/create-samrose-app).

## Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **ORM**: ${has.drizzle ? "Drizzle ORM" : "Prisma"}
- **Database**: ${config.database}
${has.tailwind ? "- **Styling**: Tailwind CSS\n" : ""}${has.shadcn ? "- **UI**: shadcn/ui\n" : ""}${has.authNextAuth ? "- **Auth**: Auth.js (NextAuth v5)\n" : ""}${has.authBetterAuth ? "- **Auth**: Better Auth\n" : ""}

## Getting Started

\`\`\`bash
# Install dependencies
${pm} install

# Copy env file and fill in values
cp .env.example .env

# Push database schema
${pm} run db:push

# Start dev server
${pm} run dev
\`\`\`

## Scripts

| Command | Description |
|---------|-------------|
| \`${pm} run dev\` | Start dev server |
| \`${pm} run build\` | Build for production |
| \`${pm} run typecheck\` | Run TypeScript type-check |
| \`${pm} run db:push\` | Push schema to DB |
| \`${pm} run db:studio\` | Open DB studio |
`;
}
