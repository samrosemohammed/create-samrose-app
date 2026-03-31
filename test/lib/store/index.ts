import { configureStore } from "@reduxjs/toolkit";
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
