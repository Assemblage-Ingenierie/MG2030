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
// aurait exigé de charger les documents de toute la bibliothèque pour n'en
// montrer trois.
//
// La frappe N'ENVOIE RIEN : on valide par Entrée ou par le bouton. Un envoi à
// chaque lettre ferait huit requêtes pour un mot de huit lettres, dont sept
// dont la réponse ne sera jamais lue.
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

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className="relative flex min-w-0 flex-1 items-center sm:max-w-sm"
    >
      <SearchIcon
        className="pointer-events-none absolute left-2.5 h-4 w-4 text-[var(--text-muted)]"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        /* `onSearch` n'existe pas partout ; la croix native d'un champ `search`
           vide la valeur sans soumettre. On rattrape le cas pour que l'effacer
           ramène vraiment la bibliothèque entière. */
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue("");
            go("");
          }
        }}
        placeholder={t("library.searchPlaceholder")}
        aria-label={t("library.searchPlaceholder")}
        className={cn(fieldClasses(), "pl-8")}
      />
    </form>
  );
}
