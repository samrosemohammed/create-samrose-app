# create-samrose-app

Opinionated CLI to scaffold a modern Next.js app with your preferred stack choices.

## Quick Start

Use `npx` (recommended):

```bash
npx create-samrose-app
```

Or install globally:

```bash
npm i -g create-samrose-app
create-samrose-app
```

## What It Helps You Configure

- ORM: Prisma, Drizzle, TypeORM, or Mongoose
- Database: PostgreSQL, MySQL, SQLite, or MongoDB
- Authentication: NextAuth, Clerk, or JWT
- UI: optional shadcn/ui
- State management: Zustand, Redux, or Recoil
- API: tRPC, oRPC, GraphQL, or REST
- Testing: Jest or Vitest
- Extras: Docker, GitHub Actions, Husky

## Requirements

- Node.js 18+
- npm, pnpm, yarn, or bun

## Development

```bash
npm install
npm run dev
```

Build CLI:

```bash
npm run build
```

Dry-run package publish:

```bash
npm pack --dry-run
```

## Publish to npm

```bash
npm login
npm publish --access public
```

## Repository

https://github.com/samrosemohammed/create-samrose-app
