// ============================================================
// lib/schedule/buffer.ts — la marge terminale, déduite de l'échéance.
//
// ⚠ LE DÉBUT DE MARGE EST CALCULÉ, JAMAIS SAISI.
//
// `mg2030_schedule_scenario` porte les trois colonnes — `deadline_date`,
// `buffer_months`, `buffer_start_date` — et rien n'empêchait qu'elles se
// contredisent. Une cérémonie d'ouverture avancée d'un mois, sans toucher au
// début de marge, aurait donné une marge de trois mois affichée « quatre
// mois » : l'écran aurait alors annoncé une sécurité qui n'existait plus.
//
// L'écran de paramètres n'en saisit donc que deux, et la troisième s'en
// déduit ici. Module PUR, donc testé.
// ============================================================

/**
 * `2030-01-01` moins quatre mois → `2029-09-01`.
 *
 * Arithmétique sur les composantes de la date, sans objet `Date` : construire
 * un `Date` depuis une chaîne ISO la lit en UTC, et la relire en heure locale
 * sous un fuseau négatif ferait reculer le résultat d'un jour. Tout le reste
 * de l'application manipule déjà les dates comme des chaînes `yyyy-mm-dd`,
 * pour la même raison.
 *
 * Le 31 d'un mois qui n'en a que 30 recule au dernier jour réel plutôt que de
 * déborder sur le mois suivant : une marge ne doit jamais commencer APRÈS la
 * date qu'on vient d'annoncer.
 */
export function bufferStartFrom(deadline: string, months: number): string {
  const [y, m, d] = deadline.split("-").map(Number);
  if (!y || !m || !d) return deadline;

  const shifted = y * 12 + (m - 1) - months;
  const year = Math.floor(shifted / 12);
  // `%` rend un reste négatif pour un dividende négatif : on le redresse.
  const month = ((shifted % 12) + 12) % 12;

  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);

  return [
    String(year).padStart(4, "0"),
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}
