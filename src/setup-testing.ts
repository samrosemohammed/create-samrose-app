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
  devDeps: string[],
) {
  const cmd = packageManager === "npm" ? "install" : "add";
  const devFlag = packageManager === "npm" ? "--save-dev" : "-D";
  await execa(packageManager, [cmd, devFlag, ...devDeps], {
    cwd: projectDir,
    stdio: "inherit",
  });
}

async function addScripts(projectDir: string, scripts: Record<string, string>) {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  pkg.scripts = { ...pkg.scripts, ...scripts };
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
}

// ─────────────────────────────────────────────
// JEST
// ─────────────────────────────────────────────

async function setupJest(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing Jest + React Testing Library…");

  // Official Next.js docs packages for Jest + RTL
  await install(choices.packageManager, projectDir, [
    "jest",
    "jest-environment-jsdom",
    "@testing-library/react",
    "@testing-library/dom",
    "@testing-library/user-event",
    "@testing-library/jest-dom",
    "ts-node",
    "@types/jest",
  ]);

  // jest.config.ts — uses next/jest transformer (official Next.js pattern)
  await write(
    path.join(projectDir, "jest.config.ts"),
    `import type { Config } from "jest";
import nextJest from "next/jest.js";

/**
 * next/jest automatically:
 *  - transforms code with the Next.js compiler (SWC)
 *  - mocks CSS/image/font imports
 *  - loads .env.local into process.env
 *  - sets up the @/ path alias from tsconfig
 */
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",

  // jsdom for React component tests.
  // Override per-file with /** @jest-environment node */ for Server Actions / Route Handlers.
  testEnvironment: "jsdom",

  // Run after the test framework is installed but before tests execute.
  // Adds all @testing-library/jest-dom matchers (.toBeInTheDocument() etc.)
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // Map @/ to project root (next/jest does this too, but explicit is safer)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },

  // Reset mocks between tests to avoid state leakage
  clearMocks: true,
  resetMocks: true,

  // Coverage collection — excludes generated/config files
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!<rootDir>/.next/**",
    "!<rootDir>/*.config.*",
    "!<rootDir>/coverage/**",
  ],
};

// createJestConfig is exported this way so next/jest can load the async Next.js config
export default createJestConfig(config);
`,
  );

  // jest.setup.ts — extend Jest matchers with @testing-library/jest-dom
  await write(
    path.join(projectDir, "jest.setup.ts"),
    `import "@testing-library/jest-dom";

// Global test setup goes here.
// Examples:
//   - Mock environment variables
//   - Set up MSW (Mock Service Worker) for API mocking
//   - Reset any global state
`,
  );

  // __tests__/page.test.tsx — example component test
  await write(
    path.join(projectDir, "__tests__", "page.test.tsx"),
    `import { render, screen } from "@testing-library/react";
import Page from "@/app/page";

/**
 * Example test for the home page (Client Component).
 * For Server Components, use /** @jest-environment node *\/ and
 * import the component directly — no render() needed for pure logic.
 */
describe("Home Page", () => {
  it("renders without crashing", () => {
    render(<Page />);
    // Update this selector to match your actual page content
    expect(document.body).toBeTruthy();
  });
});
`,
  );

  // __tests__/example-server-action.test.ts — shows Node environment usage
  await write(
    path.join(projectDir, "__tests__", "example-server-action.test.ts"),
    `/**
 * @jest-environment node
 *
 * Use the node environment for:
 *   - Server Actions
 *   - Route Handlers (app/api/**/route.ts)
 *   - Utility functions with no DOM dependency
 */

// Example: testing a pure utility function
function add(a: number, b: number) {
  return a + b;
}

describe("add utility", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });
});
`,
  );

  // Add scripts to package.json
  await addScripts(projectDir, {
    test: "jest",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage",
  });

  console.log("\n  ✅ Jest ready.");
  console.log("  📌 Commands:");
  console.log("     npm test              — run all tests once");
  console.log("     npm run test:watch    — watch mode");
  console.log("     npm run test:ci       — CI mode with coverage");
  console.log("  📌 Key rules for App Router:");
  console.log("     • Client Components  → default jsdom environment");
  console.log(
    "     • Server Actions / Route Handlers → add /** @jest-environment node */ at top of file\n",
  );
}

// ─────────────────────────────────────────────
// VITEST
// ─────────────────────────────────────────────

async function setupVitest(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing Vitest + React Testing Library…");

  // Official Next.js docs packages for Vitest
  await install(choices.packageManager, projectDir, [
    "vitest",
    "@vitejs/plugin-react",
    "jsdom",
    "@testing-library/react",
    "@testing-library/dom",
    "@testing-library/user-event",
    "@testing-library/jest-dom",
    "vite-tsconfig-paths",
    "@vitest/coverage-v8",
  ]);

  // vitest.config.mts — official Next.js recommended config
  await write(
    path.join(projectDir, "vitest.config.mts"),
    `import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest config for Next.js App Router.
 *
 * Note: Vitest does NOT support async Server Components (RSC).
 * Test those with E2E tools like Playwright instead.
 * Synchronous Server Components and all Client Components work fine.
 */
export default defineConfig({
  plugins: [
    // Resolves @/ aliases from tsconfig.json automatically
    tsconfigPaths(),
    // Transforms JSX/TSX and enables React Fast Refresh in tests
    react(),
  ],
  test: {
    // Simulate a browser-like DOM environment
    environment: "jsdom",

    // Make describe/it/expect available globally (no imports needed)
    globals: true,

    // Run after framework setup — imports jest-dom matchers
    setupFiles: ["./vitest.setup.ts"],

    // Match standard test file patterns
    include: ["**/*.{test,spec}.{ts,tsx}"],

    // Exclude Next.js build output and node_modules
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
    ],

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "*.config.*",
        "**/*.d.ts",
        "**/types/**",
      ],
    },
  },
});
`,
  );

  // vitest.setup.ts — extend matchers with @testing-library/jest-dom
  await write(
    path.join(projectDir, "vitest.setup.ts"),
    `import "@testing-library/jest-dom";

// Global test setup goes here.
// Examples:
//   - Mock environment variables: vi.stubEnv("KEY", "value")
//   - Set up MSW (Mock Service Worker) for API mocking
//   - Reset global state between tests
`,
  );

  // __tests__/page.test.tsx — example component test
  await write(
    path.join(projectDir, "__tests__", "page.test.tsx"),
    `import { render, screen } from "@testing-library/react";
import { expect, describe, it } from "vitest";
import Page from "@/app/page";

/**
 * Example test for the home page (Client Component).
 *
 * ⚠️  Vitest does not support async Server Components.
 * For async RSCs, use Playwright E2E tests instead.
 */
describe("Home Page", () => {
  it("renders without crashing", () => {
    render(<Page />);
    // Update this assertion to match your actual page content
    expect(document.body).toBeTruthy();
  });
});
`,
  );

  // __tests__/example.test.ts — pure unit test example
  await write(
    path.join(projectDir, "__tests__", "example.test.ts"),
    `import { describe, it, expect } from "vitest";

// Example: testing a pure utility function
function add(a: number, b: number) {
  return a + b;
}

describe("add utility", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("handles negative numbers", () => {
    expect(add(-1, 1)).toBe(0);
  });
});
`,
  );

  // Add scripts to package.json
  await addScripts(projectDir, {
    test: "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:ci": "vitest run --coverage",
  });

  console.log("\n  ✅ Vitest ready.");
  console.log("  📌 Commands:");
  console.log("     npm test              — watch mode (default)");
  console.log("     npm run test:ci       — run once with coverage (CI)");
  console.log("     npm run test:ui       — open Vitest UI in browser");
  console.log("  📌 Key rules for App Router:");
  console.log(
    "     • Sync Server Components + Client Components → fully supported",
  );
  console.log(
    "     • Async Server Components (RSC) → use Playwright E2E instead\n",
  );
}

// ─────────────────────────────────────────────
// PLAYWRIGHT
// ─────────────────────────────────────────────

async function setupPlaywright(choices: UserChoices, projectDir: string) {
  const devCommand =
    choices.packageManager === "npm"
      ? "npm run dev"
      : choices.packageManager === "yarn"
        ? "yarn dev"
        : choices.packageManager === "pnpm"
          ? "pnpm dev"
          : "bun run dev";

  console.log("  📦 Installing Playwright…");

  await install(choices.packageManager, projectDir, ["@playwright/test"]);

  await write(
    path.join(projectDir, "playwright.config.ts"),
    `import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "${devCommand}",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
`,
  );

  await write(
    path.join(projectDir, "e2e", "home.spec.ts"),
    `import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
});
`,
  );

  await addScripts(projectDir, {
    test: "playwright test",
    "test:ci": "playwright test",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "test:install-browsers": "playwright install --with-deps",
  });

  console.log("\n  ✅ Playwright ready.");
  console.log("  📌 One-time setup:");
  console.log("     npm run test:install-browsers");
  console.log("  📌 Commands:");
  console.log("     npm test              — run E2E tests");
  console.log("     npm run test:ui       — open Playwright UI mode");
  console.log("     npm run test:headed   — run tests with visible browser\n");
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export async function setupTesting(choices: UserChoices): Promise<void> {
  const { testing, projectName } = choices;
  const projectDir = path.join(process.cwd(), projectName);

  console.log(`\n🧪  Setting up testing (${testing})…\n`);

  try {
    switch (testing) {
      case "jest":
        await setupJest(choices, projectDir);
        break;
      case "vitest":
        await setupVitest(choices, projectDir);
        break;
      case "playwright":
        await setupPlaywright(choices, projectDir);
        break;
    }
  } catch (error) {
    console.error(`\n❌ Testing setup failed: ${error}`);
    throw error;
  }
}
