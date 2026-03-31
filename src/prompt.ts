import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  outro,
  select,
  text,
} from "@clack/prompts";
import type { APIs, UserChoices } from "./types.js";
import type {
  ORM,
  Database,
  Authentication,
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

  const projectTextResult = await text({
    message: "Enter your project name",
    placeholder: "my-awesome-project",
    validate(value) {
      if (!value?.trim()) return "Project name cannot be empty.";
      if (!/^[a-z0-9-_]+$/.test(value))
        return "Use only lowercase letters, numbers, hyphens, and underscores.";
    },
  });
  handleCancel(projectTextResult);
  const projectName = projectTextResult as string;

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

  const useShadcnResult = await confirm({
    message: "Use shadcn/ui as your component library?",
    initialValue: true,
  });
  handleCancel(useShadcnResult);
  const useShadcn = useShadcnResult as boolean;

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

  const apisResult = await select({
    message: "Choose API Type",
    options: [
      { value: "trpc", label: "tRPC" },
      { value: "orpc", label: "oRPC" },
      { value: "graphql", label: "GraphQL" },
      { value: "rest", label: "REST" },
    ],
  });
  handleCancel(apisResult);
  const apis = apisResult as APIs;

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
    projectName,
    orm,
    database,
    authentication,
    useShadcn,
    stateManagement,
    apis,
    packageManager,
    testing,
    extra,
  };
};
