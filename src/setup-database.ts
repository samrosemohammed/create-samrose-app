import fs from "fs/promises";
import path from "path";
import type { UserChoices } from "./types.js";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function write(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function appendEnv(envPath: string, vars: Record<string, string>) {
  const existing = await fs.readFile(envPath, "utf8").catch(() => "");
  const lines = Object.entries(vars)
    .filter(([key]) => !existing.includes(key))
    .map(([key, val]) => `${key}="${val}"`)
    .join("\n");
  if (lines) await fs.appendFile(envPath, `\n${lines}\n`);
}

// ─────────────────────────────────────────────
// docker-compose files per database
// ─────────────────────────────────────────────

function postgresCompose(projectName: string): string {
  return `services:
  postgres:
    image: postgres:17-alpine
    container_name: ${projectName}-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: \${POSTGRES_DB:-${projectName}}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
`;
}

function mysqlCompose(projectName: string): string {
  return `services:
  mysql:
    image: mysql:9-debian
    container_name: ${projectName}-mysql
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD:-root}
      MYSQL_USER: \${MYSQL_USER:-mysql}
      MYSQL_PASSWORD: \${MYSQL_PASSWORD:-mysql}
      MYSQL_DATABASE: \${MYSQL_DATABASE:-${projectName}}
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mysql_data:
`;
}

function mongoCompose(projectName: string): string {
  return `services:
  mongodb:
    image: mongo:8
    container_name: ${projectName}-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: \${MONGO_USER:-mongo}
      MONGO_INITDB_ROOT_PASSWORD: \${MONGO_PASSWORD:-mongo}
      MONGO_INITDB_DATABASE: \${MONGO_DB:-${projectName}}
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongo_data:
`;
}

// ─────────────────────────────────────────────
// Env var values per ORM × database combo
// ─────────────────────────────────────────────

function envVars(
  orm: UserChoices["orm"],
  database: UserChoices["database"],
  projectName: string,
): Record<string, string> {
  // Mongoose only uses MONGODB_URI (set in setup-orm.ts already, but
  // we ensure the docker-friendly value with auth here)
  if (orm === "mongoose") {
    return {
      MONGODB_URI: `mongodb://mongo:mongo@localhost:27017/${projectName}?authSource=admin`,
    };
  }

  switch (database) {
    case "postgresql":
      return {
        DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${projectName}`,
      };
    case "mysql":
      return {
        DATABASE_URL: `mysql://mysql:mysql@localhost:3306/${projectName}`,
      };
    case "sqlite":
      // SQLite is file-based – no docker needed, just the file path
      return {
        DATABASE_URL: `file:./dev.db`,
      };
    case "mongodb":
      return {
        DATABASE_URL: `mongodb://mongo:mongo@localhost:27017/${projectName}?authSource=admin`,
      };
  }
}

/**
 * Prisma init already creates a `.env` file.
 * Drizzle / TypeORM / Mongoose write to `.env.local` (Next.js convention).
 */
function envFileName(orm: UserChoices["orm"]): string {
  return orm === "prisma" ? ".env" : ".env.local";
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export async function setupDatabase(choices: UserChoices): Promise<void> {
  const { database, orm, projectName } = choices;
  const projectDir = path.join(process.cwd(), projectName);

  console.log(`\n🐳  Setting up database (${database})…\n`);

  // 1. Write docker-compose.yml (skip for SQLite – it's a local file)
  if (database !== "sqlite") {
    let composeContent: string;

    switch (database) {
      case "postgresql":
        composeContent = postgresCompose(projectName);
        break;
      case "mysql":
        composeContent = mysqlCompose(projectName);
        break;
      case "mongodb":
        composeContent = mongoCompose(projectName);
        break;
    }

    await write(path.join(projectDir, "docker-compose.yml"), composeContent!);
    console.log("  📄 docker-compose.yml written");
  } else {
    console.log("  ℹ️  SQLite is file-based – no Docker setup needed.");
  }

  // 2. Write / update the correct .env file
  const envPath = path.join(projectDir, envFileName(orm));
  const vars = envVars(orm, database, projectName);
  await appendEnv(envPath, vars);
  console.log(`  🔑 ${envFileName(orm)} updated with connection vars`);

  // 3. Add .env.local to .gitignore if not already there
  const gitignorePath = path.join(projectDir, ".gitignore");
  const gitignore = await fs.readFile(gitignorePath, "utf8").catch(() => "");
  const gitignoreAdditions: string[] = [];
  if (!gitignore.includes(".env.local")) gitignoreAdditions.push(".env.local");
  if (!gitignore.includes(".env*.local"))
    gitignoreAdditions.push(".env*.local");
  if (gitignoreAdditions.length) {
    await fs.appendFile(
      gitignorePath,
      `\n# local env files\n${gitignoreAdditions.join("\n")}\n`,
    );
  }

  // 4. Print next steps
  console.log("\n  ✅ Database ready.\n");

  if (database === "sqlite") {
    console.log("  📌 Next step: run your first migration to create dev.db");
  } else {
    console.log("  📌 Start your local database:");
    console.log(`     docker compose up -d\n`);
    console.log("  📌 Then run your first migration:");
  }

  switch (orm) {
    case "prisma":
      console.log("     npx prisma migrate dev --name init");
      break;
    case "drizzle":
      console.log(`     npm run db:generate && npm run db:migrate`);
      break;
    case "typeorm":
      console.log(`     npm run migration:generate && npm run migration:run`);
      break;
    case "mongoose":
      console.log(
        "     (Mongoose creates collections automatically on first write)",
      );
      break;
  }

  console.log();
}
