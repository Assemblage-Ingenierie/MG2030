// ============================================================
// lib/org/time-types.ts — les régimes d'un poste.
//
// ⚠ ICI ET NON DANS `actions.ts`. Un module `"use server"` ne peut exporter
// QUE des fonctions asynchrones : tout le reste devient, côté navigateur, une
// référence d'action distante. Une constante exportée de là arrive donc en
// `undefined`, et le composant tombe sur « TIME_TYPES.map is not a function »
// à l'exécution — ni `tsc` ni `next build` ne le voient, parce que ce n'est
// pas une affaire de types.
// ============================================================

/** Valeurs admises par `mg2030_functional_role.time_type`. `null` = non dit. */
export const TIME_TYPES = ["full_time", "part_time", "full_time_or_part_time"] as const;

export type TimeType = (typeof TIME_TYPES)[number];

export const isTimeType = (value: string): value is TimeType =>
  (TIME_TYPES as readonly string[]).includes(value);
