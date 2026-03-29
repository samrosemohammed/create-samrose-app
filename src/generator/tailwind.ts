import type { Generator, TemplateContext } from "../types.js";
import { writeFile, mergeJson } from "../utils/helpers.js";
import path from "path";

export const tailwindGenerator: Generator = {
  name: "tailwind",

  async run(ctx: TemplateContext): Promise<void> {
    if (!ctx.has.tailwind) return;

    const { projectDir } = ctx.config;

    // postcss.config.mjs
    await writeFile(
      path.join(projectDir, "postcss.config.mjs"),
      `const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
`,
    );

    // Add tailwind deps to package.json
    await mergeJson(path.join(projectDir, "package.json"), {
      devDependencies: {
        tailwindcss: "^4.0.0",
        "@tailwindcss/postcss": "^4.0.0",
        ...(ctx.has.shadcn
          ? {
              clsx: "^2.1.0",
              "tailwind-merge": "^2.3.0",
            }
          : {}),
      },
    });
  },
};
