import { execa } from "execa";
import fs from "fs/promises";
import path from "path";
import type { Extra, UserChoices } from "./types.js";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function write(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function ensureFileContains(filePath: string, lines: string[]) {
  const existing = await fs.readFile(filePath, "utf8").catch(() => "");
  const toAdd = lines.filter((line) => !existing.includes(line));
  if (!toAdd.length) return;
  await fs.appendFile(filePath, `\n${toAdd.join("\n")}\n`, "utf8");
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

async function updatePackageScripts(
  projectDir: string,
  updater: (scripts: Record<string, string>) => Record<string, string>,
) {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  pkg.scripts = updater(pkg.scripts ?? {});
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

// ─────────────────────────────────────────────
// Docker
// ─────────────────────────────────────────────

async function setupDocker(projectDir: string) {
  await write(
    path.join(projectDir, "Dockerfile"),
    `FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* bun.lockb* ./
RUN \
	if [ -f package-lock.json ]; then npm ci; \
	elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
	elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
	elif [ -f bun.lockb ]; then bun install --frozen-lockfile; \
	else npm install; fi

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
`,
  );

  await write(
    path.join(projectDir, ".dockerignore"),
    `node_modules
.next
coverage
.git
.gitignore
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
*.local
.env*
`,
  );

  await updatePackageScripts(projectDir, (scripts) => ({
    ...scripts,
    "docker:build": scripts["docker:build"] ?? "docker build -t app .",
    "docker:run": scripts["docker:run"] ?? "docker run -p 3000:3000 app",
  }));

  console.log("  ✅ Docker files added (Dockerfile + .dockerignore).");
}

// ─────────────────────────────────────────────
// GitHub Actions
// ─────────────────────────────────────────────

async function setupGithubActions(projectDir: string) {
  await write(
    path.join(projectDir, ".github", "workflows", "ci.yml"),
    `name: CI

on:
	push:
		branches: [main, develop]
	pull_request:

jobs:
	test:
		runs-on: ubuntu-latest

		steps:
			- name: Checkout
				uses: actions/checkout@v4

			- name: Setup Node
				uses: actions/setup-node@v4
				with:
					node-version: 20
					cache: npm

			- name: Install dependencies
				run: npm ci

			- name: Lint
				run: npm run lint

			- name: Test
				run: npm run test

			- name: Build
				run: npm run build
`,
  );

  console.log(
    "  ✅ GitHub Actions workflow added at .github/workflows/ci.yml.",
  );
}

// ─────────────────────────────────────────────
// Husky
// ─────────────────────────────────────────────

async function setupHusky(choices: UserChoices, projectDir: string) {
  await install(
    choices.packageManager,
    projectDir,
    [],
    ["husky", "lint-staged"],
  );

  await updatePackageScripts(projectDir, (scripts) => ({
    ...scripts,
    prepare: scripts.prepare ? `${scripts.prepare} && husky` : "husky",
    "lint-staged": scripts["lint-staged"] ?? "lint-staged",
  }));

  const lintStagedPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(await fs.readFile(lintStagedPath, "utf8")) as {
    [key: string]: unknown;
    "lint-staged"?: Record<string, string[]>;
  };

  if (!pkg["lint-staged"]) {
    pkg["lint-staged"] = {
      "*.{js,jsx,ts,tsx}": ["eslint --fix"],
      "*.{json,md,css}": ["prettier --write"],
    };
    await fs.writeFile(
      lintStagedPath,
      JSON.stringify(pkg, null, 2) + "\n",
      "utf8",
    );
  }

  await fs.mkdir(path.join(projectDir, ".husky"), { recursive: true });
  await write(
    path.join(projectDir, ".husky", "pre-commit"),
    `npm run lint-staged
npm run test
`,
  );

  await ensureFileContains(path.join(projectDir, ".gitignore"), [".husky/_"]);

  console.log("  ✅ Husky hooks configured (pre-commit).");
  console.log("  📌 Run once in the generated project: npm run prepare");
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export async function setupExtraTools(choices: UserChoices): Promise<void> {
  const { extra, projectName } = choices;
  const projectDir = path.join(process.cwd(), projectName);

  if (!extra.length) {
    console.log("\n🧰  No extra tools selected. Skipping.\n");
    return;
  }

  console.log(`\n🧰  Setting up extra tools (${extra.join(", ")})…\n`);

  try {
    const selected = new Set<Extra>(extra);

    if (selected.has("docker")) {
      await setupDocker(projectDir);
    }

    if (selected.has("github-actions")) {
      await setupGithubActions(projectDir);
    }

    if (selected.has("husky")) {
      await setupHusky(choices, projectDir);
    }

    console.log("\n  ✅ Extra tools setup complete.\n");
  } catch (error) {
    console.error(`\n❌ Extra tools setup failed: ${error}`);
    throw error;
  }
}
