"use client";

// ============================================================
// components/schedule/print-button.tsx — ouvre la boîte d'impression.
//
// Pas d'« export PDF » maison : le navigateur sait déjà écrire un PDF, il
// connaît les formats de papier et les imprimantes installées, et le résultat
// reste du TEXTE sélectionnable plutôt qu'une image. Produire le PDF nous-mêmes
// aurait voulu dire embarquer une bibliothèque de rendu et réécrire le Gantt
// une troisième fois.
// ============================================================

import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  const t = useT();
  return (
    <Button variant="primary" size="sm" onClick={() => window.print()}>
      {t("gantt.printNow")}
    </Button>
  );
}
