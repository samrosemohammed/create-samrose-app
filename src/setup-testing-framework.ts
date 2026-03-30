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

async function updateScripts(
  projectDir: string,
  scripts: Record<string, string>,
) {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  pkg.scripts = {
    ...(pkg.scripts ?? {}),
    ...scripts,
  };

  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

// ─────────────────────────────────────────────
// Jest
// ─────────────────────────────────────────────

async function setupJest(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing Jest + Testing Library…");

  await install(
    choices.packageManager,
    projectDir,
    [],
    [
      "jest",
      "jest-environment-jsdom",
      "@types/jest",
      "@testing-library/react",
      "@testing-library/jest-dom",
      "@testing-library/user-event",
      "@testing-library/dom",
    ],
  );

  await updateScripts(projectDir, {
    test: "jest",
    "test:watch": "jest --watch",
    "test:ci": "jest --runInBand --ci",
  });

  await write(
    path.join(projectDir, "jest.config.mjs"),
    `import nextJest from "next/jest.js";

const createJestConfig = nextJest({
	dir: "./",
});

const customJestConfig = {
	testEnvironment: "jsdom",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/$1",
	},
};

export default createJestConfig(customJestConfig);
`,
  );

  await write(
    path.join(projectDir, "jest.setup.ts"),
    `import "@testing-library/jest-dom";
`,
  );

  await write(
    path.join(projectDir, "__tests__", "app-page.test.tsx"),
    `import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
	it("renders heading text", () => {
		render(<Home />);

		expect(screen.getByText(/save and see your changes/i)).toBeInTheDocument();
	});
});
`,
  );

  console.log("  ✅ Jest configured.");
  console.log("  📌 Run tests with: npm run test\n");
}

// ─────────────────────────────────────────────
// Vitest
// ─────────────────────────────────────────────

async function setupVitest(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing Vitest + Testing Library…");

  await install(
    choices.packageManager,
    projectDir,
    [],
    [
      "vitest",
      "jsdom",
      "@testing-library/react",
      "@testing-library/jest-dom",
      "@testing-library/user-event",
      "@testing-library/dom",
    ],
  );

  await updateScripts(projectDir, {
    test: "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
  });

  await write(
    path.join(projectDir, "vitest.config.ts"),
    `import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
});
`,
  );

  await write(
    path.join(projectDir, "vitest.setup.ts"),
    `import "@testing-library/jest-dom/vitest";
`,
  );

  await write(
    path.join(projectDir, "__tests__", "app-page.test.tsx"),
    `import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
	it("renders heading text", () => {
		render(<Home />);

		expect(screen.getByText(/save and see your changes/i)).toBeInTheDocument();
	});
});
`,
  );

  console.log("  ✅ Vitest configured.");
  console.log("  📌 Run tests with: npm run test\n");
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export async function setupTestingFramework(
  choices: UserChoices,
): Promise<void> {
  const { testing, projectName } = choices;
  const projectDir = path.join(process.cwd(), projectName);

  console.log(`\n🧪  Setting up testing framework (${testing})…\n`);

  try {
    switch (testing) {
      case "jest":
        await setupJest(choices, projectDir);
        break;
      case "vitest":
        await setupVitest(choices, projectDir);
        break;
    }
  } catch (error) {
    console.error(`\n❌ Testing setup failed: ${error}`);
    throw error;
  }
}
