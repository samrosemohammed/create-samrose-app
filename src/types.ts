export type ProjectName = string;
export type ORM = "prisma" | "drizzle" | "typeorm" | "mongoose";
export type Database = "postgresql" | "mysql" | "sqlite" | "mongodb";
export type Authentication = "nextauth" | "clerk" | "jwt";
export type StateManagement = "zustand" | "redux" | "recoil";
export type APIs = "trpc" | "orpc" | "graphql" | "rest";
export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";
export type Testing = "jest" | "vitest" | "playwright";
export type Extra = "docker" | "github-actions" | "husky";

export interface UserChoices {
  projectName: ProjectName;
  orm: ORM;
  database: Database;
  authentication: Authentication;
  useShadcn: boolean; // true = install shadcn/ui, false = skip
  stateManagement: StateManagement;
  apis: APIs;
  packageManager: PackageManager;
  testing: Testing;
  extra: Extra[];
}
