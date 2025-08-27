import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"], // CommonJS and ES modules
  dts: true, // Generate declaration files
  splitting: false,
  sourcemap: true,
  clean: true, // Clean output directory before building
  target: "node16",
  outDir: "dist",
});
