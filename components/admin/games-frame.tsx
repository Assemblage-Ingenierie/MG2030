"use client";

// ============================================================
// components/admin/games-frame.tsx — l'échéance des Jeux et la marge.
//
// Deux champs, un bouton, et le début de marge affiché EN LECTURE SEULE : il
// se déduit des deux autres (voir `lib/schedule/buffer.ts`). Le montrer quand
// même est tout l'intérêt de l'écran — on règle une échéance et un nombre de
// mois, et on vérifie du regard la date à laquelle il faudra avoir fini.
//
// Pas d'enregistrement automatique, contrairement aux interrupteurs d'onglets
// voisins : une date se corrige en plusieurs frappes, et écrire à chaque
// touche enregistrerait trois dates fausses avant la bonne.
// ============================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatPlanDate } from "@/lib/i18n/format";
import { bufferStartFrom } from "@/lib/schedule/buffer";
import { setGamesFrame } from "@/app/(app)/settings/actions";

export function GamesFrame({
  deadline,
  bufferMonths,
}: {
  deadline: string | null;
  bufferMonths: number | null;
}) {
  const t = useT();
  const router = useRouter();
  const [date, setDate] = useState(deadline ?? "");
  const [months, setMonths] = useState(String(bufferMonths ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const monthsNumber = Number(months);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    months.trim() !== "" &&
    Number.isInteger(monthsNumber) &&
    monthsNumber >= 0 &&
    monthsNumber <= 36;

  // Le début de marge suit la saisie EN DIRECT : c'est la seule façon de voir
  // ce qu'on décide avant de l'enregistrer.
  const preview = valid ? bufferStartFrom(date, monthsNumber) : null;
  const dirty = date !== (deadline ?? "") || monthsNumber !== (bufferMonths ?? 0);

  function submit() {
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await setGamesFrame(date, monthsNumber);
      if (!result.ok) {
        setError(t(`settings.error_${result.error}`));
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <Field
          label={t("settings.deadline")}
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSaved(false);
          }}
          className="w-48"
        />

        <Field
          label={t("settings.bufferMonths")}
          type="number"
          min={0}
          max={36}
          value={months}
          onChange={(e) => {
            setMonths(e.target.value);
            setSaved(false);
          }}
          className="w-36"
        />

        <span className="flex flex-col gap-0.5 pb-2.5">
          <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {t("settings.bufferStart")}
          </span>
          <span className="text-sm font-semibold tabular-nums text-[var(--text)]">
            {preview ? formatPlanDate(preview) : "—"}
          </span>
        </span>

        <Button
          type="button"
          onClick={submit}
          disabled={!valid || !dirty || pending}
          className="mb-1"
        >
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {saved && !dirty && (
        <p className="text-sm" style={{ color: "var(--ok)" }}>
          {t("settings.frameSaved")}
        </p>
      )}
    </div>
  );
}
