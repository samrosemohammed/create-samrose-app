import { execa } from "execa";
import ora from "ora";
import type { UserChoices } from "./types.js";

const NEXTJS_FLAGS = [
  "--ts", // TypeScript → Yes
  "--eslint", // Linter → ESLint
  "--no-react-compiler", // React Compiler → No (experimental, skip)
  "--tailwind", // Tailwind CSS → Yes
  "--no-src-dir", // src/ directory → NO
  "--app", // App Router → Yes (recommended)
  "--no-import-alias", // import alias → use default @/* without prompting
  "--agents", // Include AGENTS.md → Yes
] as const;

/**
 * Returns the base command + args to bootstrap a Next.js project
 * using the package manager the user selected.
 *
 * Package manager behaviour:
 *   npm   →  npx create-next-app@latest <name> [flags]
 *   yarn  →  yarn create next-app        <name> [flags]
 *   pnpm  →  pnpm create next-app        <name> [flags]   (alias: pnpm dlx create-next-app)
 *   bun   →  bun create next-app         <name> [flags]
 */
function buildCreateNextAppCommand(
  projectName: string,
  packageManager: UserChoices["packageManager"],
): { bin: string; args: string[] } {
  const flags = [...NEXTJS_FLAGS, "--use-" + packageManager];

  switch (packageManager) {
    case "npm":
      return {
        bin: "npx",
        args: ["create-next-app@latest", projectName, ...flags],
      };

    case "yarn":
      return {
        bin: "yarn",
        args: ["create", "next-app", projectName, ...flags],
      };

    case "pnpm":
      return {
        bin: "pnpm",
        args: ["create", "next-app", projectName, ...flags],
      };

    case "bun":
      return {
        bin: "bun",
        args: ["create", "next-app", projectName, ...flags],
      };
  }
}

/**
 * Scaffolds a Next.js project inside the current working directory.
 *
 * On success, the new project lives at `./<projectName>/`.
 * On failure, the error is re-thrown so the caller can handle it.
 */
export async function setupNextjsProject(choices: UserChoices): Promise<void> {
  const { projectName, packageManager } = choices;
  const { bin, args } = buildCreateNextAppCommand(projectName, packageManager);

  console.log(
    `\n🚀 Creating Next.js project "${projectName}" with ${packageManager}…\n`,
  );

  try {
    await execa(bin, args, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    console.log(
      `\n✅ Next.js project "${projectName}" created successfully!\n`,
    );
  } catch (error) {
    console.error(`\n❌ Failed to create Next.js project "${projectName}".\n`);
    throw error;
  }
}
