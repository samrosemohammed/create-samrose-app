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

async function install(
  packageManager: UserChoices["packageManager"],
  projectDir: string,
  devDeps: string[],
) {
  const cmd = packageManager === "npm" ? "install" : "add";
  const devFlag = packageManager === "npm" ? "--save-dev" : "-D";
  await execa(packageManager, [cmd, devFlag, ...devDeps], {
    cwd: projectDir,
    stdio: "inherit",
  });
}

async function addScripts(projectDir: string, scripts: Record<string, string>) {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  pkg.scripts = { ...pkg.scripts, ...scripts };
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
}

// ─────────────────────────────────────────────
// Lockfile name per package manager
// ─────────────────────────────────────────────

function lockfileName(pm: UserChoices["packageManager"]): string {
  switch (pm) {
    case "npm":
      return "package-lock.json";
    case "yarn":
      return "yarn.lock";
    case "pnpm":
      return "pnpm-lock.yaml";
    case "bun":
      return "bun.lock";
  }
}

// ─────────────────────────────────────────────
// DOCKER
// ─────────────────────────────────────────────

async function setupDocker(choices: UserChoices, projectDir: string) {
  const { packageManager, projectName } = choices;
  const lockfile = lockfileName(packageManager);

  // Resolve the correct install command for each stage
  const installCmd: Record<UserChoices["packageManager"], string> = {
    npm: "npm ci",
    yarn: "yarn --frozen-lockfile",
    pnpm: "corepack enable pnpm && pnpm i --frozen-lockfile",
    bun: "bun install --frozen-lockfile",
  };

  const buildCmd: Record<UserChoices["packageManager"], string> = {
    npm: "npm run build",
    yarn: "yarn build",
    pnpm: "pnpm run build",
    bun: "bun run build",
  };

  // Multi-stage Dockerfile — deps / builder / runner
  // Node 24 Alpine, non-root user, standalone output
  await write(
    path.join(projectDir, "Dockerfile"),
    `# syntax=docker/dockerfile:1
# ────────────────────────────────────────────
# Stage 1 — Install dependencies
# ────────────────────────────────────────────
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json ${lockfile}* ./
RUN ${installCmd[packageManager]}

# ────────────────────────────────────────────
# Stage 2 — Build
# ────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN ${buildCmd[packageManager]}

# ────────────────────────────────────────────
# Stage 3 — Production runner (minimal image)
# ────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Leverage Next.js standalone output for minimal image size
# Requires: output: "standalone" in next.config.ts
RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
`,
  );

  // .dockerignore — keep image lean
  await write(
    path.join(projectDir, ".dockerignore"),
    `# Dependencies
node_modules
.pnpm-store

# Next.js build output
.next
out

# Environment files — never bake secrets into the image
.env
.env.*
!.env.example

# Dev tooling
.git
.husky
.vscode
*.test.*
*.spec.*
__tests__
coverage
*.md

# Misc
.DS_Store
Thumbs.db
`,
  );

  // Patch next.config.ts to add output: "standalone"
  const nextConfigPath = path.join(projectDir, "next.config.ts");
  let nextConfig = await fs
    .readFile(nextConfigPath, "utf8")
    .catch(
      () =>
        `import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;\n`,
    );

  if (!nextConfig.includes("standalone")) {
    nextConfig = nextConfig.replace(
      /const nextConfig: NextConfig = \{/,
      `const nextConfig: NextConfig = {\n  // Required for the Docker multi-stage build\n  output: "standalone",`,
    );
    await fs.writeFile(nextConfigPath, nextConfig, "utf8");
  }

  // docker-compose.dev.yml — local dev compose (separate from db compose)
  await write(
    path.join(projectDir, "docker-compose.dev.yml"),
    `# Local development — run the Next.js app in a container
# Usage: docker compose -f docker-compose.dev.yml up
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder   # use the build stage for hot-reload
    container_name: ${projectName}-app
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
    env_file:
      - .env.local
    command: ${packageManager === "npm" ? "npm run dev" : packageManager === "yarn" ? "yarn dev" : packageManager === "pnpm" ? "pnpm dev" : "bun dev"}
`,
  );

  console.log("\n  ✅ Docker ready.");
  console.log("  📌 Build and run production image:");
  console.log("     docker build -t " + projectName + " .");
  console.log("     docker run -p 3000:3000 " + projectName);
  console.log("  📌 Local dev with Docker:");
  console.log("     docker compose -f docker-compose.dev.yml up\n");
}

// ─────────────────────────────────────────────
// GITHUB ACTIONS
// ─────────────────────────────────────────────

async function setupGithubActions(choices: UserChoices, projectDir: string) {
  const { packageManager, testing } = choices;
  const lockfile = lockfileName(packageManager);

  // Install command for CI (frozen lockfile, no interactive)
  const installCmd: Record<UserChoices["packageManager"], string> = {
    npm: "npm ci",
    yarn: "yarn --frozen-lockfile",
    pnpm: "pnpm install --frozen-lockfile",
    bun: "bun install --frozen-lockfile",
  };

  // Cache path per package manager
  const cachePath: Record<UserChoices["packageManager"], string> = {
    npm: "~/.npm",
    yarn: "$(yarn cache dir)",
    pnpm: "$(pnpm store path)",
    bun: "~/.bun/install/cache",
  };

  // pnpm needs the action-setup step
  const pnpmSetup =
    packageManager === "pnpm"
      ? `
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10
`
      : "";

  // Test command per framework
  const testCmd: Record<UserChoices["testing"], string> = {
    jest: `${packageManager === "npm" ? "npx" : packageManager} jest --ci --coverage`,
    vitest: `${packageManager === "npm" ? "npx" : packageManager} vitest run --coverage`,
  };

  // CI workflow — lint + type-check + test + build on every push/PR
  await write(
    path.join(projectDir, ".github", "workflows", "ci.yml"),
    `name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  ci:
    name: Lint, Type-check, Test & Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
${pnpmSetup}
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: "${packageManager === "bun" ? "npm" : packageManager}"

      - name: Cache .next/cache
        uses: actions/cache@v4
        with:
          path: |
            ${cachePath[packageManager]}
            \${{ github.workspace }}/.next/cache
          key: \${{ runner.os }}-nextjs-\${{ hashFiles('**/${lockfile}') }}-\${{ hashFiles('**/*.ts', '**/*.tsx') }}
          restore-keys: |
            \${{ runner.os }}-nextjs-\${{ hashFiles('**/${lockfile}') }}-

      - name: Install dependencies
        run: ${installCmd[packageManager]}

      - name: Type-check
        run: ${packageManager === "npm" ? "npx" : packageManager} tsc --noEmit

      - name: Lint
        run: ${packageManager === "npm" ? "npx" : packageManager} next lint

      - name: Test
        run: ${testCmd[testing]}

      - name: Build
        run: ${packageManager === "npm" ? "npm run" : packageManager} build
        env:
          # Silence Next.js telemetry in CI
          NEXT_TELEMETRY_DISABLED: 1
`,
  );

  // Release / deploy workflow stub (push to main → deploy)
  await write(
    path.join(projectDir, ".github", "workflows", "deploy.yml"),
    `name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:   # allow manual trigger from GitHub UI

jobs:
  deploy:
    name: Deploy to production
    runs-on: ubuntu-latest
    needs: []  # Add 'ci' here once CI workflow is confirmed stable

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # ─────────────────────────────────────────────
      # Choose ONE of the deployment targets below
      # and delete the others.
      # ─────────────────────────────────────────────

      # Option A: Vercel
      # - name: Deploy to Vercel
      #   uses: amondnet/vercel-action@v25
      #   with:
      #     vercel-token: \${{ secrets.VERCEL_TOKEN }}
      #     vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
      #     vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
      #     vercel-args: "--prod"

      # Option B: Docker → push to GHCR then deploy via SSH
      # - name: Build and push Docker image
      #   uses: docker/build-push-action@v6
      #   with:
      #     push: true
      #     tags: ghcr.io/\${{ github.repository }}:latest

      - name: Placeholder — add your deployment step above
        run: echo "Configure a deployment target in .github/workflows/deploy.yml"
`,
  );

  console.log("\n  ✅ GitHub Actions ready.");
  console.log("  📌 Workflows created:");
  console.log(
    "     .github/workflows/ci.yml     — lint + type-check + test + build",
  );
  console.log(
    "     .github/workflows/deploy.yml  — deployment stub (configure target)",
  );
  console.log("  📌 Add repository secrets at:");
  console.log("     GitHub → Settings → Secrets and variables → Actions\n");
}

// ─────────────────────────────────────────────
// HUSKY + lint-staged + Prettier
// ─────────────────────────────────────────────

async function setupHusky(choices: UserChoices, projectDir: string) {
  const { packageManager } = choices;

  console.log("  📦 Installing Husky + lint-staged + Prettier…");
  await install(choices.packageManager, projectDir, [
    "husky",
    "lint-staged",
    "prettier",
    "prettier-plugin-tailwindcss", // sorts Tailwind classes automatically
  ]);

  // Initialise husky — creates .husky/ directory
  await execa("npx", ["husky", "init"], {
    cwd: projectDir,
    stdio: "inherit",
  });

  // pre-commit hook — run lint-staged on staged files only
  await write(
    path.join(projectDir, ".husky", "pre-commit"),
    `npx lint-staged\n`,
  );

  // commit-msg hook — enforce conventional commits format
  // e.g. feat(scope): message  |  fix: message  |  chore: message
  await write(
    path.join(projectDir, ".husky", "commit-msg"),
    `npx --no -- commitlint --edit \${1}\n`,
  );

  // .lintstagedrc.mjs — uses next lint for TS/TSX (passes filenames correctly)
  // This is the recommended pattern from the Next.js docs + lint-staged README
  await write(
    path.join(projectDir, ".lintstagedrc.mjs"),
    `import path from "path";

const buildNextLintCommand = (filenames) =>
  \`next lint --fix --file \${filenames
    .map((f) => path.relative(process.cwd(), f))
    .join(" --file ")}\`;

const config = {
  // TypeScript/TSX: prettier format + next lint (runs ESLint with Next.js rules) + tsc
  "**/*.{ts,tsx}": [
    "prettier --write",
    buildNextLintCommand,
    () => "tsc -p tsconfig.json --noEmit",
  ],

  // JS/JSX: prettier + next lint
  "**/*.{js,jsx}": ["prettier --write", buildNextLintCommand],

  // JSON, YAML, Markdown, CSS: prettier only
  "**/*.{json,md,yml,yaml,css}": ["prettier --write"],
};

export default config;
`,
  );

  // .prettierrc — consistent formatting config
  await write(
    path.join(projectDir, ".prettierrc"),
    `{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
`,
  );

  // .prettierignore
  await write(
    path.join(projectDir, ".prettierignore"),
    `node_modules
.next
out
dist
build
coverage
*.lock
pnpm-lock.yaml
`,
  );

  // Add prepare + format scripts to package.json
  // prepare runs husky on npm install so every new contributor gets hooks automatically
  const runCmd =
    packageManager === "npm"
      ? "npx"
      : packageManager === "bun"
        ? "bunx"
        : packageManager;

  await addScripts(projectDir, {
    prepare: "husky",
    format: "prettier --write .",
    "format:check": "prettier --check .",
  });

  console.log("\n  ✅ Husky + lint-staged + Prettier ready.");
  console.log("  📌 What runs on git commit:");
  console.log("     • prettier --write    — auto-format staged files");
  console.log("     • next lint --fix     — auto-fix ESLint issues");
  console.log("     • tsc --noEmit        — catch TypeScript errors");
  console.log("  📌 Manual format:");
  console.log(
    `     ${packageManager === "npm" ? "npm run" : packageManager} format\n`,
  );
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export async function setupExtras(choices: UserChoices): Promise<void> {
  const { extra, projectName } = choices;
  const projectDir = path.join(process.cwd(), projectName);

  if (extra.length === 0) {
    console.log("\n⏭️  No extras selected, skipping.\n");
    return;
  }

  console.log(`\n🔧  Setting up extras: ${extra.join(", ")}…\n`);

  try {
    for (const item of extra) {
      switch (item) {
        case "docker":
          console.log("  🐳 Setting up Docker…");
          await setupDocker(choices, projectDir);
          break;

        case "github-actions":
          console.log("  ⚙️  Setting up GitHub Actions…");
          await setupGithubActions(choices, projectDir);
          break;

        case "husky":
          console.log("  🐶 Setting up Husky + lint-staged + Prettier…");
          await setupHusky(choices, projectDir);
          break;
      }
    }
  } catch (error) {
    console.error(`\n❌ Extras setup failed: ${error}`);
    throw error;
  }
}
