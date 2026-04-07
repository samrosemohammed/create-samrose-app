<div align="center">

# create-samrose-app

**The opinionated full-stack Next.js scaffold CLI.**

[![npm version](https://img.shields.io/npm/v/create-samrose-app?color=crimson&style=flat-square)](https://www.npmjs.com/package/create-samrose-app)
[![npm downloads](https://img.shields.io/npm/dm/create-samrose-app?color=crimson&style=flat-square)](https://www.npmjs.com/package/create-samrose-app)
[![license](https://img.shields.io/npm/l/create-samrose-app?style=flat-square)](https://github.com/samrosemohammed/create-samrose-app/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/samrosemohammed/create-samrose-app?style=flat-square)](https://github.com/samrosemohammed/create-samrose-app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

Answer a few questions. Get a production-ready Next.js project — wired up, not just bootstrapped.

</div>

---

## Why

`create-next-app` gives you a blank canvas. `create-samrose-app` gives you the whole studio.

One command connects your ORM to your database, your auth provider to your middleware, your state management provider to your layout, and your API layer to your client — all with real, working boilerplate instead of placeholder comments.

---

## Quick Start

```bash
# npm
npx create-samrose-app@latest

# pnpm
pnpm dlx create-samrose-app@latest

# yarn
yarn dlx create-samrose-app@latest

# bun
bunx create-samrose-app@latest
```

> **Requires Node.js 18+**

---

## What It Scaffolds

Answer ten questions in the terminal and get a complete, wired-up Next.js 15 App Router project.

```
┌  Setup your stack 🚀
│
◇  Enter your project name
│  my-app
│
◇  Choose ORM
│  Prisma / Drizzle / TypeORM / Mongoose
│
◇  Choose Database
│  PostgreSQL / MySQL / SQLite / MongoDB
│
◇  Choose Authentication
│  NextAuth v5 / Clerk / JWT
│
◇  Use shadcn/ui as your component library?
│  Yes / No
│
◇  Choose State Management
│  Zustand / Redux Toolkit / Recoil
│
◇  Choose API Type
│  tRPC / oRPC / GraphQL / REST
│
◇  Choose Package Manager
│  npm / yarn / pnpm / bun
│
◇  Choose Testing Framework
│  Jest / Vitest
│
◇  Select Extras
│  Docker / GitHub Actions / Husky
│
└  All set! 🎉
```

---

## What Gets Set Up

Every step is fully automated — no copy-pasting from docs.

### 1 · Next.js 15

- App Router, TypeScript, Tailwind CSS, ESLint, Turbopack
- `--agents` flag for AGENTS.md (guides AI coding assistants)
- Correct package manager used throughout

### 2 · ORM

| Choice       | What happens                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Prisma**   | Installs `@prisma/client`, runs `prisma init`, writes `lib/db.ts` singleton, adds `postinstall: prisma generate`                          |
| **Drizzle**  | Installs driver + `drizzle-kit`, writes `drizzle.config.ts`, `db/schema.ts`, `db/index.ts`, adds `db:generate / migrate / studio` scripts |
| **TypeORM**  | Installs `typeorm` + driver, patches `tsconfig.json` for decorators, writes HMR-safe `getDataSource()` singleton, adds migration scripts  |
| **Mongoose** | Installs `mongoose`, patches `next.config.ts` with `serverExternalPackages`, writes cached connection singleton                           |

### 3 · Database

| Choice         | What happens                                                                             |
| -------------- | ---------------------------------------------------------------------------------------- |
| **PostgreSQL** | Writes `docker-compose.yml` with `postgres:17-alpine`, health checks, named volume       |
| **MySQL**      | Writes `docker-compose.yml` with `mysql:9-debian`                                        |
| **MongoDB**    | Writes `docker-compose.yml` with `mongo:8`, correct `authSource=admin` connection string |
| **SQLite**     | File-based — no Docker needed                                                            |

Connection strings are written to the correct `.env` file for your ORM automatically.

### 4 · Authentication

| Choice          | What happens                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NextAuth v5** | Installs `next-auth@beta`, writes `auth.ts` root config, route handler, `middleware.ts`, `lib/auth-helpers.ts`, `/login` page                                    |
| **Clerk**       | Installs `@clerk/nextjs`, writes `clerkMiddleware()`, patches `layout.tsx` with `<ClerkProvider>`, generates `/sign-in` and `/sign-up` catch-all pages           |
| **JWT**         | Installs `jose` + `bcryptjs`, writes edge-safe `lib/jwt.ts`, cookie-based middleware, `/api/auth/login`, `/api/auth/register`, `/api/auth/logout` route handlers |

### 5 · shadcn/ui

Runs `npx shadcn@latest init --defaults --force` — detects Tailwind v4, writes `components.json`, `lib/utils.ts`, updates `globals.css` with CSS variables. Skip it and nothing is installed.

### 6 · State Management

| Choice            | What happens                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Zustand**       | Factory store pattern (no global singleton — safe for SSR), `StoreProvider` with `useRef`, typed `useCounterStore` hook |
| **Redux Toolkit** | `makeStore` factory, `configureStore`, example slice, typed `useAppSelector` / `useAppDispatch` hooks, `StoreProvider`  |
| **Recoil**        | `RecoilProvider` client wrapper, example atoms — **note: Recoil was archived Jan 2025, consider Jotai**                 |

All providers are automatically patched into `app/layout.tsx`.

### 7 · API Layer

| Choice       | What happens                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **tRPC v11** | Full 6-file setup: `init.ts`, `routers/_app.ts`, `query-client.ts`, `server.tsx` (HydrateClient + prefetch), `client.tsx` (TRPCReactProvider), route handler |
| **oRPC**     | Router definition, catch-all route handler, isomorphic client (server = direct call, browser = HTTP), `instrumentation.ts` for SSR optimization              |
| **GraphQL**  | GraphQL Yoga route handler, Apollo Client for RSC (`registerApolloClient`), `ApolloWrapper` for Client Components                                            |
| **REST**     | Typed response helpers (`ok`, `created`, `badRequest`…), Zod `validateBody()`, `apiFetch` client wrapper, example `/api/hello` endpoint                      |

### 8 · Testing

| Choice     | What happens                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jest**   | Installs all official packages, writes `jest.config.ts` with `next/jest`, `jest.setup.ts`, example component + server-action tests, adds `test / test:watch / test:ci` scripts        |
| **Vitest** | Installs official packages, writes `vitest.config.mts` with `@vitejs/plugin-react` + `vite-tsconfig-paths`, `vitest.setup.ts`, example tests, adds `test / test:ui / test:ci` scripts |

### 9 · Extras (multi-select)

| Choice             | What happens                                                                                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker**         | 3-stage `Dockerfile` (deps → builder → runner), `.dockerignore`, patches `next.config.ts` with `output: "standalone"`, `docker-compose.dev.yml`                                                                                    |
| **GitHub Actions** | `ci.yml` (type-check + lint + test + build with `.next/cache` caching, correct per-PM setup) + `deploy.yml` stub with Vercel/Docker options                                                                                        |
| **Husky**          | Installs Husky + lint-staged + Prettier, `pre-commit` hook running lint-staged, `commit-msg` hook for conventional commits, `.lintstagedrc.mjs` using `next lint --file` pattern, `.prettierrc` with `prettier-plugin-tailwindcss` |

---

## Stack Compatibility

|            | Prisma | Drizzle | TypeORM | Mongoose |
| ---------- | :----: | :-----: | :-----: | :------: |
| PostgreSQL |   ✅   |   ✅    |   ✅    |    ❌    |
| MySQL      |   ✅   |   ✅    |   ✅    |    ❌    |
| SQLite     |   ✅   |   ✅    |   ✅    |    ❌    |
| MongoDB    |   ✅   |   ❌    |   ✅    |    ✅    |

> Drizzle does not support MongoDB. Selecting that combination will throw a clear error at setup time.

---

## Generated Project Structure

```
my-app/
├── app/
│   ├── api/
│   │   ├── auth/          # Auth route handlers
│   │   └── trpc/          # tRPC handler (or graphql/, hello/)
│   ├── login/             # Auth pages
│   └── layout.tsx         # Patched with all providers
├── lib/
│   ├── db.ts              # ORM singleton
│   ├── jwt.ts             # JWT helpers (JWT auth only)
│   └── api/               # REST helpers (REST only)
├── stores/ or lib/store/  # State management
├── trpc/ or lib/orpc.ts   # API layer
├── providers/             # All client providers
├── middleware.ts           # Auth middleware
├── auth.ts                # NextAuth config (NextAuth only)
├── .env.local             # Connection strings + secrets
├── docker-compose.yml     # Database (PostgreSQL / MySQL / MongoDB)
├── Dockerfile             # App image (Docker extra)
├── jest.config.ts         # Or vitest.config.mts
├── .github/workflows/     # CI + deploy (GitHub Actions extra)
└── .husky/                # Git hooks (Husky extra)
```

---

## Requirements

- **Node.js** 18 or later
- **Git** (required for Husky git hooks)
- **Docker** (required if you select Docker extra or want to run the database locally)

---

## Contributing

Contributions are welcome! Please open an issue before submitting a PR for large changes.

```bash
git clone https://github.com/samrosemohammed/create-samrose-app.git
cd create-samrose-app
npm install
npm start
```

---

## License

ISC © [samrosemohammed](https://github.com/samrosemohammed)
