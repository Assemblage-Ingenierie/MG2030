"use client";

// ============================================================
// components/ui/popover.tsx — un panneau flottant qu'aucun parent ne rogne.
//
// ⚠ POURQUOI UN PORTAIL, ET NON UN SIMPLE `absolute`.
//
// `Table` enveloppe ses tableaux dans `overflow-x-auto`, pour que les colonnes
// puissent défiler sur petit écran. Or dès qu'un axe est contraint, CSS force
// l'autre à `auto` : le conteneur rogne donc aussi EN HAUTEUR. Un menu posé en
// `absolute` sous un en-tête se trouvait coupé net dès que le tableau était
// court — signalé le 01/10/2026, capture à l'appui : avec trois lignes, la
// liste des assignataires était tranchée au milieu.
//
// Remonter le menu dans `document.body` le soustrait à tous les `overflow` de
// ses ancêtres. En contrepartie il faut le positionner soi-même, en
// coordonnées de fenêtre (`fixed`), et le refermer quand la page défile — un
// panneau ancré visuellement à un bouton qui a bougé ment sur ce qu'il
// commande.
// ============================================================

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/** Marge minimale au bord de la fenêtre : un panneau collé au bord se lit mal. */
const EDGE = 8;

export function PopoverPanel({
  anchor,
  open,
  onClose,
  align = "left",
  width = 224,
  className,
  children,
}: {
  /** L'élément sous lequel s'ancrer. */
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  align?: "left" | "right";
  width?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(
    null,
  );

  // `useLayoutEffect` : positionner AVANT la peinture, sinon le panneau
  // apparaît une image en haut à gauche puis saute à sa place.
  useLayoutEffect(() => {
    if (!open || !anchor) return;

    const place = () => {
      const r = anchor.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - EDGE;
      const above = r.top - EDGE;
      // On s'ouvre vers le bas, sauf s'il y a franchement plus de place en
      // haut : un menu qui déborde sous le pli oblige à faire défiler pour
      // voir ses propres options.
      const up = below < 160 && above > below;

      let left = align === "right" ? r.right - width : r.left;
      left = Math.min(Math.max(EDGE, left), window.innerWidth - width - EDGE);

      setPos({
        top: up ? Math.max(EDGE, r.top - Math.min(above, 320)) : r.bottom + 4,
        left,
        maxHeight: Math.max(120, up ? above : below),
      });
    };

    place();
    // Au défilement comme au redimensionnement, on referme plutôt que de
    // suivre : suivre demanderait de recalculer à chaque image, pour un
    // panneau qu'on vient d'ouvrir et qu'on ferme en un geste.
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [open, anchor, align, width, onClose]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Le déclencheur est exclu : sinon le clic qui ferme serait suivi du
      // clic qui rouvre, et le panneau clignoterait sans jamais se fermer.
      if (panel.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, anchor, onClose]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width,
        maxHeight: pos.maxHeight,
      }}
      className={cn(
        "z-50 overflow-auto rounded-md border border-[var(--border)]",
        "bg-[var(--surface)] shadow-lg",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
