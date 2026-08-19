// Configuration ESLint « flat » native. eslint-config-next 16 exporte
// directement un tableau de configurations : pas besoin de FlatCompat, qui
// échoue sur ce paquet (structure circulaire au moment de la validation).
import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
