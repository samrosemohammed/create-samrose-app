import { execa } from "execa";
import fs from "fs/promises";
import path from "path";
import type { UserChoices } from "./types.js";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Run a package-manager install command inside the scaffolded project dir */
async function install(
  packageManager: UserChoices["packageManager"],
  projectDir: string,
  deps: string[],
  devDeps: string[] = [],
) {
  const pmInstall: Record<UserChoices["packageManager"], string> = {
    npm: "install",
    yarn: "add",
    pnpm: "add",
    bun: "add",
  };

  const cmd = pmInstall[packageManager];

  if (deps.length) {
    await execa(packageManager, [cmd, ...deps], {
      cwd: projectDir,
      stdio: "inherit",
    });
  }

  if (devDeps.length) {
    const devFlag =
      packageManager === "npm"
        ? "--save-dev"
        : packageManager === "yarn"
          ? "--dev"
          : "-D";
    await execa(packageManager, [cmd, devFlag, ...devDeps], {
      cwd: projectDir,
      stdio: "inherit",
    });
  }
}

/** Write a file, creating intermediate directories as needed */
async function write(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

// ─────────────────────────────────────────────
// Database URL placeholders per database
// ─────────────────────────────────────────────

function databaseUrl(database: UserChoices["database"]): string {
  switch (database) {
    case "postgresql":
      return "postgresql://USER:PASSWORD@localhost:5432/mydb?schema=public";
    case "mysql":
      return "mysql://USER:PASSWORD@localhost:3306/mydb";
    case "sqlite":
      return "file:./dev.db";
    case "mongodb":
      return "mongodb://localhost:27017/mydb";
  }
}

// ─────────────────────────────────────────────
// ORM dialect helpers for Drizzle / TypeORM
// ─────────────────────────────────────────────

type DrizzleDialect = "postgresql" | "mysql" | "sqlite";

function drizzleDialect(database: UserChoices["database"]): DrizzleDialect {
  if (database === "mongodb") {
    throw new Error("Drizzle does not support MongoDB – pick a SQL database.");
  }
  return database as DrizzleDialect;
}

function drizzleDriver(database: UserChoices["database"]): {
  dep: string; // runtime driver
  devDep?: string; // type package (pg only)
  importPath: string; // drizzle subpackage
  clientCode: string; // how to instantiate the client
} {
  switch (database) {
    case "postgresql":
      return {
        dep: "pg",
        devDep: "@types/pg",
        importPath: "drizzle-orm/node-postgres",
        clientCode: `import { Pool } from "pg";\nconst client = new Pool({ connectionString: process.env.DATABASE_URL! });`,
      };
    case "mysql":
      return {
        dep: "mysql2",
        importPath: "drizzle-orm/mysql2",
        clientCode: `import mysql from "mysql2/promise";\nconst client = await mysql.createConnection({ uri: process.env.DATABASE_URL! });`,
      };
    case "sqlite":
      return {
        dep: "better-sqlite3",
        devDep: "@types/better-sqlite3",
        importPath: "drizzle-orm/better-sqlite3",
        clientCode: `import Database from "better-sqlite3";\nconst client = new Database(process.env.DATABASE_URL ?? "dev.db");`,
      };
    default:
      throw new Error(`Unsupported Drizzle database: ${database}`);
  }
}

// ─────────────────────────────────────────────
// PRISMA
// ─────────────────────────────────────────────

async function setupPrisma(choices: UserChoices, projectDir: string) {
  const { packageManager, database } = choices;

  console.log("  📦 Installing Prisma packages…");
  await install(packageManager, projectDir, ["@prisma/client"], ["prisma"]);

  console.log("  ⚙️  Initialising Prisma…");
  await execa("npx", ["prisma", "init", "--datasource-provider", database], {
    cwd: projectDir,
    stdio: "inherit",
  });

  // Singleton db client  (lib/db.ts)
  await write(
    path.join(projectDir, "lib", "db.ts"),
    `import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["query"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
`,
  );

  // Add postinstall script so Vercel regenerates the client after each deploy
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  pkg.scripts = { ...pkg.scripts, postinstall: "prisma generate" };
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf8");

  console.log("  ✅ Prisma ready. Update DATABASE_URL in .env, then run:");
  console.log("     npx prisma migrate dev --name init");
}

// ─────────────────────────────────────────────
// DRIZZLE
// ─────────────────────────────────────────────

async function setupDrizzle(choices: UserChoices, projectDir: string) {
  const { packageManager, database } = choices;

  drizzleDialect(database); // validates MongoDB is not selected
  const driver = drizzleDriver(database);

  console.log("  📦 Installing Drizzle packages…");
  const prodDeps = ["drizzle-orm", driver.dep];
  const devDeps = ["drizzle-kit"];
  if (driver.devDep) devDeps.push(driver.devDep);
  await install(packageManager, projectDir, prodDeps, devDeps);

  // drizzle.config.ts
  await write(
    path.join(projectDir, "drizzle.config.ts"),
    `import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "${drizzleDialect(database)}",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`,
  );

  // db/schema.ts  – minimal placeholder
  await write(
    path.join(projectDir, "db", "schema.ts"),
    `// Define your Drizzle schema here.
// Docs: https://orm.drizzle.team/docs/sql-schema-declaration
`,
  );

  // db/index.ts  – db client singleton
  await write(
    path.join(projectDir, "db", "index.ts"),
    `${driver.clientCode}
import { drizzle } from "${driver.importPath}";
import * as schema from "./schema";

export const db = drizzle(client, { schema });
`,
  );

  // .env.local placeholder
  const envPath = path.join(projectDir, ".env.local");
  const existing = await fs.readFile(envPath, "utf8").catch(() => "");
  if (!existing.includes("DATABASE_URL")) {
    await fs.appendFile(envPath, `\nDATABASE_URL="${databaseUrl(database)}"\n`);
  }

  // package.json db scripts
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  pkg.scripts = {
    ...pkg.scripts,
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:push": "drizzle-kit push",
  };
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf8");

  console.log(
    "  ✅ Drizzle ready. Update DATABASE_URL in .env.local, then run:",
  );
  console.log("     npm run db:generate && npm run db:migrate");
}

// ─────────────────────────────────────────────
// TYPEORM
// ─────────────────────────────────────────────

function typeormDriver(database: UserChoices["database"]): {
  dep: string;
  devDep?: string;
  type: string; // TypeORM datasource type string
} {
  switch (database) {
    case "postgresql":
      return { dep: "pg", devDep: "@types/pg", type: "postgres" };
    case "mysql":
      return { dep: "mysql2", type: "mysql" };
    case "sqlite":
      return {
        dep: "better-sqlite3",
        devDep: "@types/better-sqlite3",
        type: "better-sqlite3",
      };
    case "mongodb":
      return { dep: "mongodb", type: "mongodb" };
  }
}

async function setupTypeORM(choices: UserChoices, projectDir: string) {
  const { packageManager, database } = choices;
  const driver = typeormDriver(database);

  console.log("  📦 Installing TypeORM packages…");
  const prodDeps = ["typeorm", "reflect-metadata", driver.dep];
  const devDeps = driver.devDep ? [driver.devDep] : [];
  await install(packageManager, projectDir, prodDeps, devDeps);

  // TypeORM requires these tsconfig options
  const tsconfigPath = path.join(projectDir, "tsconfig.json");
  const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, "utf8"));
  tsconfig.compilerOptions = {
    ...tsconfig.compilerOptions,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    strictPropertyInitialization: false,
  };
  await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");

  // lib/data-source.ts
  const dbUrl = databaseUrl(database);
  await write(
    path.join(projectDir, "lib", "data-source.ts"),
    `import "reflect-metadata";
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
  type: "${driver.type}",
  url: process.env.DATABASE_URL ?? "${dbUrl}",
  synchronize: process.env.NODE_ENV === "development", // NEVER true in production
  logging: process.env.NODE_ENV === "development",
  entities: ["entities/**/*.ts"],
  migrations: ["migrations/**/*.ts"],
});

// Singleton for Next.js hot-reload safety
const globalForTypeORM = globalThis as unknown as { dataSource?: DataSource };

export async function getDataSource(): Promise<DataSource> {
  if (globalForTypeORM.dataSource?.isInitialized) {
    return globalForTypeORM.dataSource;
  }
  const ds = await AppDataSource.initialize();
  if (process.env.NODE_ENV !== "production") {
    globalForTypeORM.dataSource = ds;
  }
  return ds;
}
`,
  );

  // entities/ placeholder
  await write(
    path.join(projectDir, "entities", ".gitkeep"),
    "# Place your TypeORM entity files here.\n",
  );

  // .env.local placeholder
  const envPath = path.join(projectDir, ".env.local");
  const existing = await fs.readFile(envPath, "utf8").catch(() => "");
  if (!existing.includes("DATABASE_URL")) {
    await fs.appendFile(envPath, `\nDATABASE_URL="${dbUrl}"\n`);
  }

  // package.json migration scripts
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  pkg.scripts = {
    ...pkg.scripts,
    typeorm: "typeorm-ts-node-commonjs",
    "migration:generate":
      "typeorm-ts-node-commonjs migration:generate -d lib/data-source.ts",
    "migration:run":
      "typeorm-ts-node-commonjs migration:run -d lib/data-source.ts",
    "migration:revert":
      "typeorm-ts-node-commonjs migration:revert -d lib/data-source.ts",
  };
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf8");

  console.log("  ✅ TypeORM ready. Update DATABASE_URL in .env.local.");
  console.log(
    "     Add entities in /entities, then run: npm run migration:generate",
  );
}

// ─────────────────────────────────────────────
// MONGOOSE
// ─────────────────────────────────────────────

async function setupMongoose(choices: UserChoices, projectDir: string) {
  const { packageManager } = choices;

  console.log("  📦 Installing Mongoose…");
  await install(packageManager, projectDir, ["mongoose"], []);

  // next.config.ts  – required for mongoose + webpack in Next.js
  const nextConfigPath = path.join(projectDir, "next.config.ts");
  await write(
    nextConfigPath,
    `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose"],
};

export default nextConfig;
`,
  );

  // lib/db.ts  – cached singleton connection (recommended by Mongoose docs)
  await write(
    path.join(projectDir, "lib", "db.ts"),
    `import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable in .env.local",
  );
}

// Cached connection for Next.js hot-reload safety
const globalForMongoose = globalThis as unknown as {
  mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
};

const cached = globalForMongoose.mongoose ?? { conn: null, promise: null };
if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = cached;
}

export async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI!, { bufferCommands: false })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
`,
  );

  // models/ placeholder
  await write(
    path.join(projectDir, "models", ".gitkeep"),
    "# Place your Mongoose model files here.\n",
  );

  // .env.local placeholder
  const envPath = path.join(projectDir, ".env.local");
  const existing = await fs.readFile(envPath, "utf8").catch(() => "");
  if (!existing.includes("MONGODB_URI")) {
    await fs.appendFile(envPath, `\nMONGODB_URI="${databaseUrl("mongodb")}"\n`);
  }

  console.log("  ✅ Mongoose ready. Update MONGODB_URI in .env.local.");
}

// ─────────────────────────────────────────────
// Main entry
// ─────────────────────────────────────────────

export async function setupOrm(choices: UserChoices): Promise<void> {
  const { orm, projectName } = choices;
  const projectDir = path.join(process.cwd(), projectName);

  console.log(`\n🗄️  Setting up ${orm}…\n`);

  try {
    switch (orm) {
      case "prisma":
        await setupPrisma(choices, projectDir);
        break;
      case "drizzle":
        await setupDrizzle(choices, projectDir);
        break;
      case "typeorm":
        await setupTypeORM(choices, projectDir);
        break;
      case "mongoose":
        await setupMongoose(choices, projectDir);
        break;
    }
  } catch (error) {
    console.error(`\n❌ ORM setup failed: ${error}`);
    throw error;
  }
}
