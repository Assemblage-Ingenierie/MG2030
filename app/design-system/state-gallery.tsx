"use client";

// ============================================================
// Galerie interactive des primitives, dans leurs six états.
// Client Component : survol, focus clavier et saisie ne se démontrent pas côté
// serveur. Le reste de la page reste en Server Component.
// ============================================================

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Card, PanelCard, Section } from "@/components/ui/card";
import { CheckIcon, SearchIcon } from "@/components/ui/icons";

export function StateGallery() {
  const t = useT();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  // Erreur volontairement déclenchée par un champ vide : c'est le cas le plus
  // fréquent dans un formulaire de saisie rapide.
  const error = touched && value.trim() === "" ? t("errors.fieldRequired") : undefined;

  return (
    <>
      <Section
        title={t("demo.buttons")}
        description={t("demo.buttonsIntro")}
      >
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">{t("common.save")}</Button>
            <Button variant="secondary">{t("common.cancel")}</Button>
            <Button variant="quiet">{t("common.filter")}</Button>
            <Button variant="danger">{t("common.delete")}</Button>
            <IconButton label={t("common.search")}>
              <SearchIcon className="h-4 w-4" />
            </IconButton>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
            <StateLabel>{t("demo.disabled")}</StateLabel>
            <Button variant="primary" disabled>
              {t("common.save")}
            </Button>
            <Button variant="secondary" disabled>
              {t("common.cancel")}
            </Button>
            <Button variant="quiet" disabled>
              {t("common.filter")}
            </Button>
            <Button variant="danger" disabled>
              {t("common.delete")}
            </Button>
            <IconButton label={t("common.search")} disabled>
              <SearchIcon className="h-4 w-4" />
            </IconButton>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
            <StateLabel>{t("demo.loading")}</StateLabel>
            <Button variant="primary" disabled>
              {t("common.saving")}
            </Button>
            <span className="text-xs text-[var(--text-muted)]">
              {t("demo.loadingNote")}
            </span>
          </div>

          <p className="border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">
            {t("demo.hoverHint")} · {t("demo.focusHint")}
          </p>
        </Card>
      </Section>

      <Section
        title={t("demo.fields")}
        description={t("demo.fieldsIntro")}
      >
        <Card className="grid gap-5 p-4 sm:grid-cols-2">
          <Field
            label={t("auth.email")}
            type="email"
            placeholder="name@example.org"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            error={error}
            hint={t("demo.fieldErrorHint")}
          />

          <Field
            label={t("common.search")}
            optionalText={t("common.optional")}
            placeholder={t("common.search")}
          />

          <Field label={t("common.edit")} defaultValue="TV.3.2" disabled />

          <div>
            <Label>{t("demo.cellLabel")}</Label>
            <input
              className={`mt-1 ${fieldClasses({ focusStyle: "border" })}`}
              defaultValue="TV.2.7"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t("demo.cellNote")}</p>
          </div>
        </Card>
      </Section>

      <Section
        title={t("demo.containers")}
        description={t("demo.containersIntro")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Card</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t("demo.cardNote")}</p>
          </Card>

          <PanelCard>
            <h3 className="text-sm font-semibold text-[var(--text)]">PanelCard</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t("demo.panelNote")}</p>
            <p className="mt-3 flex items-center gap-1.5 text-sm" style={{ color: "var(--ok)" }}>
              <CheckIcon className="h-4 w-4" />
              {t("demo.okNoteLong")}
            </p>
          </PanelCard>
        </div>
      </Section>
    </>
  );
}

function StateLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-[var(--text-muted)]">
      {children}
    </span>
  );
}
