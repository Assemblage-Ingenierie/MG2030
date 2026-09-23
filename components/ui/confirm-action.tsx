"use client";

// ============================================================
// components/ui/confirm-action.tsx — confirmation d'un geste destructif,
// DANS la page.
//
// Remplace `window.confirm`. Certains navigateurs embarqués (dont le panneau
// navigateur de Claude) ne l'affichent jamais et répondent « non » d'office :
// le bouton de suppression semblait alors ne rien faire, sans message.
// Une confirmation rendue par l'application fonctionne partout.
//
// Premier clic : le déclencheur cède la place à la question et à deux
// boutons. Échap ou « Annuler » reviennent à l'état initial.
// ============================================================

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "./button";

export function ConfirmAction({
  message,
  onConfirm,
  children,
  disabled = false,
}: {
  /** La question posée, déjà traduite. */
  message: string;
  onConfirm: () => void;
  /** Le déclencheur, qui reçoit la fonction à appeler au premier clic. */
  children: (arm: () => void) => React.ReactNode;
  disabled?: boolean;
}) {
  const t = useT();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setArmed(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [armed]);

  if (!armed) return <>{children(() => setArmed(true))}</>;

  return (
    <span role="alertdialog" aria-label={message} className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs" style={{ color: "var(--danger)" }}>
        {message}
      </span>
      <Button
        variant="danger"
        size="sm"
        type="button"
        disabled={disabled}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {t("common.delete")}
      </Button>
      <Button variant="secondary" size="sm" type="button" onClick={() => setArmed(false)}>
        {t("common.cancel")}
      </Button>
    </span>
  );
}
