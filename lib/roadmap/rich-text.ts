// ============================================================
// lib/roadmap/rich-text.ts — un peu de mise en forme, sans HTML stocké.
//
// Le détail d'une action a besoin de gras, d'italique et de puces : « relancer
// le MoF — **avant le 12** — sur : le GEP, le budget, la liste des sites » se
// lit mal d'un seul tenant. Demandé le 01/10/2026.
//
// ⚠ ON STOCKE DU MARKDOWN, PAS DU HTML, et c'est une décision de sécurité
// autant que de modèle.
//
// Un éditeur qui enregistre du HTML oblige à le désinfecter à CHAQUE lecture,
// pour toujours, et une seule lecture oubliée suffit à injecter du script dans
// la session d'un autre. En stockant la source en texte, la base ne contient
// jamais de balise : c'est ce module, et lui seul, qui produit du rendu, et il
// n'émet QUE les éléments qu'il connaît. Tout le reste est échappé.
//
// Sous-ensemble volontairement étroit — ce n'est pas un traitement de texte :
//   **gras**   *italique*   `code`
//   - puces (une par ligne)
//   [libellé](https://…) — http et https seulement
//   un saut de ligne reste un saut de ligne
//
// Aucune dépendance : le même parti pris que le Gantt interne. Pur, donc testé.
// ============================================================

/** Nœuds du rendu. Le composant d'affichage ne connaît que ça. */
export type RichSpan =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type RichBlock =
  | { kind: "paragraph"; spans: RichSpan[] }
  | { kind: "list"; items: RichSpan[][] };

/**
 * Découpe le texte en blocs.
 *
 * Les lignes commençant par `- ` ou `* ` forment une liste ; les autres se
 * regroupent en paragraphes séparés par les lignes vides. Une ligne simple à
 * l'intérieur d'un paragraphe reste un saut de ligne, parce que c'est ainsi
 * qu'on écrit une note : on ne redouble pas la ligne vide comme en Markdown
 * canonique.
 */
export function parseRichText(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", spans: parseSpans(paragraph.join("\n")) });
    paragraph = [];
  };
  const flushList = () => {
    if (items.length === 0) return;
    blocks.push({ kind: "list", items: items.map(parseSpans) });
    items = [];
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);

    if (bullet) {
      flushParagraph();
      items.push(bullet[1]);
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();

  return blocks;
}

/**
 * Les marques d'une ligne.
 *
 * Une seule expression régulière pour les quatre formes, et la PREMIÈRE qui
 * s'applique gagne : sans cela `**gras**` se ferait mordre par la règle de
 * l'italique sur ses astérisques intérieurs.
 *
 * `code` est traité comme les autres et non en premier — le sous-ensemble ne
 * prétend pas gérer un bloc de code qui contiendrait des astérisques, et
 * prétendre le contraire vaudrait moins que de ne rien promettre.
 */
const MARK = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/;

function parseSpans(line: string): RichSpan[] {
  const spans: RichSpan[] = [];
  let rest = line;

  while (rest !== "") {
    const match = MARK.exec(rest);
    if (!match || match.index === undefined) break;

    if (match.index > 0) spans.push({ kind: "text", text: rest.slice(0, match.index) });

    const token = match[0];
    if (token.startsWith("**")) {
      spans.push({ kind: "bold", text: token.slice(2, -2) });
    } else if (token.startsWith("`")) {
      spans.push({ kind: "code", text: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const cut = token.indexOf("](");
      const text = token.slice(1, cut);
      const href = token.slice(cut + 2, -1);
      // ⚠ SEULEMENT http ET https. `javascript:` dans un lien exécuterait du
      // script au clic — c'est la faille que le stockage en texte évitait, on
      // ne la réintroduit pas ici. Une adresse refusée s'affiche telle quelle,
      // plutôt que de disparaître sans explication.
      if (isSafeHref(href)) spans.push({ kind: "link", text, href });
      else spans.push({ kind: "text", text: token });
    } else {
      spans.push({ kind: "italic", text: token.slice(1, -1) });
    }

    rest = rest.slice(match.index + token.length);
  }

  if (rest !== "") spans.push({ kind: "text", text: rest });
  return spans;
}

export function isSafeHref(href: string): boolean {
  const value = href.trim().toLowerCase();
  return value.startsWith("http://") || value.startsWith("https://");
}

/**
 * Le texte nu, marques retirées.
 *
 * Sert aux endroits qui ne savent pas afficher de mise en forme : l'export
 * Excel, l'infobulle, le tri. Mieux vaut y écrire la phrase que ses astérisques.
 */
export function richTextToPlain(source: string): string {
  return parseRichText(source)
    .map((block) =>
      block.kind === "paragraph"
        ? spansToPlain(block.spans)
        : block.items.map((spans) => `• ${spansToPlain(spans)}`).join("\n"),
    )
    .join("\n");
}

function spansToPlain(spans: RichSpan[]): string {
  return spans.map((s) => s.text).join("");
}

/** Insère une marque autour de la sélection. Rendu à l'éditeur, donc testé. */
export function applyMark(
  value: string,
  start: number,
  end: number,
  mark: "bold" | "italic" | "bullet",
): { value: string; start: number; end: number } {
  if (mark === "bullet") {
    // La puce s'applique à des LIGNES ENTIÈRES, pas à une sélection de mots :
    // on remonte donc au début de la première ligne touchée.
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEnd = value.indexOf("\n", end);
    const stop = lineEnd === -1 ? value.length : lineEnd;
    const lines = value.slice(lineStart, stop).split("\n");
    const allBulleted = lines.every((l) => /^\s*[-*]\s+/.test(l));
    const next = lines
      .map((l) => (allBulleted ? l.replace(/^\s*[-*]\s+/, "") : `- ${l}`))
      .join("\n");
    return {
      value: value.slice(0, lineStart) + next + value.slice(stop),
      start: lineStart,
      end: lineStart + next.length,
    };
  }

  const token = mark === "bold" ? "**" : "*";
  const selected = value.slice(start, end);

  // Déjà marqué : on retire, pour que le bouton serve de bascule.
  if (selected.startsWith(token) && selected.endsWith(token) && selected.length > token.length * 2) {
    const inner = selected.slice(token.length, -token.length);
    return {
      value: value.slice(0, start) + inner + value.slice(end),
      start,
      end: start + inner.length,
    };
  }

  const wrapped = `${token}${selected}${token}`;
  return {
    value: value.slice(0, start) + wrapped + value.slice(end),
    // Sélection vide : on place le curseur ENTRE les marques, prêt à écrire.
    start: start + token.length,
    end: start + token.length + selected.length,
  };
}
