"use client";

// ============================================================
// components/library/search-bar.tsx — retrouver un document par son nom.
//
// ⚠ ELLE CHERCHE DANS TOUTE LA BIBLIOTHÈQUE, pas dans le dossier ouvert. On ne
// cherche pas quand on sait où est le document : on cherche précisément quand
// on ne le sait plus. Restreindre au dossier courant aurait rendu la barre
// inutile dans le seul cas où elle sert.
//
// L'état vit dans l'URL (`?q=`) : la recherche se partage par un lien, survit
// au rechargement, et le serveur filtre — un filtrage dans le navigateur
// aurait exigé de charger toute la bibliothèque pour n'en montrer trois.
//
// La frappe N'ENVOIE RIEN : on valide par Entrée. Un envoi à chaque lettre
// ferait huit requêtes pour un mot de huit lettres, dont sept dont la réponse
// ne sera jamais lue.
//
// ⚠ ON SORT D'UNE RECHERCHE SANS DEVINER. Première version : seule la touche
// Échap ou l'effacement du champ ramenaient la bibliothèque, et rien ne le
// disait — « je ne peux pas revenir facilement à la vue », signalé le
// 01/10/2026. Trois sorties désormais, et toutes visibles : la croix du champ,
// le bouton de retour à côté, et la colonne des parties restée en place.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { SearchIcon } from "@/components/ui/icons";
import { fieldClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function LibrarySearch({ initial }: { initial: string }) {
  const t = useT();
  const router = useRouter();
  const [value, setValue] = useState(initial);

  function go(query: string) {
    const clean = query.trim();
    router.push(clean === "" ? "/library" : `/library?q=${encodeURIComponent(clean)}`);
  }

  /** `initial` est ce qui est RÉELLEMENT cherché ; `value` ce qui est tapé. */
  const searching = initial !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className="relative flex min-w-0 flex-1 items-center sm:max-w-sm"
      >
        <SearchIcon
          className="pointer-events-none absolute left-2.5 h-4 w-4"
          style={{ color: "var(--accent)" }}
          aria-hidden="true"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValue("");
              go("");
            }
          }}
          placeholder={t("library.searchPlaceholder")}
          aria-label={t("library.searchPlaceholder")}
          /* `type="text"` et non `search` : la croix native d'un champ de
             recherche vide la valeur SANS soumettre, si bien qu'on se
             retrouvait avec un champ vide devant des résultats toujours
             filtrés. La croix ci-dessous, elle, navigue. */
          className={cn(fieldClasses(), "pl-8", value !== "" && "pr-9")}
          /* Bleu nuit de la charte (08/10/2026) : sur le fond ivoire, un champ
             gris clair passait inaperçu. Bordure pleine et fond teinté. */
          style={{
            borderColor: "var(--accent)",
            borderWidth: 2,
            backgroundColor: "color-mix(in srgb, var(--accent) 7%, var(--surface))",
          }}
        />
        {value !== "" && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              go("");
            }}
            aria-label={t("library.clearSearch")}
            title={t("library.clearSearch")}
            className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--text)]"
          >
            ×
          </button>
        )}
      </form>

      {/* Le retour est ÉCRIT, pas seulement suggéré par une croix : une croix
          dans un champ se lit comme « effacer ma saisie », pas comme « quitter
          les résultats ». */}
      {searching && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            go("");
          }}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--app-bg)]"
        >
          {t("library.backToFolders")}
        </button>
      )}
    </div>
  );
}
