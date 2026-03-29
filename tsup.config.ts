import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  dts: false,
  clean: true,
  // Inline all deps so the CLI is a single portable file
  noExternal: [/.*/],
});
