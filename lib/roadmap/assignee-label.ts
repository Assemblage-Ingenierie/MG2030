// ============================================================
// lib/roadmap/assignee-label.ts — écrire un assignataire court.
//
// « kushtrim krasniqi » occupait deux lignes dans une cellule de tableau, et
// trois assignataires remplissaient la colonne à eux seuls. Or dans une équipe
// de trente personnes, le prénom suffit à désigner — c'est d'ailleurs ainsi
// qu'on en parle en réunion. Demandé le 01/10/2026.
//
// ⚠ ON NE RACCOURCIT PAS UNE ENTITÉ. « AFD » n'a pas de prénom, et « MoF »
// réduit à « MoF » par hasard ne doit rien à la règle : les entités sont
// écartées explicitement, sinon un futur « Ministry of Finance » deviendrait
// « Ministry ».
//
// Le libellé COMPLET reste la valeur stockée et reste montré en infobulle :
// raccourcir est une affaire d'affichage, jamais de donnée.
//
// Pur, donc testé.
// ============================================================

import { isAssigneeEntity } from "./types";

/**
 * Le prénom seul, ou le libellé entier s'il n'y a pas lieu de le couper.
 *
 * Coupe à la PREMIÈRE espace, comme la séparation prénom / nom de la migration
 * 0036 : au-delà de « Prénom Nom », c'est le nom qui se compose en français
 * — « Da Silva », « Le Goff » — tandis qu'un prénom composé porte un trait
 * d'union.
 */
export function shortAssignee(label: string): string {
  const trimmed = label.trim();
  if (trimmed === "" || isAssigneeEntity(trimmed)) return trimmed;

  const space = trimmed.indexOf(" ");
  return space === -1 ? trimmed : trimmed.slice(0, space);
}

/**
 * Les prénoms seuls suffisent-ils à distinguer tout le monde ?
 *
 * Deux « Arben » affichés « Arben » désignent la même chose à l'écran et plus
 * rien dans la tête du lecteur. Quand c'est le cas, l'appelant écrit les
 * libellés entiers : mieux vaut une colonne large qu'une colonne fausse.
 */
export function hasAmbiguousFirstNames(labels: readonly string[]): boolean {
  const seen = new Map<string, string>();
  for (const label of labels) {
    const short = shortAssignee(label);
    const previous = seen.get(short.toLocaleLowerCase());
    if (previous !== undefined && previous !== label) return true;
    seen.set(short.toLocaleLowerCase(), label);
  }
  return false;
}
