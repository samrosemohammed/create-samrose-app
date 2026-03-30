import { execa } from "execa";
import path from "path";
import type { UserChoices } from "./types.js";

/**
 * shadcn/ui setup.
 *
 * Uses `npx shadcn@latest init` with non-interactive flags so the CLI
 * never pauses for prompts. The flags used:
 *
 *   --defaults   Accept all defaults (style: new-york, base color: neutral,
 *                CSS variables: yes) — no interactive prompts shown.
 *   --force      Overwrite any conflicting files without asking.
 *
 * The CLI auto-detects the Next.js project, Tailwind v4 config, and the
 * @/* import alias, then:
 *   - writes components.json
 *   - updates app/globals.css with CSS variables
 *   - creates lib/utils.ts (cn() helper)
 *   - installs clsx + tailwind-merge as dependencies
 */
export async function setupShadcn(choices: UserChoices): Promise<void> {
  if (!choices.useShadcn) {
    console.log("\n⏭️  Skipping shadcn/ui.\n");
    return;
  }

  const projectDir = path.join(process.cwd(), choices.projectName);

  console.log("\n🎨  Setting up shadcn/ui…\n");

  try {
    await execa(
      "npx",
      [
        "shadcn@latest",
        "init",
        "--defaults", // use defaults: new-york style, neutral base, CSS vars on
        "--force", // overwrite without prompting
      ],
      {
        cwd: projectDir,
        stdio: "inherit", // show CLI output in terminal
      },
    );

    console.log("\n  ✅ shadcn/ui ready.");
    console.log("  📌 Add components with:");
    console.log(`     npx shadcn@latest add <component>`);
    console.log("     e.g. npx shadcn@latest add button card input\n");
  } catch (error) {
    console.error("\n❌ shadcn/ui setup failed.");
    throw error;
  }
}
