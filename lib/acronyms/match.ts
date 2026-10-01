// ============================================================
// lib/acronyms/match.ts — repérer les sigles dans un texte.
//
// Le glossaire existe (onglet Acronyms), mais il fallait aller l'ouvrir : le
// plan affiche « AFD's NOC on the REoI », la roadmap « ESMP du contractant »,
// et qui arrive sur le projet lisait cela sans rien comprendre. Demandé le
// 01/10/2026 — les sigles doivent se développer au survol, PARTOUT.
//
// Module PUR : il rend un découpage, pas du JSX. C'est ce qui le rend testable
// — et la règle de correspondance ci-dessous mérite de l'être.
// ============================================================

export interface Acronym {
  code: string;
  meaning: string;
}

export type Segment =
  | { text: string }
  | { text: string; meaning: string };

/**
 * ⚠ CORRESPONDANCE SENSIBLE À LA CASSE, À UNE TOLÉRANCE PRÈS.
 *
 * `TA` (Technical Assistance) est un sigle de deux lettres ; en ignorant la
 * casse, il surlignerait le « ta » de « total » et de « détail ». Une
 * correspondance strictement exacte, elle, raterait « REOI drafting » — le
 * glossaire écrit `REoI`, le plan de charge écrit `REOI`, et les deux
 * désignent la même chose.
 *
 * La règle retenue : le texte trouvé correspond s'il est IDENTIQUE au sigle,
 * ou s'il est TOUT EN CAPITALES et égal au sigle en capitales. « REOI » passe,
 * « Mou » et « ta » ne passent pas.
 *
 * S'y ajoutent deux garde-fous :
 *   • BORNES DE MOT — ni lettre ni chiffre avant et après, sans quoi `TA`
 *     s'allumerait au milieu de « TASK » ;
 *   • LE PLUS LONG D'ABORD, et le texte trouvé est consommé. Sans quoi
 *     `C-ESMP` se lirait « C- » suivi de `ESMP` : le tiret est une borne de
 *     mot, donc le sigle court y serait éligible.
 */
export function splitAcronyms(text: string, acronyms: Acronym[]): Segment[] {
  if (text === "" || acronyms.length === 0) return [{ text }];

  // Par longueur décroissante : c'est l'ordre d'essai à chaque position.
  const byLength = [...acronyms].sort((a, b) => b.code.length - a.code.length);

  const segments: Segment[] = [];
  let plain = "";
  let i = 0;

  while (i < text.length) {
    const match = startsAcronym(text, i, byLength);
    if (match === null) {
      plain += text[i];
      i += 1;
      continue;
    }
    if (plain !== "") {
      segments.push({ text: plain });
      plain = "";
    }
    segments.push({ text: text.slice(i, i + match.code.length), meaning: match.meaning });
    i += match.code.length;
  }

  if (plain !== "") segments.push({ text: plain });
  return segments;
}

/** Vrai si un sigle commence exactement à `at`, bornes de mot comprises. */
function startsAcronym(text: string, at: number, byLength: Acronym[]): Acronym | null {
  if (isWordChar(text[at - 1])) return null;

  for (const acronym of byLength) {
    const end = at + acronym.code.length;
    if (end > text.length) continue;
    if (isWordChar(text[end])) continue;

    const found = text.slice(at, end);
    if (found === acronym.code) return acronym;
    if (found === found.toUpperCase() && found.toUpperCase() === acronym.code.toUpperCase()) {
      return acronym;
    }
  }
  return null;
}

/**
 * Une lettre ou un chiffre — y compris accentuée : `\w` ne connaît que
 * l'ASCII, et « ESMP » collé à « é » n'est pas un sigle isolé.
 */
function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

/** Vrai si le texte contient au moins un sigle : évite un découpage inutile. */
export function hasAcronym(text: string, acronyms: Acronym[]): boolean {
  return splitAcronyms(text, acronyms).some((s) => "meaning" in s);
}
