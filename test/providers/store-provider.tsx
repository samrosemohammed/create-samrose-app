"use client";

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
