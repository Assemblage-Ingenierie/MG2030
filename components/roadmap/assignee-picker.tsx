"use client";

// ============================================================
// components/roadmap/assignee-picker.tsx — à qui incombe l'action.
//
// Trois natures d'assignataire, et il faut les trois.
//
//   • UNE ENTITÉ — AFD, TA, PIU. « L'AFD doit envoyer le GEP » n'a pas de
//     destinataire nommé, et en inventer un serait faux.
//   • UN COMPTE — on coche la personne, on ne tape pas son nom. L'orthographe
//     cesse d'être une source de doublons, et le filtre de colonne retrouve
//     toutes ses actions.
//   • N'IMPORTE QUI D'AUTRE — le champ libre reste, et ce n'est pas une
//     commodité : la roadmap reprise du tableur porte « Alban », qui n'a pas de
//     compte, et « G8 », qui n'est ni une personne ni l'une des trois entités.
//     Une liste fermée les aurait perdus.
//
// Les libellés sont la donnée ; les cases ne font que les composer.
// ============================================================

import { useT } from "@/components/i18n/i18n-context";
import { cn } from "@/lib/cn";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/field";
import { ASSIGNEE_ENTITIES } from "@/lib/roadmap/types";

export interface PersonOption {
  id: string;
  fullName: string;
}

export function AssigneePicker({
  people,
  value,
  onChange,
}: {
  people: PersonOption[];
  value: string[];
  onChange: (labels: string[]) => void;
}) {
  const t = useT();

  const known = new Set<string>([
    ...ASSIGNEE_ENTITIES,
    ...people.map((p) => p.fullName),
  ]);
  // Tout ce que les cases ne savent pas représenter reste dans le champ libre,
  // pour qu'aucun libellé existant ne disparaisse en ouvrant le formulaire.
  const others = value.filter((v) => !known.has(v));

  const toggle = (label: string) =>
    onChange(
      value.includes(label) ? value.filter((v) => v !== label) : [...value, label],
    );

  const chip = (label: string, selected: boolean) => (
    <button
      key={label}
      type="button"
      onClick={() => toggle(label)}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors",
        selected
          ? "border-transparent text-[var(--on-accent)]"
          : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]",
      )}
      style={selected ? { backgroundColor: "var(--accent)" } : undefined}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <Label optionalText={t("common.optional")}>{t("roadmap.assignee")}</Label>

      <div className="flex flex-col gap-2 rounded-md border border-[var(--border)] p-2">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {t("roadmap.entities")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ASSIGNEE_ENTITIES.map((e) => chip(e, value.includes(e)))}
          </div>
        </div>

        {people.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {t("roadmap.people")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => chip(p.fullName, value.includes(p.fullName)))}
            </div>
          </div>
        )}

        <Field
          label={t("roadmap.otherAssignees")}
          optionalText={t("common.optional")}
          hint={t("roadmap.otherAssigneesHint")}
          value={others.join(", ")}
          onChange={(e) => {
            const typed = e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            // On recompose : les cases cochées d'abord, le libre ensuite.
            onChange([...value.filter((v) => known.has(v)), ...typed]);
          }}
        />
      </div>
    </div>
  );
}
