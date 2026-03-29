import type { Generator, TemplateContext } from "../types.js";
import { writeFile } from "../utils/helpers.js";
import path from "path";

export const ormGenerator: Generator = {
  name: "orm",

  async run(ctx: TemplateContext): Promise<void> {
    const { has } = ctx;

    if (has.drizzle) {
      await generateDrizzle(ctx);
    } else {
      await generatePrisma(ctx);
    }
  },
};

// ─── Drizzle ──────────────────────────────────────────────────────────────────

async function generateDrizzle(ctx: TemplateContext): Promise<void> {
  const { projectDir } = ctx.config;
  const { has } = ctx;

  // drizzle.config.ts
  await writeFile(
    path.join(projectDir, "drizzle.config.ts"),
    buildDrizzleConfig(ctx),
  );

  // src/db/index.ts
  await writeFile(
    path.join(projectDir, "src/db/index.ts"),
    buildDrizzleConnection(ctx),
  );

  // src/db/schema/index.ts
  await writeFile(
    path.join(projectDir, "src/db/schema/index.ts"),
    buildDrizzleSchema(ctx),
  );

  // src/db/migrations/.gitkeep
  await writeFile(path.join(projectDir, "src/db/migrations/.gitkeep"), "");
}

function buildDrizzleConfig(ctx: TemplateContext): string {
  const { has } = ctx;
  const dialect = has.postgres ? "postgresql" : has.mysql ? "mysql" : "sqlite";

  return `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "${dialect}",
  dbCredentials: {
    url: process.env["DATABASE_URL"]!,
  },
});
`;
}

function buildDrizzleConnection(ctx: TemplateContext): string {
  const { has } = ctx;

  if (has.postgres) {
    return `import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.js";

export const db = drizzle(process.env["DATABASE_URL"]!, { schema });

export type DB = typeof db;
`;
  }

  if (has.mysql) {
    return `import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema/index.js";

const connection = mysql.createPool(process.env["DATABASE_URL"]!);

export const db = drizzle(connection, { schema, mode: "default" });

export type DB = typeof db;
`;
  }

  // SQLite
  return `import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index.js";

const sqlite = new Database(process.env["DATABASE_URL"]!.replace("file:", ""));

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
`;
}

function buildDrizzleSchema(ctx: TemplateContext): string {
  const { has } = ctx;

  if (has.postgres || has.mysql) {
    const pkg = has.postgres ? "drizzle-orm/pg-core" : "drizzle-orm/mysql-core";
    const intFn = has.postgres ? "serial" : "serial";

    return `import { ${intFn}, text, timestamp, pgTable } from "${pkg}";

// ─── Example: users table ────────────────────────────────────────────────────
// Remove or replace this with your actual schema.

export const users = pgTable("users", {
  id: ${intFn}("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
`;
  }

  // SQLite
  return `import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Example: users table ────────────────────────────────────────────────────
// Remove or replace this with your actual schema.

export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: text("created_at")
    .default(sql\`(CURRENT_TIMESTAMP)\`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql\`(CURRENT_TIMESTAMP)\`)
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
`;
}

// ─── Prisma ───────────────────────────────────────────────────────────────────

async function generatePrisma(ctx: TemplateContext): Promise<void> {
  const { projectDir } = ctx.config;

  await writeFile(
    path.join(projectDir, "prisma/schema.prisma"),
    buildPrismaSchema(ctx),
  );

  await writeFile(
    path.join(projectDir, "src/db/index.ts"),
    `import { PrismaClient } from "@prisma/client";

// ─── Singleton pattern for Prisma in Next.js ──────────────────────────────────
// Prevents multiple instances during hot reloads in development.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") globalForPrisma.prisma = db;

export type { PrismaClient } from "@prisma/client";
`,
  );
}

function buildPrismaSchema(ctx: TemplateContext): string {
  const { has } = ctx;

  const provider = has.postgres ? "postgresql" : has.mysql ? "mysql" : "sqlite";

  return `// This is your Prisma schema file.
// Learn more: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

// ─── Example: User model ─────────────────────────────────────────────────────
// Remove or replace this with your actual models.

model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
}
