"use client";

// ============================================================
// components/schedule/board-cell.tsx — une cellule de la grille.
//
// ⚠ L'ÉTAT DE SAISIE EST LOCAL À LA CELLULE, et c'est le point important.
//
// La version précédente gardait le brouillon dans le composant parent : chaque
// frappe redessinait les 27 lignes. Avec le diagramme sur la même page, cela
// redessinait aussi le SVG à chaque caractère — la lenteur que l'utilisateur a
// signalée. Ici, taper ne re-rend QUE la cellule active.
//
// Clavier, repris du patron tableur (docs/UI_TOKENS.md §6) :
//   Entrée → valide et descend · Tab → valide et va à droite
//   Échap  → annule et rend la valeur d'origine
// ============================================================

import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type CommitDirection = "down" | "right" | "none";

export interface CellProps {
  /** Valeur affichée en lecture. */
  display: React.ReactNode;
  /** Valeur brute mise dans le champ à l'entrée en édition. */
  raw: string;
  editable: boolean;
  active: boolean;
  width: number;
  align?: "left" | "right";
  inputMode?: "numeric" | "decimal" | "text";
  type?: "text" | "date";
  title?: string;
  onActivate: () => void;
  /** `null` = annulation. */
  onCommit: (value: string | null, direction: CommitDirection) => void;
  /** Rendu à la place du champ : sélecteur, par exemple. */
  renderEditor?: (helpers: {
    close: (direction: CommitDirection) => void;
  }) => React.ReactNode;
}

export const BoardCell = memo(function BoardCell({
  display,
  raw,
  editable,
  active,
  width,
  align = "left",
  inputMode,
  type = "text",
  title,
  onActivate,
  onCommit,
  renderEditor,
}: CellProps) {
  const [draft, setDraft] = useState(raw);
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // À l'activation, on repart de la valeur courante et on sélectionne tout :
  // remplacer est le geste le plus fréquent, corriger vient après.
  useEffect(() => {
    if (!active) return;
    setDraft(raw);
    const frame = requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.select();
        return;
      }
      // Éditeur personnalisé : on met le focus sur son premier élément
      // focalisable, quel qu'il soit.
      editorRef.current
        ?.querySelector<HTMLElement>("select, input, button, textarea, [tabindex]")
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
    // `raw` volontairement hors dépendances : un re-rendu du parent pendant la
    // saisie ne doit pas écraser ce que l'utilisateur est en train de taper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // `shrink-0` est INDISPENSABLE : la ligne est un conteneur flex, et sans lui
  // une cellule de trop faisait rétrécir toutes les autres — la grille ne
  // s'alignait alors plus sur son propre en-tête.
  const base = "shrink-0 border-r border-b border-[var(--border)] text-sm";

  if (active && renderEditor) {
    return (
      /**
       * L'éditeur fourni par l'appelant — un sélecteur, en pratique.
       *
       * Le focus est donné ICI, explicitement, et non laissé à `autoFocus`.
       * Constaté en production : le sélecteur s'ouvrait SANS focus, donc ni
       * Échap ni la sortie au clavier ne le fermaient — un clic malencontreux
       * sur la cellule « responsable » laissait la liste ouverte pour de bon.
       *
       * `onKeyDown` et `onBlur` sont doublés au niveau du conteneur : même un
       * éditeur qui oublierait de les gérer reste refermable. Une cellule dont
       * on ne peut pas sortir est pire qu'une cellule non éditable.
       */
      <div
        ref={editorRef}
        className={cn(base, "bg-[var(--surface)] px-1")}
        style={{ width }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCommit(null, "none");
          }
        }}
        onBlur={(event) => {
          // Le focus reste-t-il dans l'éditeur ? Un sélecteur natif déclenche
          // un blur en s'ouvrant sur certains navigateurs : sans ce test, la
          // liste se refermait avant qu'on puisse choisir.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            onCommit(null, "none");
          }
        }}
      >
        {renderEditor({ close: (direction) => onCommit(null, direction) })}
      </div>
    );
  }

  if (active) {
    return (
      <div className={cn(base, "p-0.5")} style={{ width }}>
        <input
          ref={inputRef}
          value={draft}
          type={type}
          inputMode={inputMode}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCommit(null, "none");
            } else if (e.key === "Enter") {
              e.preventDefault();
              onCommit(draft, "down");
            } else if (e.key === "Tab") {
              e.preventDefault();
              onCommit(draft, "right");
            }
          }}
          onBlur={() => onCommit(draft, "none")}
          className={cn(
            "block h-full w-full rounded-sm border bg-[var(--surface)] px-1.5 text-sm outline-none",
            align === "right" && "text-right tabular-nums",
          )}
          style={{ borderColor: "var(--focus)" }}
        />
      </div>
    );
  }

  if (!editable) {
    return (
      <div
        className={cn(base, "flex items-center px-2", align === "right" && "justify-end")}
        style={{ width }}
        title={title}
      >
        <span className="truncate">{display}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      onFocus={onActivate}
      title={title}
      className={cn(
        base,
        "flex cursor-text items-center px-2 text-left transition-colors hover:bg-[var(--app-bg)]",
        align === "right" && "justify-end",
      )}
      style={{ width }}
    >
      <span className="truncate">{display}</span>
    </button>
  );
});
