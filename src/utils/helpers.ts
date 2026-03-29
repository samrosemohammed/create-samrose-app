import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import pc from "picocolors";
import type { PackageManager } from "../types.js";

// ─── Filesystem helpers ─────────────────────────────────────────────────────

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf-8");
}

export async function copyFile(src: string, dest: string): Promise<void> {
  await fs.ensureDir(path.dirname(dest));
  await fs.copy(src, dest);
}

export function joinPath(...segments: string[]): string {
  return path.join(...segments);
}

// ─── Package manager helpers ────────────────────────────────────────────────

export function getInstallCommand(pm: PackageManager): string {
  const commands: Record<PackageManager, string> = {
    npm: "install",
    pnpm: "install",
    yarn: "install",
    bun: "install",
  };
  return commands[pm];
}

export function getAddCommand(
  pm: PackageManager,
  dev: boolean = false,
): string[] {
  const base: Record<PackageManager, string[]> = {
    npm: ["install", dev ? "--save-dev" : "--save"],
    pnpm: ["add", ...(dev ? ["-D"] : [])],
    yarn: ["add", ...(dev ? ["-D"] : [])],
    bun: ["add", ...(dev ? ["-d"] : [])],
  };
  return base[pm];
}

export async function detectPackageManager(): Promise<PackageManager> {
  // Detect from user-agent env var set by npm/pnpm/yarn/bun
  const ua = process.env["npm_config_user_agent"] ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";
  return "npm";
}

// ─── Git helpers ────────────────────────────────────────────────────────────

export async function initGit(cwd: string): Promise<void> {
  await execa("git", ["init"], { cwd });
  await execa("git", ["add", "-A"], { cwd });
  await execa(
    "git",
    ["commit", "-m", "chore: initial commit from create-samrose-app"],
    {
      cwd,
    },
  );
}

// ─── Pretty logging ─────────────────────────────────────────────────────────

export const logger = {
  info: (msg: string) => console.log(`  ${pc.cyan("ℹ")} ${msg}`),
  success: (msg: string) => console.log(`  ${pc.green("✔")} ${msg}`),
  warn: (msg: string) => console.log(`  ${pc.yellow("⚠")} ${msg}`),
  error: (msg: string) => console.error(`  ${pc.red("✖")} ${msg}`),
  step: (msg: string) => console.log(`  ${pc.magenta("›")} ${msg}`),
};

// ─── JSON helpers ───────────────────────────────────────────────────────────

export async function readJson<T = unknown>(filePath: string): Promise<T> {
  return fs.readJson(filePath) as Promise<T>;
}

export async function writeJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, data, { spaces: 2 });
}

export async function mergeJson(
  filePath: string,
  data: Record<string, unknown>,
): Promise<void> {
  let existing: Record<string, unknown> = {};
  if (await fs.pathExists(filePath)) {
    existing = await readJson<Record<string, unknown>>(filePath);
  }
  await writeJson(filePath, deepMerge(existing, data));
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}
