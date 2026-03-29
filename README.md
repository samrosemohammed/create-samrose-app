# create-samrose-app

A CLI to scaffold production-ready **Next.js 15** apps with your preferred stack — interactively, in seconds.

```bash
# npm
npm create samrose-app@latest

# pnpm
pnpm create samrose-app@latest

# yarn
yarn create samrose-app

# bun
bun create samrose-app@latest

# or with a project name up front
pnpm create samrose-app@latest my-project
```

---

## What it scaffolds

| Feature             | Options                                     |
| ------------------- | ------------------------------------------- |
| **Framework**       | Next.js 15 (App Router, Turbopack)          |
| **Language**        | TypeScript (strict)                         |
| **ORM**             | Drizzle ORM · Prisma                        |
| **Database**        | PostgreSQL · MySQL · SQLite                 |
| **Styling**         | Tailwind CSS v4                             |
| **UI**              | shadcn/ui (new-york style)                  |
| **Auth**            | Auth.js (NextAuth v5) · Better Auth         |
| **Git hooks**       | Husky · lint-staged · Commitlint · Prettier |
| **Package manager** | pnpm · bun · npm · yarn (auto-detected)     |

---

## Project structure (output)

```
my-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       └── auth/          # (if auth selected)
│   ├── components/
│   │   ├── ui/                # shadcn components go here
│   │   └── providers.tsx
│   ├── db/
│   │   ├── index.ts           # db client singleton
│   │   ├── schema/            # (Drizzle) or prisma/schema.prisma (Prisma)
│   │   └── migrations/
│   ├── lib/
│   │   ├── utils.ts           # cn() helper
│   │   ├── auth.ts            # (if auth selected)
│   │   └── auth-client.ts     # (if Better Auth selected)
│   ├── config/
│   │   └── app.ts
│   ├── types/
│   │   └── index.ts
│   └── middleware.ts          # (if NextAuth selected)
├── .env
├── .env.example
├── .gitignore
├── .husky/                    # (if husky selected)
├── .prettierignore            # (if husky selected)
├── commitlint.config.ts       # (if husky selected)
├── components.json            # (if shadcn selected)
├── drizzle.config.ts          # (if Drizzle selected)
├── next.config.ts
├── package.json
├── prettier.config.ts         # (if husky selected)
├── postcss.config.mjs         # (if tailwind selected)
├── tsconfig.json
└── README.md
```

---

## After scaffolding

```bash
cd my-project
cp .env.example .env       # fill in DATABASE_URL etc.
pnpm run db:push           # push schema to your database
pnpm run dev               # start the dev server
```

### Available scripts

| Script        | Description                         |
| ------------- | ----------------------------------- |
| `dev`         | Start dev server (Turbopack)        |
| `build`       | Production build                    |
| `start`       | Start production server             |
| `typecheck`   | Run `tsc --noEmit`                  |
| `lint`        | Run ESLint                          |
| `db:generate` | Generate migrations                 |
| `db:migrate`  | Run migrations                      |
| `db:push`     | Push schema directly                |
| `db:studio`   | Open Drizzle Studio / Prisma Studio |

---

## Adding more stack options (contributors)

Each feature is an isolated **generator** in `src/generators/`. To add a new option:

1. Create `src/generators/my-feature.ts` implementing the `Generator` interface
2. Add the new `Extra` type to `src/types.ts`
3. Register it in `src/commands/create.ts`
4. Add the prompt option in `src/prompts/index.ts`

---

## License

MIT
