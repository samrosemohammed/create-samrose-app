import * as p from "@clack/prompts";
import { execa } from "execa";
import fs from "fs-extra";
import ora from "ora";
import pc from "picocolors";

import type { Generator, TemplateContext } from "../types.js";
import { baseGenerator } from "@/generator/base.js";
import { depsGenerator } from "@/generator/deps.js";
import { ormGenerator } from "@/generator/orm.js";
import { tailwindGenerator } from "@/generator/tailwind.js";
import { shadcnGenerator } from "@/generator/shadcn.js";
import { authGenerator } from "@/generator/auth.js";
import { huskyGenerator } from "@/generator/husky.js";
import { gatherProjectConfig, printBanner } from "@/index.js";
import { buildContext } from "@/utils/context.js";
import { initGit, logger } from "@/utils/helpers.js";

// Ordered list of generators — order matters.
const generators: Generator[] = [
  baseGenerator,
  depsGenerator,
  ormGenerator,
  tailwindGenerator,
  shadcnGenerator,
  authGenerator,
  huskyGenerator,
];

export async function runCLI(): Promise<void> {
  printBanner();

  // Parse optional positional arg: create-samrose-app <project-name>
  const cliProjectName = process.argv[2];

  // Gather all config via interactive prompts
  const config = await gatherProjectConfig(cliProjectName);

  console.log("");

  // Guard: don't overwrite an existing non-empty directory
  if (await fs.pathExists(config.projectDir)) {
    const entries = await fs.readdir(config.projectDir);
    if (entries.length > 0) {
      p.cancel(
        `Directory "${config.projectName}" already exists and is not empty.`,
      );
      process.exit(1);
    }
  }

  // Build template context
  const ctx: TemplateContext = buildContext(config);

  // ── Run generators ─────────────────────────────────────────────────────────
  const scaffoldSpinner = ora({
    text: "Scaffolding your project…",
    color: "cyan",
  }).start();

  try {
    for (const generator of generators) {
      await generator.run(ctx);
    }
    scaffoldSpinner.succeed("Project scaffolded successfully.");
  } catch (err) {
    scaffoldSpinner.fail("Scaffolding failed.");
    throw err;
  }

  // ── Install dependencies ───────────────────────────────────────────────────
  if (config.installDeps) {
    const installSpinner = ora({
      text: `Installing dependencies with ${config.packageManager}…`,
      color: "cyan",
    }).start();

    try {
      await execa(config.packageManager, ["install"], {
        cwd: config.projectDir,
        stdio: "pipe",
      });
      installSpinner.succeed("Dependencies installed.");
    } catch (err) {
      installSpinner.fail(
        "Dependency installation failed. Run install manually.",
      );
      logger.warn(
        `cd ${config.projectName} && ${config.packageManager} install`,
      );
    }
  }

  // ── Git init ───────────────────────────────────────────────────────────────
  if (config.initGit) {
    const gitSpinner = ora({
      text: "Initializing git…",
      color: "cyan",
    }).start();
    try {
      await initGit(config.projectDir);
      gitSpinner.succeed("Git repository initialized.");
    } catch {
      gitSpinner.warn("Git init skipped (git may not be installed).");
    }
  }

  // ── Done! ──────────────────────────────────────────────────────────────────
  printSuccess(ctx);
}

function printSuccess(ctx: TemplateContext): void {
  const { config } = ctx;
  const pm = config.packageManager;

  console.log("");
  p.outro(pc.bold(pc.green("✔ Your project is ready!")));
  console.log("");
  console.log("  Next steps:");
  console.log("");
  console.log(`  ${pc.cyan("cd")} ${config.projectName}`);

  if (!config.installDeps) {
    console.log(`  ${pc.cyan(pm)} install`);
  }

  console.log(`  ${pc.cyan("cp")} .env.example .env`);
  console.log(`  ${pc.cyan(pm)} run db:push`);
  console.log(`  ${pc.cyan(pm)} run dev`);
  console.log("");
  console.log(`  ${pc.dim("Happy hacking 🚀")}`);
  console.log("");
}
