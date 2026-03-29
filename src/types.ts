export type ORM = "prisma" | "drizzle" | "typeorm" | "mongoose";
export type Database = "postgresql" | "mysql" | "sqlite" | "mongodb";
export type Authentication = "nextauth" | "clerk" | "jwt";
export type ComponentLibrary = "shadcn";
export type StateManagement = "zustand" | "redux" | "recoil";
export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";
export type Testing = "jest" | "vitest";
export type Extra = "docker" | "github-actions" | "husky";

export interface UserChoices {
  orm: ORM;
  database: Database;
  authentication: Authentication;
  componentLibrary: ComponentLibrary;
  stateManagement: StateManagement;
  packageManager: PackageManager;
  testing: Testing;
  extra: Extra[];
}
