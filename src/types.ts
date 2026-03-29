// ─── Project Configuration Types ───────────────────────────────────────────

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type ORM = "drizzle" | "prisma";

export type Database = "postgresql" | "mysql" | "sqlite";

export type Extra =
  | "auth-nextauth"
  | "auth-better-auth"
  | "tailwind"
  | "shadcn"
  | "husky";

export interface ProjectConfig {
  /** The project's directory name */
  projectName: string;
  /** Resolved absolute path to the output directory */
  projectDir: string;
  /** ORM choice */
  orm: ORM;
  /** Database choice */
  database: Database;
  /** Optional features */
  extras: Extra[];
  /** Package manager to use for install */
  packageManager: PackageManager;
  /** Whether to initialize git */
  initGit: boolean;
  /** Whether to run install after scaffolding */
  installDeps: boolean;
}

// ─── Template context passed to every generator ────────────────────────────

export interface TemplateContext {
  config: ProjectConfig;
  /** Convenience flag helpers */
  has: {
    tailwind: boolean;
    shadcn: boolean;
    husky: boolean;
    auth: boolean;
    authNextAuth: boolean;
    authBetterAuth: boolean;
    drizzle: boolean;
    prisma: boolean;
    postgres: boolean;
    mysql: boolean;
    sqlite: boolean;
  };
}

// ─── Generator interface every generator must satisfy ───────────────────────

export interface Generator {
  name: string;
  run(ctx: TemplateContext): Promise<void>;
}
