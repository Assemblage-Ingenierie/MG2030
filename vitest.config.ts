import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Le moteur est PUR : aucun DOM, aucune base. Environnement Node suffisant.
    environment: "node",
    include: ["lib/**/__tests__/**/*.test.ts"],
    coverage: { include: ["lib/schedule/**"], reporter: ["text"] },
  },
});
