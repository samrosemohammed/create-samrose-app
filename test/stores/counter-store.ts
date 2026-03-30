import { createStore } from "zustand/vanilla";

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
