import { execa } from "execa";
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

async function install(
  packageManager: UserChoices["packageManager"],
  projectDir: string,
  deps: string[],
  devDeps: string[] = [],
) {
  const cmd = packageManager === "npm" ? "install" : "add";

  if (deps.length) {
    await execa(packageManager, [cmd, ...deps], {
      cwd: projectDir,
      stdio: "inherit",
    });
  }

  if (devDeps.length) {
    const devFlag = packageManager === "npm" ? "--save-dev" : "-D";
    await execa(packageManager, [cmd, devFlag, ...devDeps], {
      cwd: projectDir,
      stdio: "inherit",
    });
  }
}

// ─────────────────────────────────────────────
// REST
// ─────────────────────────────────────────────

async function setupRest(projectDir: string) {
  await write(
    path.join(projectDir, "app", "api", "health", "route.ts"),
    `import { NextResponse } from "next/server";

export async function GET() {
	return NextResponse.json({
		status: "ok",
		service: "api",
		timestamp: new Date().toISOString(),
	});
}
`,
  );

  await write(
    path.join(projectDir, "app", "api", "hello", "route.ts"),
    `import { NextResponse } from "next/server";

export async function GET() {
	return NextResponse.json({
		message: "Hello from REST API",
	});
}

export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as { name?: string };
	const name = body.name?.trim() || "friend";

	return NextResponse.json({
		message: "Hello, " + name + "!",
	});
}
`,
  );

  console.log("  ✅ REST API routes created:");
  console.log("     GET /api/health");
  console.log("     GET /api/hello");
  console.log("     POST /api/hello\n");
}

// ─────────────────────────────────────────────
// tRPC
// ─────────────────────────────────────────────

async function setupTrpc(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing tRPC server packages…");
  await install(choices.packageManager, projectDir, ["@trpc/server", "zod"]);

  await write(
    path.join(projectDir, "server", "api", "trpc.ts"),
    `import { initTRPC } from "@trpc/server";

export async function createTRPCContext() {
	return {};
}

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
`,
  );

  await write(
    path.join(projectDir, "server", "api", "routers", "_app.ts"),
    `import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const appRouter = createTRPCRouter({
	hello: publicProcedure
		.input(z.object({ name: z.string().optional() }).optional())
		.query(({ input }) => {
			const name = input?.name ?? "world";
			return { greeting: "Hello, " + name + "!" };
		}),
});

export type AppRouter = typeof appRouter;
`,
  );

  await write(
    path.join(projectDir, "app", "api", "trpc", "[trpc]", "route.ts"),
    `import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/routers/_app";
import { createTRPCContext } from "@/server/api/trpc";

const handler = (req: Request) =>
	fetchRequestHandler({
		endpoint: "/api/trpc",
		req,
		router: appRouter,
		createContext: createTRPCContext,
	});

export { handler as GET, handler as POST };
`,
  );

  console.log("  ✅ tRPC server created at /api/trpc");
  console.log("  📌 Example procedure: hello\n");
}

// ─────────────────────────────────────────────
// GraphQL
// ─────────────────────────────────────────────

async function setupGraphql(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing GraphQL packages…");
  await install(choices.packageManager, projectDir, [
    "graphql",
    "graphql-yoga",
  ]);

  await write(
    path.join(projectDir, "app", "api", "graphql", "route.ts"),
    `import { createSchema, createYoga } from "graphql-yoga";

const yoga = createYoga({
	graphqlEndpoint: "/api/graphql",
	schema: createSchema({
		typeDefs: [
			"type Query {",
			"  health: String!",
			"  hello(name: String): String!",
			"}",
		].join("\n"),
		resolvers: {
			Query: {
				health: () => "ok",
				hello: (_parent: unknown, args: { name?: string }) =>
					"Hello, " + (args.name ?? "world") + "!",
			},
		},
	}),
	fetchAPI: { Response },
});

export { yoga as GET, yoga as POST };
`,
  );

  console.log("  ✅ GraphQL endpoint created at /api/graphql");
  console.log("  📌 Queries: health, hello(name)\n");
}

// ─────────────────────────────────────────────
// oRPC (starter)
// ─────────────────────────────────────────────

async function setupOrpc(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing Zod for request validation…");
  await install(choices.packageManager, projectDir, ["zod"]);

  await write(
    path.join(projectDir, "server", "orpc", "hello.ts"),
    `import { z } from "zod";

const helloInput = z.object({
	name: z.string().min(1).optional(),
});

export type HelloInput = z.infer<typeof helloInput>;

export function helloProcedure(input: unknown) {
	const parsed = helloInput.parse(input);
	return {
		message: "Hello, " + (parsed.name ?? "world") + "!",
	};
}
`,
  );

  await write(
    path.join(projectDir, "app", "api", "orpc", "hello", "route.ts"),
    `import { NextResponse } from "next/server";
import { helloProcedure } from "@/server/orpc/hello";

export async function POST(request: Request) {
	const body = await request.json().catch(() => ({}));

	try {
		const result = helloProcedure(body);
		return NextResponse.json(result);
	} catch {
		return NextResponse.json(
			{ error: "Invalid input" },
			{ status: 400 },
		);
	}
}
`,
  );

  console.log("  ✅ oRPC-style starter route created at /api/orpc/hello");
  console.log("  ℹ️  This scaffolds typed RPC patterns with Zod validation.\n");
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export async function setupApis(choices: UserChoices): Promise<void> {
  const { apis, projectName } = choices;
  const projectDir = path.join(process.cwd(), projectName);

  console.log(`\n🌐  Setting up APIs (${apis})…\n`);

  try {
    switch (apis) {
      case "rest":
        await setupRest(projectDir);
        break;
      case "trpc":
        await setupTrpc(choices, projectDir);
        break;
      case "graphql":
        await setupGraphql(choices, projectDir);
        break;
      case "orpc":
        await setupOrpc(choices, projectDir);
        break;
    }
  } catch (error) {
    console.error(`\n❌ API setup failed: ${error}`);
    throw error;
  }
}
