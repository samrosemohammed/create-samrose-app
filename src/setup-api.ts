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

async function patchLayout(
  layoutPath: string,
  importLine: string,
  wrapOpen: string,
  wrapClose: string,
) {
  let layout = await fs.readFile(layoutPath, "utf8");
  if (layout.includes(importLine)) return;

  const lastImportIdx = layout.lastIndexOf("\nimport ");
  const afterImport = layout.indexOf("\n", lastImportIdx + 1) + 1;
  layout =
    layout.slice(0, afterImport) +
    importLine +
    "\n" +
    layout.slice(afterImport);

  layout = layout.replace(
    "{children}",
    `${wrapOpen}\n          {children}\n          ${wrapClose}`,
  );

  await fs.writeFile(layoutPath, layout, "utf8");
}

// ─────────────────────────────────────────────
// tRPC v11
// ─────────────────────────────────────────────

async function setupTRPC(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing tRPC v11 + TanStack Query + Zod…");
  await install(choices.packageManager, projectDir, [
    "@trpc/server@next",
    "@trpc/client@next",
    "@trpc/tanstack-react-query@next",
    "@tanstack/react-query",
    "zod",
    "superjson",
    "server-only",
  ]);

  // trpc/init.ts — server-side init: context, base procedure, router factory
  await write(
    path.join(projectDir, "trpc", "init.ts"),
    `import { initTRPC } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";

/**
 * createTRPCContext is called once per request.
 * Add auth session, db, headers, etc. here.
 */
export const createTRPCContext = cache(async () => {
  return {
    // session: await auth(), // uncomment after wiring auth
  };
});

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

// Protected procedure — uncomment and wire up your auth
// const isAuthed = t.middleware(({ ctx, next }) => {
//   if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
//   return next({ ctx: { session: ctx.session } });
// });
// export const protectedProcedure = t.procedure.use(isAuthed);
`,
  );

  // trpc/routers/_app.ts — root router, merge sub-routers here
  await write(
    path.join(projectDir, "trpc", "routers", "_app.ts"),
    `import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { z } from "zod";

export const appRouter = createTRPCRouter({
  // Example procedure — replace with your own routers
  hello: baseProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(({ input }) => {
      return \`Hello, \${input.name ?? "world"}!\`;
    }),
});

// Export type for the client
export type AppRouter = typeof appRouter;
`,
  );

  // trpc/query-client.ts — SSR-safe QueryClient factory
  await write(
    path.join(projectDir, "trpc", "query-client.ts"),
    `import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR: don't refetch immediately on client after server prefetch
        staleTime: 60 * 1000,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
`,
  );

  // trpc/server.tsx — server-side caller + HydrateClient for prefetching
  await write(
    path.join(projectDir, "trpc", "server.tsx"),
    `import "server-only";
import { createHydrationHelpers } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { createCallerFactory, createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

// One QueryClient per request on the server
const getQueryClient = cache(makeQueryClient);

const caller = createCallerFactory(appRouter)(createTRPCContext);

export const { trpc, HydrateClient, prefetch } = createHydrationHelpers<
  typeof appRouter
>(caller, getQueryClient);
`,
  );

  // trpc/client.tsx — TRPCReactProvider + useTRPC hook for Client Components
  await write(
    path.join(projectDir, "trpc", "client.tsx"),
    `"use client";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";
import type { AppRouter } from "./routers/_app";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let clientQueryClientSingleton: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create a new QueryClient
    return makeQueryClient();
  }
  // Browser: use a singleton
  return (clientQueryClientSingleton ??= makeQueryClient());
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
`,
  );

  // app/api/trpc/[trpc]/route.ts — HTTP handler
  await write(
    path.join(projectDir, "app", "api", "trpc", "[trpc]", "route.ts"),
    `import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(\`tRPC error on \${path ?? "<no-path>"}:\`, error);
          }
        : undefined,
  });

export { handler as GET, handler as POST };
`,
  );

  // Patch layout.tsx to wrap with TRPCReactProvider
  const layoutPath = path.join(projectDir, "app", "layout.tsx");
  await patchLayout(
    layoutPath,
    `import { TRPCReactProvider } from "@/trpc/client";`,
    "<TRPCReactProvider>",
    "</TRPCReactProvider>",
  );

  console.log("\n  ✅ tRPC v11 ready.");
  console.log("  📌 Server Component usage:");
  console.log(
    `     import { trpc, prefetch, HydrateClient } from "@/trpc/server"`,
  );
  console.log(`     void prefetch(trpc.hello.queryOptions({ name: "world" }))`);
  console.log("  📌 Client Component usage:");
  console.log(`     "use client"`);
  console.log(`     import { useTRPC } from "@/trpc/client"`);
  console.log(`     import { useQuery } from "@tanstack/react-query"`);
  console.log(
    `     const trpc = useTRPC(); const { data } = useQuery(trpc.hello.queryOptions({}))\n`,
  );
}

// ─────────────────────────────────────────────
// oRPC
// ─────────────────────────────────────────────

async function setupORPC(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing oRPC + TanStack Query + Zod…");
  await install(choices.packageManager, projectDir, [
    "@orpc/server",
    "@orpc/client",
    "@orpc/react-query",
    "@tanstack/react-query",
    "zod",
    "server-only",
  ]);

  // lib/orpc.ts — router definition
  await write(
    path.join(projectDir, "lib", "orpc.ts"),
    `import { os } from "@orpc/server";
import { z } from "zod";

/**
 * Base procedure — add auth middleware here when needed.
 * const isAuthed = os.middleware(({ context, next }) => { ... });
 * export const authedProcedure = os.use(isAuthed);
 */
export const publicProcedure = os;

export const router = os.router({
  // Example procedure — replace with your own
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .handler(({ input }) => {
      return \`Hello, \${input.name ?? "world"}!\`;
    }),
});

export type Router = typeof router;
`,
  );

  // app/rpc/[[...rest]]/route.ts — HTTP handler (catch-all)
  await write(
    path.join(projectDir, "app", "rpc", "[[...rest]]", "route.ts"),
    `import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { router } from "@/lib/orpc";

export const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[oRPC error]", error);
      }
    }),
  ],
});

async function handleRequest(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: "/rpc",
    context: {}, // add auth context here
  });
  return response ?? new Response("Not found", { status: 404 });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
`,
  );

  // lib/orpc-client.ts — isomorphic client (server uses direct caller, client uses HTTP)
  await write(
    path.join(projectDir, "lib", "orpc-client.ts"),
    `import type { RouterClient } from "@orpc/server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { Router } from "./orpc";

declare global {
  // eslint-disable-next-line no-var
  var $orpcClient: RouterClient<Router> | undefined;
}

/**
 * Client-side client — uses HTTP to call /rpc.
 * On the server, globalThis.$orpcClient is replaced with the direct caller
 * via lib/orpc-server.ts imported in instrumentation.ts.
 */
const link = new RPCLink({
  url: () => {
    if (typeof window === "undefined") {
      throw new Error("RPCLink should not be used server-side.");
    }
    return \`\${window.location.origin}/rpc\`;
  },
});

export const client: RouterClient<Router> =
  globalThis.$orpcClient ?? createORPCClient(link);
`,
  );

  // lib/orpc-server.ts — server-side direct caller (no HTTP overhead)
  await write(
    path.join(projectDir, "lib", "orpc-server.ts"),
    `import "server-only";
import { createRouterClient } from "@orpc/server";
import { router } from "./orpc";

/**
 * Server-side client — calls procedures directly without HTTP.
 * Imported via instrumentation.ts so it runs before any RSC render.
 */
globalThis.$orpcClient = createRouterClient(router, {
  context: async () => ({}), // add per-request context here
});
`,
  );

  // instrumentation.ts — ensures server client is set up before RSC rendering
  await write(
    path.join(projectDir, "instrumentation.ts"),
    `export async function register() {
  // Set up the oRPC server-side client before any RSC render.
  // This eliminates redundant HTTP calls during SSR.
  await import("./lib/orpc-server");
}
`,
  );

  // providers/orpc-provider.tsx — TanStack Query provider for Client Components
  await write(
    path.join(projectDir, "providers", "orpc-provider.tsx"),
    `"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function ORPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
`,
  );

  // Patch layout.tsx
  const layoutPath = path.join(projectDir, "app", "layout.tsx");
  await patchLayout(
    layoutPath,
    `import { ORPCProvider } from "@/providers/orpc-provider";`,
    "<ORPCProvider>",
    "</ORPCProvider>",
  );

  console.log("\n  ✅ oRPC ready.");
  console.log("  📌 Server Component usage (direct call, no HTTP):");
  console.log(`     import { client } from "@/lib/orpc-client"`);
  console.log(`     const result = await client.hello({ name: "world" })`);
  console.log("  📌 Client Component usage:");
  console.log(`     "use client"`);
  console.log(`     import { useQuery } from "@tanstack/react-query"`);
  console.log(`     import { orpcReactQueryUtils } from "@orpc/react-query"`);
  console.log(`     import { client } from "@/lib/orpc-client"\n`);
}

// ─────────────────────────────────────────────
// GraphQL (Yoga server + Apollo Client)
// ─────────────────────────────────────────────

async function setupGraphQL(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing GraphQL Yoga + Apollo Client…");
  await install(choices.packageManager, projectDir, [
    "graphql",
    "graphql-yoga",
    "@apollo/client",
    "@apollo/client-integration-nextjs",
    "server-only",
  ]);

  // lib/graphql/schema.ts — type definitions + resolvers
  await write(
    path.join(projectDir, "lib", "graphql", "schema.ts"),
    `import { createSchema } from "graphql-yoga";

export const schema = createSchema({
  typeDefs: /* GraphQL */ \`
    type Query {
      hello(name: String): String!
    }

    # Add your types here
    # type User {
    #   id: ID!
    #   email: String!
    # }
  \`,
  resolvers: {
    Query: {
      hello: (_: unknown, { name }: { name?: string }) =>
        \`Hello, \${name ?? "world"}!\`,
    },
  },
});
`,
  );

  // app/api/graphql/route.ts — Yoga route handler
  await write(
    path.join(projectDir, "app", "api", "graphql", "route.ts"),
    `import { createYoga } from "graphql-yoga";
import { schema } from "@/lib/graphql/schema";

interface NextContext {
  params: Promise<Record<string, string>>;
}

const { handleRequest } = createYoga<NextContext>({
  schema,
  graphqlEndpoint: "/api/graphql",
  // GraphiQL is only served in development automatically
  fetchAPI: { Response },
});

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as OPTIONS,
};
`,
  );

  // lib/apollo-client.ts — server-side Apollo client (RSC)
  await write(
    path.join(projectDir, "lib", "apollo-client.ts"),
    `import "server-only";
import { HttpLink } from "@apollo/client";
import {
  registerApolloClient,
  ApolloClient,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";

export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      // Use an absolute URL — relative URLs don't work in SSR
      uri: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:3000/api/graphql",
    }),
  });
});
`,
  );

  // providers/apollo-provider.tsx — client-side Apollo provider
  await write(
    path.join(projectDir, "providers", "apollo-provider.tsx"),
    `"use client";

import { HttpLink } from "@apollo/client";
import {
  ApolloNextAppProvider,
  ApolloClient,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";

function makeClient() {
  const httpLink = new HttpLink({
    uri: "/api/graphql",
  });

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
  });
}

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  return (
    <ApolloNextAppProvider makeClient={makeClient}>
      {children}
    </ApolloNextAppProvider>
  );
}
`,
  );

  // Patch layout.tsx
  const layoutPath = path.join(projectDir, "app", "layout.tsx");
  await patchLayout(
    layoutPath,
    `import { ApolloProvider } from "@/providers/apollo-provider";`,
    "<ApolloProvider>",
    "</ApolloProvider>",
  );

  // .env.local — GraphQL URL
  const envPath = path.join(projectDir, ".env.local");
  const existing = await fs.readFile(envPath, "utf8").catch(() => "");
  if (!existing.includes("NEXT_PUBLIC_GRAPHQL_URL")) {
    await fs.appendFile(
      envPath,
      `\nNEXT_PUBLIC_GRAPHQL_URL="http://localhost:3000/api/graphql"\n`,
    );
  }

  console.log("\n  ✅ GraphQL ready.");
  console.log(
    "  📌 GraphiQL playground (dev only): http://localhost:3000/api/graphql",
  );
  console.log("  📌 Server Component usage:");
  console.log(`     import { query } from "@/lib/apollo-client"`);
  console.log(`     import { gql } from "@apollo/client"`);
  console.log(`     const { data } = await query({ query: gql\`{ hello }\` })`);
  console.log("  📌 Client Component usage:");
  console.log(`     "use client"`);
  console.log(`     import { useQuery, gql } from "@apollo/client"\n`);
}

// ─────────────────────────────────────────────
// REST
// ─────────────────────────────────────────────

async function setupREST(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing Zod for request validation…");
  await install(choices.packageManager, projectDir, ["zod"]);

  // lib/api/response.ts — typed response helpers
  await write(
    path.join(projectDir, "lib", "api", "response.ts"),
    `import { NextResponse } from "next/server";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: string; details?: unknown };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T): NextResponse<ApiSuccess<T>> {
  return ok(data, 201);
}

export function badRequest(error: string, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json({ success: false, error, details }, { status: 400 });
}

export function unauthorized(error = "Unauthorized"): NextResponse<ApiError> {
  return NextResponse.json({ success: false, error }, { status: 401 });
}

export function notFound(error = "Not found"): NextResponse<ApiError> {
  return NextResponse.json({ success: false, error }, { status: 404 });
}

export function serverError(error = "Internal server error"): NextResponse<ApiError> {
  return NextResponse.json({ success: false, error }, { status: 500 });
}
`,
  );

  // lib/api/validate.ts — Zod request body validator
  await write(
    path.join(projectDir, "lib", "api", "validate.ts"),
    `import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";

/**
 * Parse and validate the JSON body of a request against a Zod schema.
 * Returns { data } on success, { error } response on failure.
 */
export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>,
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    return { data };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        error: NextResponse.json(
          { success: false, error: "Validation failed", details: err.flatten() },
          { status: 400 },
        ),
      };
    }
    return {
      error: NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 },
      ),
    };
  }
}
`,
  );

  // app/api/hello/route.ts — example REST endpoint
  await write(
    path.join(projectDir, "app", "api", "hello", "route.ts"),
    `import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";

// GET /api/hello?name=world
export async function GET(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get("name") ?? "world";
    return ok({ message: \`Hello, \${name}!\` });
  } catch {
    return serverError();
  }
}

const PostSchema = z.object({
  name: z.string().min(1).max(100),
});

// POST /api/hello  { "name": "world" }
export async function POST(req: NextRequest) {
  const { data, error } = await validateBody(req, PostSchema);
  if (error) return error;

  try {
    return ok({ message: \`Hello, \${data.name}!\` });
  } catch {
    return serverError();
  }
}
`,
  );

  // lib/api/fetcher.ts — type-safe client-side fetch wrapper
  await write(
    path.join(projectDir, "lib", "api", "fetcher.ts"),
    `import type { ApiResponse } from "./response";

/**
 * Typed fetch wrapper for consuming the REST API from Client Components.
 * Throws if the request fails or the server returns success: false.
 */
export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new Error(json.error ?? "API error");
  }

  return json.data;
}
`,
  );

  console.log("\n  ✅ REST API ready.");
  console.log("  📌 Example endpoint: GET /api/hello?name=world");
  console.log("  📌 Server Component usage:");
  console.log(`     import { apiFetch } from "@/lib/api/fetcher"`);
  console.log(
    `     const data = await apiFetch<{ message: string }>("/api/hello")`,
  );
  console.log("  📌 Add new endpoints under app/api/<resource>/route.ts");
  console.log(
    `     Use ok(), created(), badRequest() from "@/lib/api/response"`,
  );
  console.log(
    `     Use validateBody() from "@/lib/api/validate" for POST bodies\n`,
  );
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export async function setupApi(choices: UserChoices): Promise<void> {
  const { apis, projectName } = choices;
  const projectDir = path.join(process.cwd(), projectName);

  console.log(`\n🔌  Setting up API layer (${apis})…\n`);

  try {
    switch (apis) {
      case "trpc":
        await setupTRPC(choices, projectDir);
        break;
      case "orpc":
        await setupORPC(choices, projectDir);
        break;
      case "graphql":
        await setupGraphQL(choices, projectDir);
        break;
      case "rest":
        await setupREST(choices, projectDir);
        break;
    }
  } catch (error) {
    console.error(`\n❌ API setup failed: ${error}`);
    throw error;
  }
}
