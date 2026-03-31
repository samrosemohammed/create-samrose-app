import path from "path";

const buildNextLintCommand = (filenames) =>
  `next lint --fix --file ${filenames
    .map((f) => path.relative(process.cwd(), f))
    .join(" --file ")}`;

const config = {
  // TypeScript/TSX: prettier format + next lint (runs ESLint with Next.js rules) + tsc
  "**/*.{ts,tsx}": [
    "prettier --write",
    buildNextLintCommand,
    () => "tsc -p tsconfig.json --noEmit",
  ],

  // JS/JSX: prettier + next lint
  "**/*.{js,jsx}": ["prettier --write", buildNextLintCommand],

  // JSON, YAML, Markdown, CSS: prettier only
  "**/*.{json,md,yml,yaml,css}": ["prettier --write"],
};

export default config;
