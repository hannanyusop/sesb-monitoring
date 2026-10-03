import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  outDir: "dist",
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["@prisma/client"],
  noExternal: ["@sesb/billing", "@sesb/contracts", "@sesb/database"],
});
