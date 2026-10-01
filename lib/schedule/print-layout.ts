// ============================================================
// lib/schedule/print-layout.ts — la géométrie du PAPIER.
//
// ⚠ C'EST LA LARGEUR DE LA FEUILLE QUI DICTE LA DENSITÉ, pas l'inverse.
//
// À l'écran, l'échelle (jour, semaine, mois) fixe le nombre de pixels par jour
// et le diagramme prend la largeur qu'il lui faut — on défile. Sur papier on ne
// défile pas : la largeur est donnée, et c'est à la densité de s'y plier. D'où
// une passe de calcul en deux temps, dans la page d'impression : on bâtit la
// mise en page une fois pour connaître l'étendue du plan, puis on la rebâtit
// avec le `pxPerDay` qui la fait tenir exactement.
//
// Les graduations restent celles de l'ÉCHELLE DEMANDÉE : resserrer un plan de
// trois ans ne doit pas transformer des mois en jours. Le tracé saute
// simplement les libellés qui ne tiennent plus (voir `TimeAxis`).
//
// Module PUR : aucune dépendance au DOM, donc testé.
// ============================================================

import { ROW_H } from "@/lib/gantt/layout";
import type { ScaleUnit } from "@/lib/gantt/scale";

export type Paper = "a4" | "a3";

export const PAPERS: Paper[] = ["a4", "a3"];

export const isPaper = (v: string): v is Paper => (PAPERS as string[]).includes(v);

/** 1 mm en pixels CSS, à 96 ppp — l'unité dans laquelle les SVG sont tracés. */
const PX_PER_MM = 96 / 25.4;

interface PaperSpec {
  /** Format CSS pour la règle `@page`. */
  css: string;
  /** Largeur et hauteur UTILES, en millimètres, marges déduites. */
  widthMm: number;
  heightMm: number;
  /** Largeur de la colonne des activités, en pixels. */
  nameWidth: number;
}

/**
 * Toujours EN PAYSAGE. Un Gantt en portrait perd un tiers de son axe de temps
 * pour gagner six lignes : le mauvais échange.
 *
 * Marges de 8 mm : en deçà, les imprimantes de bureau rognent.
 */
const PAPERS_SPEC: Record<Paper, PaperSpec> = {
  a4: { css: "A4 landscape", widthMm: 297 - 16, heightMm: 210 - 16, nameWidth: 250 },
  a3: { css: "A3 landscape", widthMm: 420 - 16, heightMm: 297 - 16, nameWidth: 310 },
};

/** Hauteur du bandeau de titre répété en tête de chaque feuille. */
export const SHEET_HEAD_H = 46;
/** Hauteur de l'échelle de temps, reprise de components/gantt/chart.tsx. */
const AXIS_H = 44;
/** Pied de page : « feuille 2 / 5 ». */
const SHEET_FOOT_H = 16;

export interface PrintGeometry {
  paper: Paper;
  /** Valeur de `size` pour la règle `@page`. */
  pageCss: string;
  pageWidth: number;
  pageHeight: number;
  nameWidth: number;
  /** Largeur offerte au diagramme. */
  chartWidth: number;
  /** Lignes par feuille. Au moins une, sinon la pagination boucle. */
  rowsPerSheet: number;
}

export function printGeometry(paper: Paper): PrintGeometry {
  const spec = PAPERS_SPEC[paper];
  const pageWidth = Math.floor(spec.widthMm * PX_PER_MM);
  const pageHeight = Math.floor(spec.heightMm * PX_PER_MM);

  return {
    paper,
    pageCss: spec.css,
    pageWidth,
    pageHeight,
    nameWidth: spec.nameWidth,
    chartWidth: Math.max(200, pageWidth - spec.nameWidth),
    rowsPerSheet: Math.max(
      1,
      Math.floor((pageHeight - SHEET_HEAD_H - AXIS_H - SHEET_FOOT_H) / ROW_H),
    ),
  };
}

/**
 * Les bornes de chaque feuille.
 *
 * Pagination EXPLICITE plutôt que confiée au navigateur : laissé à lui-même, il
 * coupe au milieu d'une ligne et le diagramme d'une feuille ne se rattache plus
 * à aucun libellé. Ici, chaque feuille porte son axe de temps et ses lignes
 * entières.
 */
export function paginate(rowCount: number, rowsPerSheet: number): { from: number; count: number }[] {
  // ⚠ `rowsPerSheet <= 0` BOUCLERAIT À L'INFINI, et ce n'est pas théorique :
  // la boucle ci-dessous avance de `rowsPerSheet`. Un rendu serveur bloqué
  // dans une boucle ne rend pas une page lente, il tue le processus — constaté
  // en écrivant le test. `printGeometry` planchonne déjà à 1, mais une fonction
  // exportée se défend seule.
  if (rowCount <= 0 || rowsPerSheet <= 0) return [];
  const sheets: { from: number; count: number }[] = [];
  for (let from = 0; from < rowCount; from += rowsPerSheet) {
    sheets.push({ from, count: Math.min(rowsPerSheet, rowCount - from) });
  }
  return sheets;
}

/**
 * Densité qui fait tenir le plan dans la largeur offerte.
 *
 * `measuredWidth` est la largeur qu'a prise une première mise en page avec
 * `measuredPxPerDay`. Le rapport des deux donne la densité cherchée — on évite
 * ainsi de recalculer soi-même l'étendue du plan, que `buildLayout` connaît
 * déjà et dont le calcul (contraintes, marge terminale, échéance) n'a pas à
 * exister en double.
 */
export function fitPxPerDay(
  measuredWidth: number,
  measuredPxPerDay: number,
  targetWidth: number,
): number {
  if (measuredWidth <= 0) return measuredPxPerDay;
  // On ne DILATE pas un plan court jusqu'au bord de la feuille : trois tâches
  // sur deux semaines s'étaleraient sur quarante centimètres, ce qui se lit
  // moins bien, pas mieux.
  if (measuredWidth <= targetWidth) return measuredPxPerDay;
  return (measuredPxPerDay * targetWidth) / measuredWidth;
}

/**
 * Jours couverts par une graduation, approximativement. Il ne s'agit pas de
 * dater quoi que ce soit — seulement de savoir si un libellé tiendra.
 */
const TICK_DAYS: Record<ScaleUnit, number> = {
  day: 1,
  week: 7,
  month: 30.4,
  quarter: 91.3,
};

/**
 * Largeur minimale d'une graduation pour qu'elle porte son libellé.
 * Même seuil que `TimeAxis`, qui saute les libellés sous 24 px — avec deux
 * pixels de marge, pour ne pas obtenir une échelle à moitié écrite.
 */
const MIN_TICK_PX = 26;

const SCALE_ORDER: ScaleUnit[] = ["day", "week", "month", "quarter"];

/**
 * L'échelle réellement imprimable, à cette densité.
 *
 * ⚠ UN AXE DE TEMPS MUET REND LE DIAGRAMME ILLISIBLE. Resserré pour tenir sur
 * une feuille, un plan de trois ans donne des mois larges de vingt-et-un
 * pixels : `TimeAxis` saute alors tous les libellés, et l'échelle s'imprime en
 * bandeau bleu nuit sans un chiffre. Constaté à l'écran le 01/10/2026.
 *
 * On ÉLARGIT seulement, jamais l'inverse : qui demande des trimestres les
 * garde, même s'il y avait la place pour des mois — c'est son choix de lecture,
 * pas une contrainte de place. Et la page dit l'échelle qu'elle a retenue : un
 * planning qui change d'unité sans le dire ment sur ce qu'il montre.
 */
export function fitScale(requested: ScaleUnit, pxPerDay: number): ScaleUnit {
  const from = SCALE_ORDER.indexOf(requested);
  for (let i = Math.max(0, from); i < SCALE_ORDER.length; i += 1) {
    if (TICK_DAYS[SCALE_ORDER[i]] * pxPerDay >= MIN_TICK_PX) return SCALE_ORDER[i];
  }
  return "quarter";
}
