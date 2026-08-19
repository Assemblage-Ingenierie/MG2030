/** Composition de classes CSS. Évite une dépendance externe (clsx, classnames). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
