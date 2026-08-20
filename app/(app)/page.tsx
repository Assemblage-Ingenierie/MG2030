import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { loadOverview } from "@/lib/queries/overview";
import { formatPlanDate } from "@/lib/i18n/format";
import { Card, Section } from "@/components/ui/card";
import { SourceNote } from "@/components/referential/source-note";

/**
 * Accueil.
 *
 * Le tableau de bord consolidé est HORS PÉRIMÈTRE de la version 1 (brief §9),
 * et cette page ne le simule pas. Elle donne les quelques nombres qu'on vient
 * chercher en ouvrant la plateforme, chacun cliquable vers son écran.
 *
 * Elle affichait auparavant l'état d'avancement du DÉVELOPPEMENT, lot par lot,
 * avec « lot 1 en cours ». C'était juste au premier jour et faux ensuite : la
 * PIU y lisait un état de projet là où figurait un plan de travail. Un écran
 * d'accueil qui se trompe sur ce qu'il montre est pire qu'un écran vide.
 *
 * L'ÉCHÉANCE DES JEUX EST EN PREMIER, parce qu'elle n'est pas négociable
 * (brief §2) et que tout le reste doit tenir dedans.
 */
export default async function HomePage() {
  const { t } = await getI18n();
  const o = await loadOverview();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          {t("app.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("app.subtitle")}</p>
      </div>

      {/* Le cadre calendaire. Une échéance non négociable se lit en haut. */}
      {o.deadlineDate && (
        <Card className="flex flex-wrap items-center gap-x-10 gap-y-4 p-4">
          <Countdown
            label={t("home.deadline")}
            date={formatPlanDate(o.deadlineDate)}
            days={o.daysToDeadline}
            note={t("home.deadlineNote")}
            urgent
          />
          {o.bufferStartDate && (
            <Countdown
              label={t("home.bufferStart")}
              date={formatPlanDate(o.bufferStartDate)}
              days={o.daysToBuffer}
              note={t("home.bufferNote")}
            />
          )}
          {o.scenarioName && (
            <span className="text-xs text-[var(--text-muted)]">
              {t("home.perScenario", { name: o.scenarioName })}
            </span>
          )}
        </Card>
      )}

      <Section title={t("home.stateTitle")} description={t("home.stateIntro")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile href="/schedule" label={t("nav.plan")} value={o.tasks} unit={t("home.tasks")} />
          <Tile
            href="/schedule?cols=all"
            label={t("home.unowned")}
            value={o.tasksWithoutOwner}
            unit={t("home.tasks")}
            /* Une tâche sans responsable ne peut recevoir aucune alerte de
               retard : c'est un manque, pas une statistique. */
            warn={o.tasksWithoutOwner > 0}
          />
          <Tile
            href="/deliverables"
            label={t("nav.deliverables")}
            value={o.deliverables}
            unit={t("home.records")}
          />
          <Tile
            href="/deliverables"
            label={t("home.lateDeliverables")}
            value={o.deliverablesLate}
            unit={t("home.records")}
            danger={o.deliverablesLate > 0}
          />
          <Tile
            href="/no-objections"
            label={t("home.awaitingNon")}
            value={o.noObjectionsAwaiting}
            unit={t("home.requests")}
            warn={o.noObjectionsAwaiting > 0}
          />
          <Tile href="/sites" label={t("nav.sites")} value={o.sites} unit={t("home.sites")} />
          <Tile
            href="/buildings"
            label={t("nav.buildings")}
            value={o.buildings}
            unit={t("home.buildings")}
          />
          <Tile
            href="/contracts"
            label={t("nav.contracts")}
            value={o.contracts}
            unit={t("home.contractsUnit", { lots: String(o.lots) })}
          />
        </div>

        {o.tasksWithoutOwner > 0 && (
          <SourceNote>
            {t("home.unownedNote", { count: String(o.tasksWithoutOwner) })}
          </SourceNote>
        )}
      </Section>
    </div>
  );
}

/**
 * Un compte à rebours.
 *
 * Le nombre de jours est plus parlant que la date : personne ne calcule de
 * tête combien il reste avant janvier 2030.
 */
function Countdown({
  label,
  date,
  days,
  note,
  urgent = false,
}: {
  label: string;
  date: string;
  days: number | null;
  note: string;
  urgent?: boolean;
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          className="text-2xl font-semibold tabular-nums"
          style={urgent ? { color: "var(--accent)" } : undefined}
        >
          {days === null ? "—" : days}
        </span>
        <span className="text-sm text-[var(--text-muted)]">{note}</span>
      </span>
      <span className="text-xs tabular-nums text-[var(--text-muted)]">{date}</span>
    </span>
  );
}

function Tile({
  href,
  label,
  value,
  unit,
  warn = false,
  danger = false,
}: {
  href: string;
  label: string;
  value: number;
  unit: string;
  warn?: boolean;
  danger?: boolean;
}) {
  const tone = danger ? "var(--danger)" : warn ? "var(--accent-2)" : undefined;
  return (
    <Link
      href={href}
      className={
        "flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] " +
        "p-3 transition-colors hover:bg-[var(--app-bg)]"
      }
    >
      <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span
          className="text-xl font-semibold tabular-nums"
          style={tone ? { color: tone } : undefined}
        >
          {value}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{unit}</span>
      </span>
    </Link>
  );
}
