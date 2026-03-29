import type { ProjectConfig, TemplateContext } from "../types.js";

export function buildContext(config: ProjectConfig): TemplateContext {
  const { extras, orm, database } = config;

  return {
    config,
    has: {
      tailwind: extras.includes("tailwind") || extras.includes("shadcn"),
      shadcn: extras.includes("shadcn"),
      husky: extras.includes("husky"),
      auth:
        extras.includes("auth-nextauth") || extras.includes("auth-better-auth"),
      authNextAuth: extras.includes("auth-nextauth"),
      authBetterAuth: extras.includes("auth-better-auth"),
      drizzle: orm === "drizzle",
      prisma: orm === "prisma",
      postgres: database === "postgresql",
      mysql: database === "mysql",
      sqlite: database === "sqlite",
    },
  };
}
