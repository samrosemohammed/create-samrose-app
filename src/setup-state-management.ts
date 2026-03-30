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

/**
 * Patch app/layout.tsx to inject a provider import and wrap {children}.
 * Safe to call multiple times — checks for existing import first.
 */
async function patchLayout(
  layoutPath: string,
  importLine: string,
  wrapOpen: string,
  wrapClose: string,
) {
  let layout = await fs.readFile(layoutPath, "utf8");

  // Skip if already patched
  if (layout.includes(importLine)) return;

  // Inject import after the last existing import line
  const lastImportIdx = layout.lastIndexOf("\nimport ");
  const afterImport = layout.indexOf("\n", lastImportIdx + 1) + 1;
  layout =
    layout.slice(0, afterImport) +
    importLine +
    "\n" +
    layout.slice(afterImport);

  // Wrap {children} with provider tags
  layout = layout.replace(
    "{children}",
    `${wrapOpen}\n          {children}\n          ${wrapClose}`,
  );

  await fs.writeFile(layoutPath, layout, "utf8");
}

// ─────────────────────────────────────────────
// ZUSTAND
// ─────────────────────────────────────────────

async function setupZustand(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing Zustand…");
  await install(choices.packageManager, projectDir, ["zustand"]);

  // stores/counter-store.ts — canonical App Router pattern.
  // Key rule: NO global singleton store. Create store with a factory
  // function so each request on the server gets its own instance.
  await write(
    path.join(projectDir, "stores", "counter-store.ts"),
    `import { createStore } from "zustand/vanilla";

export type CounterState = {
  count: number;
};

export type CounterActions = {
  increment: () => void;
  decrement: () => void;
  reset: () => void;
};

export type CounterStore = CounterState & CounterActions;

export const defaultInitState: CounterState = {
  count: 0,
};

/**
 * Factory function — always create a new store instance per request.
 * Never export a singleton store in Next.js App Router.
 * See: https://zustand.docs.pmnd.rs/guides/nextjs
 */
export const createCounterStore = (
  initState: CounterState = defaultInitState,
) =>
  createStore<CounterStore>()((set) => ({
    ...initState,
    increment: () => set((state) => ({ count: state.count + 1 })),
    decrement: () => set((state) => ({ count: state.count - 1 })),
    reset: () => set(defaultInitState),
  }));
`,
  );

  // providers/store-provider.tsx — React context wrapper (required for App Router)
  await write(
    path.join(projectDir, "providers", "store-provider.tsx"),
    `"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createCounterStore,
  type CounterStore,
} from "@/stores/counter-store";

type CounterStoreApi = ReturnType<typeof createCounterStore>;

const CounterStoreContext = createContext<CounterStoreApi | undefined>(
  undefined,
);

export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<CounterStoreApi | undefined>(undefined);

  // Create the store once per component mount (SSR-safe)
  if (!storeRef.current) {
    storeRef.current = createCounterStore();
  }

  return (
    <CounterStoreContext.Provider value={storeRef.current}>
      {children}
    </CounterStoreContext.Provider>
  );
}

export function useCounterStore<T>(selector: (store: CounterStore) => T): T {
  const counterStoreContext = useContext(CounterStoreContext);

  if (!counterStoreContext) {
    throw new Error("useCounterStore must be used within a StoreProvider");
  }

  return useStore(counterStoreContext, selector);
}
`,
  );

  // Patch layout.tsx to wrap with StoreProvider
  const layoutPath = path.join(projectDir, "app", "layout.tsx");
  await patchLayout(
    layoutPath,
    `import { StoreProvider } from "@/providers/store-provider";`,
    "<StoreProvider>",
    "</StoreProvider>",
  );

  console.log("\n  ✅ Zustand ready.");
  console.log("  📌 Usage in a Client Component:");
  console.log(`     "use client"`);
  console.log(
    `     import { useCounterStore } from "@/providers/store-provider"`,
  );
  console.log(`     const count = useCounterStore((state) => state.count)\n`);
}

// ─────────────────────────────────────────────
// REDUX TOOLKIT
// ─────────────────────────────────────────────

async function setupRedux(choices: UserChoices, projectDir: string) {
  console.log("  📦 Installing Redux Toolkit + React Redux…");
  await install(choices.packageManager, projectDir, [
    "@reduxjs/toolkit",
    "react-redux",
  ]);

  // lib/store/index.ts — makeStore factory (NOT a global singleton)
  await write(
    path.join(projectDir, "lib", "store", "index.ts"),
    `import { configureStore } from "@reduxjs/toolkit";
import counterReducer from "./slices/counter-slice";

/**
 * Factory function — create a new store per request on the server.
 * Never export a singleton store in Next.js App Router.
 * See: https://redux-toolkit.js.org/usage/nextjs
 */
export const makeStore = () =>
  configureStore({
    reducer: {
      counter: counterReducer,
    },
  });

// Infer types from the store factory
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
`,
  );

  // lib/store/slices/counter-slice.ts — example slice
  await write(
    path.join(projectDir, "lib", "store", "slices", "counter-slice.ts"),
    `import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface CounterState {
  value: number;
}

const initialState: CounterState = {
  value: 0,
};

export const counterSlice = createSlice({
  name: "counter",
  initialState,
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action: PayloadAction<number>) => {
      state.value += action.payload;
    },
    reset: (state) => {
      state.value = 0;
    },
  },
});

export const { increment, decrement, incrementByAmount, reset } =
  counterSlice.actions;

export default counterSlice.reducer;
`,
  );

  // lib/store/hooks.ts — typed hooks
  await write(
    path.join(projectDir, "lib", "store", "hooks.ts"),
    `import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from ".";

/**
 * Use these typed hooks instead of plain useDispatch / useSelector
 * to get full TypeScript inference from your store.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
`,
  );

  // providers/store-provider.tsx — client component wrapping Redux Provider
  await write(
    path.join(projectDir, "providers", "store-provider.tsx"),
    `"use client";

import { useRef } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/lib/store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | undefined>(undefined);

  // Create the store once per component mount (SSR-safe, avoids shared state)
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}
`,
  );

  // Patch layout.tsx
  const layoutPath = path.join(projectDir, "app", "layout.tsx");
  await patchLayout(
    layoutPath,
    `import { StoreProvider } from "@/providers/store-provider";`,
    "<StoreProvider>",
    "</StoreProvider>",
  );

  console.log("\n  ✅ Redux Toolkit ready.");
  console.log("  📌 Usage in a Client Component:");
  console.log(`     "use client"`);
  console.log(
    `     import { useAppSelector, useAppDispatch } from "@/lib/store/hooks"`,
  );
  console.log(
    `     import { increment } from "@/lib/store/slices/counter-slice"`,
  );
  console.log(
    `     const count = useAppSelector((state) => state.counter.value)`,
  );
  console.log(`     const dispatch = useAppDispatch()\n`);
}

// ─────────────────────────────────────────────
// RECOIL  ⚠️  ARCHIVED — warn the user
// ─────────────────────────────────────────────

async function setupRecoil(choices: UserChoices, projectDir: string) {
  // Recoil's GitHub repo was archived on Jan 1, 2025 (read-only, no new releases).
  // We still scaffold it since the user explicitly chose it, but we warn clearly.
  console.log(`
  ⚠️  WARNING: Recoil was archived by Meta on January 1, 2025.
      It is no longer maintained and will not receive updates or bug fixes.
      Consider migrating to Jotai (API-compatible drop-in alternative)
      or Zustand instead.

      Proceeding with setup as requested…
  `);

  console.log("  📦 Installing Recoil…");
  await install(choices.packageManager, projectDir, ["recoil"]);

  // providers/recoil-provider.tsx — "use client" wrapper required for App Router
  await write(
    path.join(projectDir, "providers", "recoil-provider.tsx"),
    `"use client";

import { RecoilRoot } from "recoil";
import type { ReactNode } from "react";

/**
 * RecoilRoot uses React Context internally, which requires "use client"
 * in the Next.js App Router. Wrapping it here keeps layout.tsx as a
 * Server Component.
 */
export function RecoilProvider({ children }: { children: ReactNode }) {
  return <RecoilRoot>{children}</RecoilRoot>;
}
`,
  );

  // Patch layout.tsx
  const layoutPath = path.join(projectDir, "app", "layout.tsx");
  await patchLayout(
    layoutPath,
    `import { RecoilProvider } from "@/providers/recoil-provider";`,
    "<RecoilProvider>",
    "</RecoilProvider>",
  );

  // atoms/ui-atoms.ts — example atom
  await write(
    path.join(projectDir, "atoms", "ui-atoms.ts"),
    `import { atom } from "recoil";

/**
 * Example atom — replace with your own state shape.
 * Each atom needs a globally unique key.
 */
export const counterAtom = atom<number>({
  key: "counterAtom",
  default: 0,
});

export const darkModeAtom = atom<boolean>({
  key: "darkModeAtom",
  default: false,
});
`,
  );

  console.log("\n  ✅ Recoil scaffolded (with deprecation warning above).");
  console.log("  📌 Usage in a Client Component:");
  console.log(`     "use client"`);
  console.log(`     import { useRecoilState } from "recoil"`);
  console.log(`     import { counterAtom } from "@/atoms/ui-atoms"`);
  console.log(`     const [count, setCount] = useRecoilState(counterAtom)\n`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export async function setupStateManagement(
  choices: UserChoices,
): Promise<void> {
  const { stateManagement, projectName } = choices;
  const projectDir = path.join(process.cwd(), projectName);

  console.log(`\n🗂️  Setting up state management (${stateManagement})…\n`);

  try {
    switch (stateManagement) {
      case "zustand":
        await setupZustand(choices, projectDir);
        break;
      case "redux":
        await setupRedux(choices, projectDir);
        break;
      case "recoil":
        await setupRecoil(choices, projectDir);
        break;
    }
  } catch (error) {
    console.error(`\n❌ State management setup failed: ${error}`);
    throw error;
  }
}
