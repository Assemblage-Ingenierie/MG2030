import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { Card, Section } from "@/components/ui/card";

/**
 * Accueil provisoire.
 *
 * Le tableau de bord consolidé est HORS PÉRIMÈTRE de la version 1 (brief §9).
 * Cette page annonce l'état d'avancement plutôt que de simuler un tableau de
 * bord qui n'existe pas.
 */

/** `id` sert à l'affichage, `labelKey` au dictionnaire — jamais de libellé ici. */
const LOTS: { id: string; labelKey: string; current?: boolean }[] = [
  { id: "1", labelKey: "home.lot1", current: true },
  { id: "2", labelKey: "home.lot2" },
  { id: "3", labelKey: "home.lot3" },
  { id: "4", labelKey: "home.lot4" },
  { id: "5–6", labelKey: "home.lot56" },
  { id: "7–8", labelKey: "home.lot78" },
  { id: "9–10", labelKey: "home.lot910" },
  { id: "11–13", labelKey: "home.lot1113" },
];

export default async function HomePage() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          {t("app.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("app.subtitle")}</p>
      </div>

      <Section title={t("home.progressTitle")} description={t("home.progressIntro")}>
        <Card className="divide-y divide-[var(--border)]">
          {LOTS.map((lot) => (
            <div key={lot.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-[var(--text-muted)]">
                {t("home.lot", { id: lot.id })}
              </span>
              <span
                className={
                  lot.current
                    ? "flex-1 text-sm font-medium text-[var(--text)]"
                    : "flex-1 text-sm text-[var(--text-muted)]"
                }
              >
                {t(lot.labelKey)}
              </span>
              {lot.current && (
                <span
                  className="rounded px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
                >
                  {t("home.inProgress")}
                </span>
              )}
            </div>
          ))}
        </Card>
      </Section>

      <Section title={t("demo.title")} description={t("home.designSystemIntro")}>
        <Link
          href="/design-system"
          className="inline-flex w-fit items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--app-bg)]"
        >
          {t("nav.designSystem")} →
        </Link>
      </Section>
    </div>
  );
}
