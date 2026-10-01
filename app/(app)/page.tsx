import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { loadDashboard, type DashboardTask, type TaskPhase } from "@/lib/queries/dashboard";
import { formatPlanDate } from "@/lib/i18n/format";
import { ROADMAP_PRIORITY, ROADMAP_STATUS } from "@/lib/tokens";
import { shortAssignee } from "@/lib/roadmap/assignee-label";
import { Card, Section } from "@/components/ui/card";
import { Gloss } from "@/components/acronyms/glossary";
import type { RoadmapStatus } from "@/lib/roadmap/types";

/**
 * TABLEAU DE BORD.
 *
 * Refondu le 01/10/2026. L'accueil alignait huit compteurs — 14 sites, 36
 * bâtiments, 9 marchés — qui ne bougent pas d'un trimestre sur l'autre : on
 * les lisait une fois, puis on passait devant sans les voir. Un écran d'accueil
 * qui n'apprend rien se contourne, et la plateforme commence au deuxième clic.
 *
 * Il répond maintenant à trois questions, dans l'ordre où on se les pose :
 *
 *   1. COMBIEN DE TEMPS RESTE-T-IL — l'échéance des Jeux, et avant elle le
 *      début de la marge terminale, qui est la vraie date de fin de travaux ;
 *   2. QU'EST-CE QUI SE PASSE — les tâches en retard, en cours, à démarrer, et
 *      les actions de la roadmap à échéance proche. NOMMÉES : un compteur
 *      « 3 en retard » oblige à ouvrir un autre écran pour savoir lesquelles ;
 *   3. QU'EST-CE QUI CLOCHE — les manques sur lesquels on peut agir. Rien ne
 *      s'affiche quand il n'y en a pas, et c'est le but.
 *
 * Les totaux du référentiel ferment la page, en une ligne : ils disent la
 * taille du programme, ce qui n'est pas rien, mais ce n'est pas l'actualité.
 *
 * ⚠ TOUT EST CLIQUABLE VERS L'ÉCRAN QUI PERMET D'AGIR. Un tableau de bord qui
 * ne mène nulle part est une affiche.
 */
export default async function HomePage() {
  const { t } = await getI18n();
  const d = await loadDashboard();

  const pct = d.tasksTotal === 0 ? 0 : Math.round((d.tasksDone / d.tasksTotal) * 100);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          {t("app.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("app.subtitle")}</p>
      </div>

      {/* ── 1. Le temps qui reste ──────────────────────────────────────── */}
      <Card className="flex flex-wrap items-center gap-x-12 gap-y-5 p-5">
        <Countdown
          label={t("home.deadline")}
          days={d.daysToDeadline}
          date={d.deadlineDate}
          note={t("home.deadlineNote")}
          accent="var(--accent)"
        />
        {/* ⚠ LA MARGE EST LA VRAIE ÉCHÉANCE. Les Jeux ouvrent le 1er janvier
            2030, mais les ouvrages doivent être livrés quatre mois plus tôt :
            c'est cette date-là qu'on doit avoir en tête, et elle n'était
            visible que sur l'écran du Plan. */}
        {d.bufferStartDate && (
          <Countdown
            label={t("home.bufferStart")}
            days={d.daysToBuffer}
            date={d.bufferStartDate}
            note={t("home.bufferNote", { months: String(d.bufferMonths ?? "—") })}
            accent="var(--accent-2)"
          />
        )}

        <span className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {t("home.planProgress")}
            </span>
            <span className="text-sm font-semibold tabular-nums text-[var(--text)]">
              {t("home.planProgressValue", {
                done: String(d.tasksDone),
                total: String(d.tasksTotal),
              })}
            </span>
          </span>
          {/* Une barre et non un camembert : on compare une position à 100 %,
              pas des parts entre elles. */}
          <span
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--border)" }}
            role="img"
            aria-label={t("home.planProgressValue", {
              done: String(d.tasksDone),
              total: String(d.tasksTotal),
            })}
          >
            <span
              className="block h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: "var(--accent)" }}
            />
          </span>
          <span className="flex gap-3 text-[11px] text-[var(--text-muted)]">
            <span>{t("home.running", { n: String(d.tasksRunning) })}</span>
            {d.tasksLate > 0 && (
              <span style={{ color: "var(--danger)" }}>
                {t("home.late", { n: String(d.tasksLate) })}
              </span>
            )}
          </span>
        </span>
      </Card>

      {/* ── 2. Ce qui se passe ─────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("home.focusTitle")} description={t("home.focusIntro")}>
          <Card className="divide-y divide-[var(--border)]">
            {d.focus.length === 0 && (
              <p className="p-4 text-sm text-[var(--text-muted)]">{t("home.focusEmpty")}</p>
            )}
            {d.focus.map((task) => (
              <FocusRow key={task.id} task={task} label={t(`home.phase_${task.phase}`)} />
            ))}
            {d.focusMore > 0 && (
              <Link
                href="/schedule"
                className="block px-3 py-2 text-xs font-medium hover:bg-[var(--app-bg)]"
                style={{ color: "var(--accent)" }}
              >
                {t("home.andMore", { n: String(d.focusMore) })}
              </Link>
            )}
          </Card>
        </Section>

        <Section title={t("home.roadmapTitle")} description={t("home.roadmapIntro")}>
          <Card className="divide-y divide-[var(--border)]">
            {d.actions.length === 0 && (
              <p className="p-4 text-sm text-[var(--text-muted)]">{t("home.roadmapEmpty")}</p>
            )}
            {d.actions.map((action) => (
              <Link
                key={action.id}
                href="/roadmap"
                className="flex flex-col gap-1 px-3 py-2 hover:bg-[var(--app-bg)]"
              >
                <span className="flex items-baseline gap-2">
                  <span
                    className="min-w-0 flex-1 text-sm font-medium text-[var(--text)]"
                    style={
                      action.priority === "urgent"
                        ? { color: ROADMAP_PRIORITY.urgent }
                        : undefined
                    }
                  >
                    <Gloss>{action.title}</Gloss>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                    {formatPlanDate(action.start)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-[11px]">
                  {action.status && (
                    <span
                      className="rounded px-1.5 py-0.5"
                      style={{
                        backgroundColor: ROADMAP_STATUS[action.status as RoadmapStatus].bg,
                        color: ROADMAP_STATUS[action.status as RoadmapStatus].fg,
                      }}
                    >
                      {t(`roadmap.status_${action.status}`)}
                    </span>
                  )}
                  <span className="text-[var(--text-muted)]">
                    {action.assignees.length === 0
                      ? t("roadmap.notSet")
                      : action.assignees.map(shortAssignee).join(", ")}
                  </span>
                </span>
              </Link>
            ))}
            {d.actionsMore > 0 && (
              <Link
                href="/roadmap"
                className="block px-3 py-2 text-xs font-medium hover:bg-[var(--app-bg)]"
                style={{ color: "var(--accent)" }}
              >
                {t("home.andMore", { n: String(d.actionsMore) })}
              </Link>
            )}
          </Card>
        </Section>
      </div>

      {/* ── 3. Ce qui cloche ───────────────────────────────────────────── */}
      {d.gaps.length > 0 && (
        <Section title={t("home.gapsTitle")} description={t("home.gapsIntro")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.gaps.map((gap) => (
              <Link
                key={gap.key}
                href={gap.href}
                className="flex flex-col gap-1 rounded-lg border bg-[var(--surface)] p-3 transition-colors hover:bg-[var(--app-bg)]"
                style={{ borderColor: "var(--accent-2)" }}
              >
                <span className="text-xl font-semibold tabular-nums text-[var(--text)]">
                  {gap.count}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {t(`home.gap_${gap.key}`)}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ── Le référentiel, en une ligne ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">
        <Count href="/sites" value={d.referential.sites} label={t("nav.sites")} />
        <Count href="/buildings" value={d.referential.buildings} label={t("nav.buildings")} />
        <Count href="/contracts" value={d.referential.contracts} label={t("nav.contracts")} />
        <Count href="/contracts" value={d.referential.lots} label={t("home.lots")} />
        <Count href="/library" value={d.referential.documents} label={t("nav.library")} />
        <Count href="/acronyms" value={d.referential.acronyms} label={t("nav.acronyms")} />
      </div>
    </div>
  );
}

/**
 * Un compte à rebours.
 *
 * Le NOMBRE DE JOURS d'abord, la date ensuite : personne ne calcule de tête
 * combien il reste avant janvier 2030.
 */
function Countdown({
  label,
  days,
  date,
  note,
  accent,
}: {
  label: string;
  days: number | null;
  date: string | null;
  note: string;
  accent: string;
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums" style={{ color: accent }}>
          {days === null ? "—" : days}
        </span>
        <span className="text-sm text-[var(--text-muted)]">{note}</span>
      </span>
      <span className="text-xs tabular-nums text-[var(--text-muted)]">
        {formatPlanDate(date)}
      </span>
    </span>
  );
}

/** Une tâche de la fenêtre : son état, son intitulé, ses dates, son porteur. */
function FocusRow({ task, label }: { task: DashboardTask; label: string }) {
  return (
    <Link
      href="/schedule"
      className="flex flex-col gap-1 px-3 py-2 hover:bg-[var(--app-bg)]"
    >
      <span className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: PHASE_COLOR[task.phase] }}
        />
        <span className="min-w-0 flex-1 text-sm font-medium text-[var(--text)]">
          <Gloss>{task.activity}</Gloss>
        </span>
        {/* LA DATE QUI COMPTE, et elle n'est pas la même selon l'état : pour
            une tâche qui n'a pas commencé, c'est son départ ; pour une tâche
            en cours ou en retard, c'est sa fin. Afficher toujours la fin
            donnait à lire « 23/10 » en face d'une tâche qui, elle, démarre
            dans trois jours. */}
        <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
          {formatPlanDate(task.phase === "soon" ? task.start : task.end)}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2 pl-4 text-[11px] text-[var(--text-muted)]">
        <span style={task.phase === "late" ? { color: "var(--danger)" } : undefined}>
          {label}
        </span>
        {task.contractCode && <span className="font-mono">{task.contractCode}</span>}
        {task.ownerName && <span>{task.ownerName}</span>}
      </span>
    </Link>
  );
}

/**
 * ⚠ LES MÊMES COULEURS QUE LE GANTT, et c'est délibéré : « en retard » doit
 * être le même rouge ici et sur le diagramme, sans quoi on lit deux codes
 * pour une même donnée d'un écran à l'autre.
 */
const PHASE_COLOR: Record<TaskPhase, string> = {
  late: "var(--danger)",
  running: "var(--accent-2)",
  soon: "var(--text-muted)",
  done: "var(--ok)",
};

function Count({ href, value, label }: { href: string; value: number; label: string }) {
  return (
    <Link href={href} className="hover:text-[var(--text)]">
      <span className="font-semibold tabular-nums text-[var(--text)]">{value}</span>{" "}
      {label}
    </Link>
  );
}
