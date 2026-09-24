// ============================================================
// lib/fonts.ts — l'UNIQUE police téléchargée de l'application.
//
// Exception assumée à la règle « pas de webfont » (brief §4, UI_TOKENS §3),
// décidée le 23/09/2026 : elle ne sert QU'AU logotype « MG2030 » de la barre
// latérale. Tout le reste de l'interface garde la pile système.
//
// Big Shoulders (ex-« Big Shoulders Display », fusionnée par Google avec sa
// variante Text) : condensée, verticale, dans l'esprit du modernisme
// yougoslave de Pristina. L'axe `opsz` est chargé pour la pousser à 72, son
// dessin « Display » — à la taille par défaut (14), elle est plus large et
// perd son caractère.
//
// `next/font` télécharge le fichier AU BUILD et le sert depuis l'application :
// aucune requête vers Google au chargement d'une page.
// ============================================================

import { Big_Shoulders } from "next/font/google";

export const wordmarkFont = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});
