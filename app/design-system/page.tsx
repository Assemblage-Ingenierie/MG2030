import { getI18n, getMessages, countKeys, DICTIONARIES } from "@/lib/i18n/server";
import { BRAND, FONT_SIZE, RADIUS, STATUS, UI } from "@/lib/tokens";
import {
  formatAmount,
  formatAmountRange,
  formatDuration,
  formatPlanDate,
} from "@/lib/i18n/format";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge, Chip } from "@/components/ui/badge";
import { StateGallery } from "./state-gallery";

/**
 * Revue de charte. C'est le critère de fin du lot 1 : chaque primitive y figure
 * dans ses états, et l'état de l'internationalisation y est mesuré.
 *
 * Cette page suit la même règle que les écrans métier — AUCUNE chaîne en dur,
 * y compris dans les textes explicatifs. Une page de démonstration qui trichait
 * sur la règle qu'elle est censée démontrer ne vaudrait rien.
 *
 * Server Component : seule la galerie interactive est un Client Component.
 */
export default async function DesignSystemPage() {
  const { t, locale } = await getI18n();
  const { messages } = await getMessages();

  const enKeys = countKeys(DICTIONARIES.en);
  const localeKeys = countKeys(messages);
  const coverage = enKeys === 0 ? 0 : Math.round((localeKeys / enKeys) * 100);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          {t("demo.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{t("demo.intro")}</p>
      </div>

      {/* ── Tokens ─────────────────────────────────────────────────────── */}
      <Section title={t("demo.tokens")} description={t("demo.tokensIntro")}>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">
            {t("demo.brandPalette")}
          </h3>
          <div className="flex flex-wrap gap-3">
            <Swatch value={BRAND.blue} name="--accent" note={t("demo.accentNote")} />
            <Swatch value={BRAND.gold} name="--accent-2" note={t("demo.accent2Note")} />
            <Swatch value={UI.danger} name="--danger" note={t("demo.dangerNote")} />
            <Swatch value={UI.ok} name="--ok" note={t("demo.okNote")} />
            <Swatch value={UI.focus} name="--focus" note={t("demo.focusNote")} />
          </div>

          <h3 className="mb-3 mt-6 text-sm font-semibold text-[var(--text)]">
            {t("demo.surfaces")}
          </h3>
          <div className="flex flex-wrap gap-3">
            <Swatch value={UI.appBg} name="--app-bg" />
            <Swatch value={UI.surface} name="--surface" />
            <Swatch value={UI.border} name="--border" />
            <Swatch value={UI.text} name="--text" />
            <Swatch value={UI.textMuted} name="--text-muted" />
            <Swatch value={UI.sidebarBg} name="--sidebar-bg" />
          </div>

          <h3 className="mb-3 mt-6 text-sm font-semibold text-[var(--text)]">
            {t("demo.typeAndRadius")}
          </h3>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            {Object.entries(FONT_SIZE).map(([key, size]) => (
              <span key={key} style={{ fontSize: size }} className="text-[var(--text)]">
                {key} <span className="text-[var(--text-muted)]">({size})</span>
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {Object.entries(RADIUS)
              .filter(([key]) => key !== "full")
              .map(([key, radius]) => (
                <span key={key} className="flex flex-col items-center gap-1">
                  <span
                    className="block h-10 w-10 border border-[var(--border)] bg-[var(--app-bg)]"
                    style={{ borderRadius: radius }}
                  />
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {key} · {radius}
                  </span>
                </span>
              ))}
          </div>
        </Card>
      </Section>

      {/* ── Primitives et états (interactif) ───────────────────────────── */}
      <StateGallery />

      {/* ── États métier ──────────────────────────────────────────────── */}
      <Section title={t("demo.statuses")} description={t("demo.statusesIntro")}>
        <Card className="flex flex-wrap items-center gap-3 p-4">
          {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((tone) => (
            <Badge key={tone} tone={tone}>
              {t(`status.${tone}`)}
            </Badge>
          ))}
          <Chip>W-TV</Chip>
          <Chip>DB-SC</Chip>
        </Card>
      </Section>

      {/* ── Tableau ───────────────────────────────────────────────────── */}
      <Section title={t("demo.tables")} description={t("demo.tablesIntro")}>
        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("demo.code")}</Th>
              <Th>{t("demo.activity")}</Th>
              <Th align="right">{t("demo.start")}</Th>
              <Th align="right">{t("demo.duration")}</Th>
              <Th align="right">{t("demo.end")}</Th>
            </Thead>
            <tbody>
              {/* Données réelles du seed : TV.2.1 est à 20 jours après la
                  décision GAPS 12, pas 21. */}
              <Tr>
                <Td className="font-medium">TV.2.1</Td>
                <Td>EOI</Td>
                <Td align="right" className="tabular-nums">
                  {formatPlanDate("2026-09-01")}
                </Td>
                <Td align="right" className="tabular-nums">
                  {formatDuration(20, locale)}
                </Td>
                <Td align="right" className="tabular-nums">
                  {formatPlanDate("2026-09-21")}
                </Td>
              </Tr>
              <Tr>
                <Td className="font-medium">TV.3.2</Td>
                <Td>Training venues works</Td>
                <Td align="right" className="tabular-nums">
                  {formatPlanDate("2027-11-11")}
                </Td>
                <Td align="right" className="tabular-nums">
                  {formatDuration(448, locale)}
                </Td>
                <Td align="right" className="tabular-nums">
                  {formatPlanDate("2029-02-01")}
                </Td>
              </Tr>
            </tbody>
          </Table>
        </Card>

        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("demo.code")}</Th>
              <Th>{t("demo.activity")}</Th>
            </Thead>
            <tbody>
              <EmptyRow colSpan={2}>{t("common.empty")}</EmptyRow>
            </tbody>
          </Table>
        </Card>
      </Section>

      {/* ── Formats ───────────────────────────────────────────────────── */}
      <Section title={t("demo.formats")} description={t("demo.formatsIntro")}>
        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("demo.case")}</Th>
              <Th>{t("demo.rendering")}</Th>
              <Th>{t("demo.why")}</Th>
            </Thead>
            <tbody>
              <Tr>
                <Td>{t("demo.planDate")}</Td>
                <Td className="tabular-nums">{formatPlanDate("2029-05-29")}</Td>
                <Td className="text-[var(--text-muted)]">{t("demo.planDateWhy")}</Td>
              </Tr>
              <Tr>
                <Td>{t("demo.amount")}</Td>
                <Td className="tabular-nums">{formatAmount(44_400_000, locale)}</Td>
                <Td className="text-[var(--text-muted)]">{t("demo.amountWhy")}</Td>
              </Tr>
              <Tr>
                <Td>{t("demo.range")}</Td>
                <Td className="tabular-nums">
                  {formatAmountRange(1_000_000, 2_000_000, locale)}
                </Td>
                <Td className="text-[var(--text-muted)]">{t("demo.rangeWhy")}</Td>
              </Tr>
              <Tr>
                <Td>{t("demo.duration")}</Td>
                <Td className="tabular-nums">{formatDuration(822, locale)}</Td>
                <Td className="text-[var(--text-muted)]">{t("demo.durationWhy")}</Td>
              </Tr>
              <Tr>
                <Td>{t("demo.missing")}</Td>
                <Td>{formatPlanDate(null)}</Td>
                <Td className="text-[var(--text-muted)]">{t("demo.missingWhy")}</Td>
              </Tr>
            </tbody>
          </Table>
        </Card>
      </Section>

      {/* ── État de l'internationalisation ─────────────────────────────── */}
      <Section title={t("demo.i18nTitle")} description={t("demo.i18nIntro")}>
        <Card className="p-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat label={t("demo.activeLocale")} value={locale} />
            <Stat label={t("demo.englishKeys")} value={String(enKeys)} />
            <Stat label={t("demo.coverage")} value={`${coverage}%`} />
          </dl>
          {coverage < 100 && (
            <p className="mt-4 rounded-md bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--text-muted)]">
              {t("common.fallbackNotice")} {t("demo.fallbackExplain")}
            </p>
          )}
        </Card>
      </Section>
    </div>
  );
}

function Swatch({ value, name, note }: { value: string; name: string; note?: string }) {
  return (
    <div className="flex w-40 flex-col gap-1">
      <span
        className="block h-12 w-full rounded-md border border-[var(--border)]"
        style={{ backgroundColor: value }}
      />
      <code className="text-[11px] font-medium text-[var(--text)]">{name}</code>
      <code className="text-[11px] uppercase text-[var(--text-muted)]">{value}</code>
      {note && <span className="text-[11px] text-[var(--text-muted)]">{note}</span>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--text)]">{value}</dd>
    </div>
  );
}
