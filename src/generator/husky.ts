import type { Generator, TemplateContext } from "../types.js";
import { writeFile, mergeJson } from "../utils/helpers.js";
import path from "path";

export const huskyGenerator: Generator = {
  name: "husky",

  async run(ctx: TemplateContext): Promise<void> {
    if (!ctx.has.husky) return;

    const { projectDir } = ctx.config;

    const prettierPlugins = ctx.has.tailwind
      ? ["prettier-plugin-tailwindcss"]
      : [];

    // Add devDependencies
    await mergeJson(path.join(projectDir, "package.json"), {
      devDependencies: {
        husky: "^9.0.0",
        "lint-staged": "^15.0.0",
        "@commitlint/cli": "^19.0.0",
        "@commitlint/config-conventional": "^19.0.0",
        prettier: "^3.3.0",
        ...(ctx.has.tailwind
          ? { "prettier-plugin-tailwindcss": "^0.6.0" }
          : {}),
      },
      "lint-staged": {
        "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
        "*.{json,md,css}": ["prettier --write"],
      },
    });

    // commitlint.config.ts
    await writeFile(
      path.join(projectDir, "commitlint.config.ts"),
      `import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
};

export default config;
`,
    );

    // .husky/commit-msg
    await writeFile(
      path.join(projectDir, ".husky/commit-msg"),
      `npx --no -- commitlint --edit "$1"\n`,
    );

    // .husky/pre-commit
    await writeFile(
      path.join(projectDir, ".husky/pre-commit"),
      `npx lint-staged\n`,
    );

    // prettier.config.ts
    await writeFile(
      path.join(projectDir, "prettier.config.ts"),
      `import type { Config } from "prettier";

const config: Config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
  tabWidth: 2,
  ${prettierPlugins.length > 0 ? `plugins: ${JSON.stringify(prettierPlugins)},` : ""}
};

export default config;
`,
    );

    // .prettierignore
    await writeFile(
      path.join(projectDir, ".prettierignore"),
      `.next/
node_modules/
dist/
public/
*.min.js
`,
    );
  },
};
