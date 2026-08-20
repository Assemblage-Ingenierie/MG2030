// ============================================================
// lib/procurement/instantiate.ts — instanciation d'un gabarit de passation.
//
// « Créer un contrat instancie le gabarit et génère les tâches associées »
// (brief §7). Ce module est PUR : il calcule les tâches à créer, il ne les
// écrit pas. C'est ce qui permet de le tester, et de PRÉVISUALISER le résultat
// avant de l'appliquer — une génération de tâches qu'on découvre après coup
// est difficile à défaire.
// ============================================================

import { addDays, daysBetween } from "@/lib/schedule/dates";
import type { IsoDate } from "@/lib/schedule/types";

export type ContractDateAnchor =
  | "spn_publication_date"
  | "bid_opening_date"
  | "signature_date"
  | "completion_date";

/**
 * Un jalon contractuel cale-t-il le DÉBUT ou la FIN de l'étape ?
 *
 * C'est une propriété du jalon, pas un réglage par étape — d'où la table
 * plutôt qu'une colonne. Un avis d'appel public déclenche une période : il en
 * marque le début. Une ouverture des plis, une signature, un achèvement sont
 * des événements TERMINAUX : la préparation des offres finit à l'ouverture, la
 * négociation finit à la signature.
 *
 * Sans cette distinction, une étape ancrée sur la signature commençait à la
 * signature — la négociation démarrait donc le jour où le marché était déjà
 * signé, ce qui produisait un planning incohérent d'apparence crédible.
 */
export const ANCHOR_MODE: Record<ContractDateAnchor, "start" | "end"> = {
  spn_publication_date: "start",
  bid_opening_date: "end",
  signature_date: "end",
  completion_date: "end",
};

export interface TemplateStep {
  id: string;
  stepNo: number;
  name: string;
  defaultDurationDays: number;
  isAfdNoObjection: boolean;
  /** Recale l'étape sur un jalon contractuel connu, plutôt que sur l'enchaînement. */
  contractDateAnchor: ContractDateAnchor | null;
  ownerRoleId: string | null;
  validatorRoleId: string | null;
}

export interface ContractAnchors {
  spn_publication_date: IsoDate | null;
  bid_opening_date: IsoDate | null;
  signature_date: IsoDate | null;
  completion_date: IsoDate | null;
}

export interface GeneratedTask {
  wbsCode: string;
  activity: string;
  durationDays: number;
  /** Ancre imposée par un jalon contractuel. `null` = enchaînée au précédent. */
  startDateInput: IsoDate | null;
  stepId: string;
  stepNo: number;
  createsNoObjection: boolean;
  ownerRoleId: string | null;
  validatorRoleId: string | null;
  /** Étape précédente, pour la précédence fin-début. */
  predecessorWbs: string | null;
  /** Date attendue, à titre de prévisualisation. Le moteur recalculera. */
  previewStart: IsoDate;
  previewEnd: IsoDate;
  /**
   * Jours de CHEVAUCHEMENT entre l'ancre contractuelle et la fin de l'étape
   * précédente. Zéro si aucun conflit.
   *
   * Ce n'est pas une anomalie du calcul mais un ÉCART ENTRE DEUX DOCUMENTS :
   * le plan de passation et le planning ne concordent pas partout (GAPS 13).
   * L'ancre fait foi — c'est le document contractuel — mais l'écart doit être
   * montré, jamais absorbé en silence.
   */
  conflictDays: number;
  /** Jours de BATTEMENT laissé par l'ancre. Zéro si aucun. */
  slackDays: number;
}

/**
 * Développe un gabarit en tâches, sans rien écrire.
 *
 * Les étapes s'enchaînent en fin-début. Une étape portant un jalon contractuel
 * est ANCRÉE sur la date du marché : le plan de passation fait foi, et le
 * gabarit ne doit pas dériver par rapport à lui.
 *
 * @param wbsPrefix préfixe des codes générés, en général le code du marché.
 */
export function instantiateTemplate(options: {
  steps: TemplateStep[];
  anchors: ContractAnchors;
  wbsPrefix: string;
  fallbackStart: IsoDate;
}): GeneratedTask[] {
  const { steps, anchors, wbsPrefix, fallbackStart } = options;

  const ordered = [...steps].sort((a, b) => a.stepNo - b.stepNo);
  const tasks: GeneratedTask[] = [];

  let cursor: IsoDate = fallbackStart;
  let previousWbs: string | null = null;
  let hasPrevious = false;

  for (const step of ordered) {
    const anchorKind = step.contractDateAnchor;
    const anchorDate = anchorKind ? anchors[anchorKind] : null;

    // Une date contractuelle prime sur l'enchaînement : c'est elle qui figure
    // au document, et c'est elle que l'AFD lira.
    let start: IsoDate;
    if (anchorDate === null) {
      start = cursor;
    } else if (ANCHOR_MODE[anchorKind!] === "end") {
      start = addDays(anchorDate, -step.defaultDurationDays);
    } else {
      start = anchorDate;
    }

    const end = addDays(start, step.defaultDurationDays);
    const wbsCode = `${wbsPrefix}.${step.stepNo}`;

    // Écart avec l'enchaînement : négatif = chevauchement, positif = battement.
    const drift = anchorDate === null || !hasPrevious ? 0 : daysBetween(cursor, start);

    tasks.push({
      wbsCode,
      activity: step.name,
      durationDays: step.defaultDurationDays,
      startDateInput: anchorDate === null ? null : start,
      stepId: step.id,
      stepNo: step.stepNo,
      createsNoObjection: step.isAfdNoObjection,
      ownerRoleId: step.ownerRoleId,
      validatorRoleId: step.validatorRoleId,
      predecessorWbs: anchorDate ? null : previousWbs,
      previewStart: start,
      previewEnd: end,
      conflictDays: drift < 0 ? -drift : 0,
      slackDays: drift > 0 ? drift : 0,
    });

    cursor = end;
    previousWbs = wbsCode;
    hasPrevious = true;
  }

  return tasks;
}

/**
 * Séquence OBSERVÉE pour une sélection de consultant (REOI).
 *
 * ⚠ Ce n'est PAS une donnée projet : aucun gabarit n'existe dans `seed/`
 * (docs/GAPS.md point 10). Les durées sont RELEVÉES sur la chaîne réelle de
 * C-TV-DD au planning — TV.2.1 à TV.2.6 — et non estimées :
 *
 *     EOI 21 · TA+MYS 14 · NoN AFD 10 · offres 42 · TA+MYS 14 · négociation 28
 *
 * Les libellés « TA + MYS validation » et « TA + MYS evaluation » désignent la
 * même nature d'étape dans le fichier source et y sont employés
 * indifféremment : normalisés ici en un seul (GAPS 24).
 */
export const OBSERVED_CONSULTANT_SEQUENCE: Omit<TemplateStep, "id">[] = [
  {
    stepNo: 1,
    name: "Expression of interest / specific procurement notice",
    defaultDurationDays: 21,
    isAfdNoObjection: false,
    contractDateAnchor: "spn_publication_date",
    ownerRoleId: null,
    validatorRoleId: null,
  },
  {
    stepNo: 2,
    name: "TA and MYS review",
    defaultDurationDays: 14,
    isAfdNoObjection: false,
    contractDateAnchor: null,
    ownerRoleId: null,
    validatorRoleId: null,
  },
  {
    stepNo: 3,
    name: "AFD no-objection",
    defaultDurationDays: 10,
    isAfdNoObjection: true,
    contractDateAnchor: null,
    ownerRoleId: null,
    validatorRoleId: null,
  },
  {
    stepNo: 4,
    name: "Proposal preparation",
    defaultDurationDays: 42,
    isAfdNoObjection: false,
    contractDateAnchor: "bid_opening_date",
    ownerRoleId: null,
    validatorRoleId: null,
  },
  {
    stepNo: 5,
    name: "TA and MYS review",
    defaultDurationDays: 14,
    isAfdNoObjection: false,
    contractDateAnchor: null,
    ownerRoleId: null,
    validatorRoleId: null,
  },
  {
    stepNo: 6,
    name: "Negotiation and AFD no-objection",
    defaultDurationDays: 28,
    isAfdNoObjection: true,
    contractDateAnchor: "signature_date",
    ownerRoleId: null,
    validatorRoleId: null,
  },
  {
    // Durée nulle : c'est un JALON d'achèvement, pas l'exécution elle-même.
    // La durée d'exécution dépend du marché (210 jours d'études pour C-TV-DD,
    // 448 jours de travaux pour W-TV) et n'a pas sa place dans un gabarit.
    stepNo: 7,
    name: "Completion",
    defaultDurationDays: 0,
    isAfdNoObjection: false,
    contractDateAnchor: "completion_date",
    ownerRoleId: null,
    validatorRoleId: null,
  },
];

/**
 * Séquence OBSERVÉE pour un appel d'offres de travaux ou de fournitures (IB).
 *
 * Relevée sur TV.3.1 au planning : pas de manifestation d'intérêt ni d'avis
 * AFD préalable — l'appel est ouvert. L'avis AFD est joint à la négociation.
 *
 *     appel d'offres 56 · TA+MYS 14 · NoN AFD + négociation 28
 */
export const OBSERVED_WORKS_SEQUENCE: Omit<TemplateStep, "id">[] = [
  {
    stepNo: 1,
    name: "Call for bids",
    defaultDurationDays: 56,
    isAfdNoObjection: false,
    contractDateAnchor: "spn_publication_date",
    ownerRoleId: null,
    validatorRoleId: null,
  },
  {
    stepNo: 2,
    name: "TA and MYS evaluation",
    defaultDurationDays: 14,
    isAfdNoObjection: false,
    contractDateAnchor: null,
    ownerRoleId: null,
    validatorRoleId: null,
  },
  {
    stepNo: 3,
    name: "AFD no-objection and contract negotiation",
    defaultDurationDays: 28,
    isAfdNoObjection: true,
    contractDateAnchor: "signature_date",
    ownerRoleId: null,
    validatorRoleId: null,
  },
  {
    stepNo: 4,
    name: "Completion",
    defaultDurationDays: 0,
    isAfdNoObjection: false,
    contractDateAnchor: "completion_date",
    ownerRoleId: null,
    validatorRoleId: null,
  },
];
