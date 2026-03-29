import {
  cancel,
  intro,
  isCancel,
  multiselect,
  outro,
  select,
} from "@clack/prompts";
import type { UserChoices } from "./types.js";
import type {
  ORM,
  Database,
  Authentication,
  ComponentLibrary,
  StateManagement,
  PackageManager,
  Testing,
  Extra,
} from "./types.js";

const handleCancel = <T>(value: T | symbol): T => {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
  return value as T;
};

export const promptUser = async (): Promise<UserChoices> => {
  intro("Setup your stack 🚀");

  const ormResult = await select({
    message: "Choose ORM",
    options: [
      { value: "prisma", label: "Prisma" },
      { value: "drizzle", label: "Drizzle" },
      { value: "typeorm", label: "TypeORM" },
      { value: "mongoose", label: "Mongoose" },
    ],
  });
  handleCancel(ormResult);
  const orm = ormResult as ORM;

  const databaseResult = await select({
    message: "Choose Database",
    options: [
      { value: "postgresql", label: "PostgreSQL" },
      { value: "mysql", label: "MySQL" },
      { value: "sqlite", label: "SQLite" },
      { value: "mongodb", label: "MongoDB" },
    ],
  });
  handleCancel(databaseResult);
  const database = databaseResult as Database;

  const authenticationResult = await select({
    message: "Choose Authentication",
    options: [
      { value: "nextauth", label: "NextAuth" },
      { value: "clerk", label: "Clerk" },
      { value: "jwt", label: "JWT" },
    ],
  });
  handleCancel(authenticationResult);
  const authentication = authenticationResult as Authentication;

  const componentLibraryResult = await select({
    message: "Choose Component Library",
    options: [{ value: "shadcn", label: "shadcn/ui" }],
  });
  handleCancel(componentLibraryResult);
  const componentLibrary = componentLibraryResult as ComponentLibrary;

  const stateManagementResult = await select({
    message: "Choose State Management",
    options: [
      { value: "zustand", label: "Zustand" },
      { value: "redux", label: "Redux" },
      { value: "recoil", label: "Recoil" },
    ],
  });
  handleCancel(stateManagementResult);
  const stateManagement = stateManagementResult as StateManagement;

  const packageManagerResult = await select({
    message: "Choose Package Manager",
    options: [
      { value: "npm", label: "npm" },
      { value: "yarn", label: "yarn" },
      { value: "pnpm", label: "pnpm" },
      { value: "bun", label: "bun" },
    ],
  });
  handleCancel(packageManagerResult);
  const packageManager = packageManagerResult as PackageManager;

  const testingResult = await select({
    message: "Choose Testing Framework",
    options: [
      { value: "jest", label: "Jest" },
      { value: "vitest", label: "Vitest" },
    ],
  });
  handleCancel(testingResult);
  const testing = testingResult as Testing;

  const extraResult = await multiselect({
    message: "Select Extras",
    options: [
      { value: "docker", label: "Docker" },
      { value: "github-actions", label: "GitHub Actions" },
      { value: "husky", label: "Husky (Git hooks)" },
    ],
  });
  handleCancel(extraResult);
  const extra = extraResult as Extra[];

  outro("All set! 🎉");

  return {
    orm,
    database,
    authentication,
    componentLibrary,
    stateManagement,
    packageManager,
    testing,
    extra,
  };
};
