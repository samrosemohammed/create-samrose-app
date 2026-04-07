# create-samrose-app

Opinionated Next.js project scaffolder for teams that want to move fast without repeating setup work.

It bootstraps a Next.js app and wires in your chosen stack for ORM, database, auth, API layer, state management, testing, UI, and extras.

## Why this exists

Starting a Next.js app is easy. Starting it with the full stack you actually want is usually repetitive and error-prone.

`create-samrose-app` asks a small set of interactive questions and generates a ready-to-extend foundation so you can start building features immediately.

## Features

- Interactive CLI prompts (project + stack choices)
- Next.js App Router + TypeScript + Tailwind + ESLint scaffold
- ORM setup: Prisma, Drizzle, TypeORM, or Mongoose
- Database wiring: PostgreSQL, MySQL, SQLite, MongoDB
- Auth setup: NextAuth, Clerk, or JWT scaffold
- API layer setup: tRPC, oRPC, GraphQL, or REST scaffold
- State management setup: Zustand, Redux Toolkit, or Recoil
- Testing setup: Jest or Vitest with sensible defaults
- Optional extras: Docker, GitHub Actions, Husky
- Package manager detection: npm, pnpm, yarn, bun

## Quick Start

Run directly with your package manager of choice:

```bash
npx create-samrose-app@latest
```

```bash
pnpm create samrose-app@latest
```

```bash
yarn create samrose-app
```

```bash
bun create samrose-app
```

You will be prompted to choose your preferred stack.

## Global Install (Optional)

```bash
npm i -g create-samrose-app
create-samrose-app
```

## What the CLI asks

1. Project name
2. ORM
3. Database
4. Authentication
5. shadcn/ui (yes/no)
6. State management
7. API type
8. Testing framework
9. Extras (Docker, GitHub Actions, Husky)

## Supported Stack Options

### ORM

- Prisma
- Drizzle
- TypeORM
- Mongoose

### Database

- PostgreSQL
- MySQL
- SQLite
- MongoDB

### Authentication

- NextAuth (Auth.js)
- Clerk
- JWT scaffold

### API Layer

- tRPC
- oRPC
- GraphQL
- REST

### State Management

- Zustand
- Redux Toolkit
- Recoil

### Testing

- Jest
- Vitest

### Extras

- Docker (multi-stage Dockerfile + dev compose)
- GitHub Actions (CI/deploy workflow scaffold)
- Husky (git hook setup)

## Generated Project Notes

The generator creates the Next.js app first, then applies your selected integrations.

Depending on your choices, it can also:

- Add db/auth/provider boilerplate files
- Add environment variable placeholders (`.env` or `.env.local`)
- Add migration/test helper scripts to the generated app's `package.json`
- Add Docker and GitHub workflow files

## Example Usage

```bash
npx create-samrose-app@latest
# follow the interactive prompts
cd your-project-name
npm run dev
```

## Requirements

- Node.js (current LTS recommended)
- One of: npm, pnpm, yarn, bun

Some options may require external services/tools:

- Docker (for containerized db/app flow)
- OAuth provider credentials (for NextAuth/Clerk)
- Local database or Docker database runtime

## Scripts (this package)

```bash
npm run dev      # run CLI in watch mode via tsx
npm run build    # build CLI with tsup
npm run start    # run CLI from source
```

## Development

```bash
git clone https://github.com/samrosemohammed/create-samrose-app.git
cd create-samrose-app
npm install
npm run dev
```

## Publishing New Versions

```bash
# 1) bump version
npm version patch   # or minor / major

# 2) publish (prepublishOnly runs build)
npm publish --access public

# 3) push tags
git push && git push --tags
```

## Contributing

Issues and PRs are welcome.

If you open a PR:

1. Keep changes focused and scoped
2. Explain which stack paths you tested
3. Include before/after behavior when changing scaffold output

## License

ISC
