// ============================================================
// lib/procurement/instantiate.ts — instanciation d'un gabarit de passation.
//
// « Créer un contrat instancie le gabarit et génère les tâches associées »
// (brief §7). Ce module est PUR : il calcule les tâches à créer, il ne les
// écrit pas. C'est ce qui permet de le tester, et de PRÉVISUALISER le résultat
// avant de l'appliquer — une génération de tâches qu'on découvre après coup
// est difficile à défaire.
// ============================================================

import { addDays } from "@/lib/schedule/dates";
import type { IsoDate } from "@/lib/schedule/types";

export interface TemplateStep {
  id: string;
  stepNo: number;
  name: string;
  defaultDurationDays: number;
  isAfdNoObjection: boolean;
  /** Recale l'étape sur un jalon contractuel connu, plutôt que sur l'enchaînement. */
  contractDateAnchor:
    | "spn_publication_date"
    | "bid_opening_date"
    | "signature_date"
    | "completion_date"
    | null;
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

  for (const step of ordered) {
    const anchor = step.contractDateAnchor ? anchors[step.contractDateAnchor] : null;

    // Une date contractuelle prime sur l'enchaînement : c'est elle qui figure
    // au document, et c'est elle que l'AFD lira.
    const start = anchor ?? cursor;
    const end = addDays(start, step.defaultDurationDays);
    const wbsCode = `${wbsPrefix}.${step.stepNo}`;

    tasks.push({
      wbsCode,
      activity: step.name,
      durationDays: step.defaultDurationDays,
      startDateInput: anchor,
      stepId: step.id,
      stepNo: step.stepNo,
      createsNoObjection: step.isAfdNoObjection,
      ownerRoleId: step.ownerRoleId,
      validatorRoleId: step.validatorRoleId,
      predecessorWbs: anchor ? null : previousWbs,
      previewStart: start,
      previewEnd: end,
    });

    cursor = end;
    previousWbs = wbsCode;
  }

  return tasks;
}

/**
 * Séquence OBSERVÉE dans le planning réel, proposée comme gabarit par défaut.
 *
 * ⚠ Ce n'est PAS une donnée projet : aucun gabarit n'existe dans `seed/`
 * (docs/GAPS.md point 10). Cette séquence est déduite des libellés de
 * `tasks.csv` et recoupée avec les sections 4 et 5 des Directives AFD de
 * février 2024. Elle doit être validée avant usage.
 *
 * Les libellés « TA + MYS validation » et « TA + MYS evaluation » désignent la
 * même nature d'étape dans le fichier source, et y sont employés
 * indifféremment : ils sont normalisés ici en un seul (GAPS 24).
 */
export const OBSERVED_SEQUENCE: Omit<TemplateStep, "id">[] = [
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
    name: "Bid or proposal preparation",
    defaultDurationDays: 56,
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
    stepNo: 7,
    name: "Execution",
    defaultDurationDays: 0,
    isAfdNoObjection: false,
    contractDateAnchor: "completion_date",
    ownerRoleId: null,
    validatorRoleId: null,
  },
];
