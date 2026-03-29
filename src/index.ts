#!/usr/bin/env node
import * as p from "@clack/prompts";
import path from "path";
import pc from "picocolors";

import { detectPackageManager } from "./utils/helpers.js";
import {
  Database,
  Extra,
  ORM,
  PackageManager,
  ProjectConfig,
} from "./types.js";

// ─── Banner ──────────────────────────────────────────────────────────────────

export function printBanner(): void {
  console.log("");
  console.log(pc.bold(pc.cyan("  ╔═══════════════════════════════════╗")));
  console.log(
    pc.bold(pc.cyan("  ║  create-samrose-app  ")) +
      pc.dim("v0.1.0") +
      pc.bold(pc.cyan("        ║")),
  );
  console.log(
    pc.bold(pc.cyan("  ║  ")) +
      pc.white("Next.js · TypeScript · Your Stack") +
      pc.bold(pc.cyan("  ║")),
  );
  console.log(pc.bold(pc.cyan("  ╚═══════════════════════════════════╝")));
  console.log("");
}

// ─── Prompt runner ───────────────────────────────────────────────────────────

export async function gatherProjectConfig(
  cliProjectName?: string,
): Promise<ProjectConfig> {
  p.intro(pc.bgCyan(pc.black(" create-samrose-app ")));

  // ── Project name ──────────────────────────────────────────────────────────
  let projectName: string;

  if (cliProjectName) {
    projectName = cliProjectName;
  } else {
    const result = await p.text({
      message: "What is your project name?",
      placeholder: "my-app",
      validate(value) {
        if (!value.trim()) return "Project name cannot be empty.";
        if (!/^[a-z0-9-_]+$/.test(value))
          return "Use only lowercase letters, numbers, hyphens, and underscores.";
      },
    });
    if (p.isCancel(result)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    projectName = result;
  }

  // ── ORM ───────────────────────────────────────────────────────────────────
  const ormResult = await p.select<ORM>({
    message: "Which ORM do you prefer?",
    options: [
      { value: "drizzle" as ORM, label: "Drizzle ORM" },
      { value: "prisma" as ORM, label: "Prisma" },
    ],
  });
  if (p.isCancel(ormResult)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  const orm = ormResult as ORM;

  // ── Database ──────────────────────────────────────────────────────────────
  const dbResult = await p.select<Database>({
    message: "Which database will you use?",
    options: [
      { value: "postgresql" as Database, label: "PostgreSQL" },
      { value: "mysql" as Database, label: "MySQL" },
      { value: "sqlite" as Database, label: "SQLite" },
    ],
  });
  if (p.isCancel(dbResult)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  const database = dbResult as Database;

  // ── Extras ────────────────────────────────────────────────────────────────
  const extrasResult = await p.multiselect<Extra>({
    message: "Select optional features (space to toggle):",
    options: [
      { value: "tailwind" as Extra, label: "Tailwind CSS" },
      {
        value: "shadcn" as Extra,
        label: "shadcn/ui",
        hint: "requires Tailwind",
      },
      { value: "auth-nextauth" as Extra, label: "Auth.js (NextAuth v5)" },
      { value: "auth-better-auth" as Extra, label: "Better Auth" },
      {
        value: "husky" as Extra,
        label: "Husky + lint-staged + Commitlint + Prettier",
      },
    ],
    required: false,
  });
  if (p.isCancel(extrasResult)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  const extras = extrasResult as Extra[];

  // ── Package manager ───────────────────────────────────────────────────────
  const detectedPm = await detectPackageManager();
  const pmResult = await p.select<PackageManager>({
    message: "Which package manager?",
    initialValue: detectedPm,
    options: [
      { value: "pnpm" as PackageManager, label: "pnpm" },
      { value: "bun" as PackageManager, label: "bun" },
      { value: "npm" as PackageManager, label: "npm" },
      { value: "yarn" as PackageManager, label: "yarn" },
    ],
  });
  if (p.isCancel(pmResult)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  const packageManager = pmResult as PackageManager;

  // ── Git init ──────────────────────────────────────────────────────────────
  const gitResult = await p.confirm({
    message: "Initialize a Git repository?",
    initialValue: true,
  });
  if (p.isCancel(gitResult)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  const initGit = gitResult as boolean;

  // ── Install deps ──────────────────────────────────────────────────────────
  const installResult = await p.confirm({
    message: "Install dependencies now?",
    initialValue: true,
  });
  if (p.isCancel(installResult)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  const installDeps = installResult as boolean;

  const projectDir = path.resolve(process.cwd(), projectName);

  return {
    projectName,
    projectDir,
    orm,
    database,
    extras,
    packageManager,
    initGit,
    installDeps,
  };
}
