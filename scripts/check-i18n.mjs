// ============================================================
// scripts/check-i18n.mjs — garde-fou de la règle du brief §6 :
// « Aucune chaîne de caractères en dur dès le premier composant. »
//
// Une règle qu'on ne vérifie pas se dégrade en trois semaines. Ce script échoue
// le build si un libellé visible apparaît en dur dans du JSX.
//
// Il vérifie DEUX choses :
//   1. les nœuds de texte JSX  →  <p>Bonjour</p>
//   2. les attributs porteurs de texte  →  title="Bonjour", placeholder="…"
//
// Usage : node scripts/check-i18n.mjs
// ============================================================

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCANNED = ["app", "components"];

/** Attributs dont la valeur est affichée à l'utilisateur. */
const TEXT_ATTRS = [
  "title",
  "label",
  "placeholder",
  "description",
  "hint",
  "aria-label",
  "alt",
  "optionalText",
  "emptyLabel",
  "addLabel",
];

/**
 * Ce qui n'est PAS un libellé traduisible et ne doit pas déclencher d'alerte :
 * noms propres, codes du projet, identifiants techniques, ponctuation.
 */
const ALLOWED = [
  /^[\s ·—–→←|/,.:;()[\]{}#%+*=<>-]*$/u, // ponctuation et espaces seuls
  /^[A-Z]{2,5}\d{0,4}$/, // sigles et codes : AFD, MG2030, EOI, NPC, IPC, QCBS
  /^MG2030$/,
  /^(MG|2030)$/, // les deux moitiés du bloc de marque
  /^(Card|PanelCard|Table|Badge|Button|Field|Chip)$/, // noms de composants cités
  /^--[a-z0-9-]+$/, // noms de tokens CSS
  /^#[0-9A-Fa-f]{3,8}$/, // valeurs hexadécimales
  /^\d+(\.\d+)?\s*(px|%|d|w)?$/, // dimensions et quantités
  /^(2xs|xs|sm|md|lg|xl|2xl|full)$/, // clés d'échelle
  /^[A-Z]{1,3}[-.][A-Z0-9.-]+$/, // codes du seed : TV.2.1, W-TV, DB-SC, SC-KON1
  /^(en|sq)$/, // codes de langue
  /^lib\/[a-z.\/-]+$/, // chemins de fichiers cités en documentation
  /^name@example\.org$/,
  /^Training venues works$/, // libellé de tâche issu du seed, non traduit (brief §6)
];

const isAllowed = (text) => ALLOWED.some((re) => re.test(text.trim()));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "node_modules" && !entry.startsWith(".")) walk(full, out);
    } else if (/\.tsx$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Retire commentaires de bloc et de ligne, pour ne pas les analyser. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const violations = [];

for (const file of SCANNED.flatMap((d) => walk(join(ROOT, d)))) {
  const raw = readFileSync(file, "utf8");
  const source = stripComments(raw);
  const rel = relative(ROOT, file).split(sep).join("/");

  const lineOf = (index) => source.slice(0, index).split("\n").length;

  // 1. Nœuds de texte JSX : entre « > » et « < », contenant au moins une lettre.
  //
  // La parenthèse négative écarte les « > » qui ne ferment PAS une balise :
  // la flèche d'une fonction (`=>`), une comparaison (`>=`, `<=`) ou un
  // générique. Sans elle, `useCallback(() => …)` serait pris pour du texte.
  // Le `>` qui ferme une balise JSX n'est jamais precede d'une ESPACE ni d'un
  // operateur : `<Th>`, `/>`. Celui d'une comparaison l'est toujours :
  // `count > 0`, `a => b`. C'est ce qui les distingue de facon fiable.
  for (const match of source.matchAll(/(?<![=!<>+*/\s-])>([^<>{}]*[\p{L}][^<>{}]*)</gu)) {
    const text = match[1].trim();
    // Un vrai libelle ne contient ni point-virgule, ni signe d'affectation, ni
    // parenthese : s'il y en a, la capture a mordu sur du code.
    if (!text || /[;=()]/.test(text) || isAllowed(text)) continue;
    violations.push({ file: rel, line: lineOf(match.index), kind: "texte JSX", text });
  }

  // 2. Attributs de texte à valeur littérale : title="…" plutôt que title={t("…")}.
  const attrPattern = new RegExp(`\\b(${TEXT_ATTRS.join("|")})=\\"([^\\"]+)\\"`, "g");
  for (const match of source.matchAll(attrPattern)) {
    const [, attr, text] = match;
    if (isAllowed(text)) continue;
    violations.push({
      file: rel,
      line: lineOf(match.index),
      kind: `attribut ${attr}`,
      text,
    });
  }
}

if (violations.length === 0) {
  console.log("i18n : aucune chaîne en dur détectée.");
  process.exit(0);
}

console.error(`i18n : ${violations.length} chaîne(s) en dur détectée(s).\n`);
console.error("Toute chaîne visible doit passer par messages/ (brief §6).\n");
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.kind}]  « ${v.text} »`);
}
console.error(
  "\nSi l'une de ces valeurs n'est PAS un libellé (code du seed, sigle, nom de\n" +
    "composant), ajoutez-la à ALLOWED dans scripts/check-i18n.mjs plutôt que de\n" +
    "désactiver la vérification.",
);
process.exit(1);
