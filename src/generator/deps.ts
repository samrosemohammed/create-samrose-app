import type { Generator, TemplateContext } from "../types.js";
import { mergeJson } from "../utils/helpers.js";
import path from "path";

export const depsGenerator: Generator = {
  name: "deps",

  async run(ctx: TemplateContext): Promise<void> {
    const { projectDir } = ctx.config;
    const { has } = ctx;
    const pkgPath = path.join(projectDir, "package.json");

    // ── ORM deps ─────────────────────────────────────────────────────────────
    if (has.drizzle) {
      const drizzleDeps = buildDrizzleDeps(ctx);
      await mergeJson(pkgPath, drizzleDeps);
    } else {
      await mergeJson(pkgPath, {
        dependencies: {
          "@prisma/client": "^5.0.0",
        },
        devDependencies: {
          prisma: "^5.0.0",
        },
      });
    }
  },
};

function buildDrizzleDeps(ctx: TemplateContext): Record<string, unknown> {
  const { has } = ctx;

  const shared = {
    dependencies: {
      "drizzle-orm": "^0.39.0",
    },
    devDependencies: {
      "drizzle-kit": "^0.30.0",
    },
  };

  if (has.postgres) {
    return {
      ...shared,
      dependencies: {
        ...shared.dependencies,
        pg: "^8.11.0",
      },
      devDependencies: {
        ...shared.devDependencies,
        "@types/pg": "^8.11.0",
      },
    };
  }

  if (has.mysql) {
    return {
      ...shared,
      dependencies: {
        ...shared.dependencies,
        mysql2: "^3.9.0",
      },
    };
  }

  // SQLite
  return {
    ...shared,
    dependencies: {
      ...shared.dependencies,
      "better-sqlite3": "^11.0.0",
    },
    devDependencies: {
      ...shared.devDependencies,
      "@types/better-sqlite3": "^7.6.0",
    },
  };
}
