// ============================================================
// lib/r2/content-disposition.ts — encodage RFC 3986 et en-tête
// Content-Disposition.
//
// SÉPARÉ de presign.ts, qui est `server-only` (il manie les secrets R2). Ces
// fonctions ne touchent ni secret ni variable d'environnement — les isoler
// ici les rend TESTABLES : `server-only` lève une erreur dès qu'on l'importe
// hors d'un composant serveur, y compris depuis un test.
// ============================================================

/**
 * Encodage d'URI conforme à SigV4 et à RFC 5987 (`filename*=`).
 *
 * `encodeURIComponent` laisse passer `!'()*`, que les deux spécifications
 * exigent d'encoder. Une signature calculée sur un chemin différemment
 * encodé est rejetée sans explication utile : d'où ce complément.
 */
export function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

const isAsciiPrintable = (code: number): boolean => code >= 0x20 && code <= 0x7e;

/**
 * En-tête `Content-Disposition` pour une réponse R2, nom de fichier compris.
 *
 * ⚠ ASSAINI CONTRE L'INJECTION D'EN-TÊTE. `filename` vient de
 * `original_filename`, saisi par qui dépose le document — un retour chariot
 * ou un guillemet non échappé pourrait sinon injecter un en-tête HTTP
 * arbitraire dans la réponse. Le filtrage se fait caractère par caractère,
 * sans expression régulière, pour ne dépendre d'aucun jeu de contrôle
 * particulier.
 *
 * Deux formes dans le même en-tête (RFC 6266) : `filename=` porte un repli
 * ASCII pour les clients qui ignorent l'UTF-8, `filename*=` porte le nom
 * exact, encodé — utile dès qu'un document porte un nom en albanais.
 */
export function contentDisposition(type: "inline" | "attachment", filename: string): string {
  let clean = "";
  for (const ch of filename) {
    const code = ch.codePointAt(0) ?? 0;
    // Retours chariot et saut de ligne : seuls caractères capables d'injecter
    // un en-tête HTTP supplémentaire dans la réponse. Remplacés par une
    // espace plutôt que supprimés, pour ne pas coller deux mots.
    clean += code === 13 || code === 10 ? " " : ch;
  }
  clean = clean.trim();

  let asciiFallback = "";
  for (const ch of clean) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '"') asciiFallback += "'";
    else asciiFallback += isAsciiPrintable(code) ? ch : "_";
  }

  const encoded = encodeRfc3986(clean);
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
