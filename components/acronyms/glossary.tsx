"use client";

// ============================================================
// components/acronyms/glossary.tsx — le glossaire, partout.
//
// ⚠ UN SEUL CHARGEMENT, DANS LE LAYOUT. Le glossaire est lu une fois par rendu
// de page et descend par le contexte : le faire lire par chaque composant qui
// affiche du texte vaudrait trente requêtes pour trente-deux lignes.
//
// `<abbr title>` plutôt qu'une infobulle maison : c'est l'élément HTML qui
// veut dire exactement cela, le navigateur l'affiche au survol sans une ligne
// de JavaScript, et un lecteur d'écran l'annonce. Une infobulle construite à
// la main aurait demandé un portail, une gestion du clavier et une position
// recalculée à chaque défilement — pour le même résultat.
// ============================================================

import { createContext, useContext, useMemo } from "react";
import { splitAcronyms, type Acronym } from "@/lib/acronyms/match";

const GlossaryContext = createContext<Acronym[]>([]);

export function GlossaryProvider({
  acronyms,
  children,
}: {
  acronyms: Acronym[];
  children: React.ReactNode;
}) {
  return <GlossaryContext.Provider value={acronyms}>{children}</GlossaryContext.Provider>;
}

export function useGlossary(): Acronym[] {
  return useContext(GlossaryContext);
}

/**
 * Un texte du projet, sigles développés au survol.
 *
 * S'emploie partout où s'affiche une chaîne VENUE DES DONNÉES — intitulé de
 * tâche, action de roadmap, nom de marché, titre de document. Jamais sur un
 * libellé d'interface : ceux-là sont écrits dans `messages/`, où l'on peut
 * simplement ne pas abréger.
 *
 * Rend le texte tel quel quand il ne porte aucun sigle, ce qui est le cas le
 * plus fréquent : aucun élément supplémentaire dans l'arbre, donc aucun effet
 * sur les mises en page existantes (troncature, `truncate`, alignements).
 */
export function Gloss({ children }: { children: string | null | undefined }) {
  const acronyms = useGlossary();
  const text = children ?? "";

  const segments = useMemo(() => splitAcronyms(text, acronyms), [text, acronyms]);

  if (segments.length === 1 && !("meaning" in segments[0])) return <>{text}</>;

  return (
    <>
      {segments.map((segment, i) =>
        "meaning" in segment ? (
          <abbr
            key={i}
            title={segment.meaning}
            /* Pointillé discret : sans repère visuel, personne ne pense à
               survoler. `no-underline` neutralise le soulignement plein que
               certains navigateurs appliquent encore à `<abbr>`. */
            className="cursor-help no-underline [text-decoration:underline_dotted] [text-underline-offset:2px]"
            style={{ textDecorationColor: "var(--text-muted)" }}
          >
            {segment.text}
          </abbr>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </>
  );
}
