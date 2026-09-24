import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ENTITY_COLOR } from "@/lib/tokens";
import { Section } from "@/components/ui/card";
import { SourceNote } from "@/components/referential/source-note";

interface Role {
  code: string;
  title: string;
  organisation: string;
  posts: number;
  timeType: string | null;
  holders: string[];
}

/**
 * Organigramme du projet.
 *
 * LA DISPOSITION suit le schéma d'organisation remis le 23/09/2026 : assistance
 * technique, comité de pilotage et maître d'ouvrage, bailleur, puis l'unité de
 * mise en œuvre (PIU) avec son coordinateur, ses spécialistes et les
 * représentants sur site.
 *
 * LES CASES sont les rôles fonctionnels DÉJÀ présents en base, et les noms qui
 * y figurent sont ceux des comptes ACTIFS qui occupent ces rôles. Rien n'est
 * créé à partir du schéma : un poste sans titulaire reste affiché « vacant ».
 * Les entités du schéma qui ne sont pas des rôles de la plateforme (comité,
 * co-maîtres d'ouvrage) n'apparaissent qu'en cadre de contexte, sans titulaire.
 *
 * DISPOSITION SANS BIBLIOTHÈQUE : une grille de 10 colonnes sans gouttière,
 * où chaque case en couvre deux. Les centres tombent ainsi sur des
 * pourcentages exacts (10 %, 30 %…) et les traits de liaison se placent en
 * absolu, DERRIÈRE les cases, sans calcul de coordonnées.
 */
export default async function OrgChartPage() {
  const { t } = await getI18n();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mg2030_functional_role")
    .select(
      `code, title, posts, time_type,
       mg2030_organisation!inner ( code ),
       mg2030_app_user ( full_name, is_active )`,
    );

  if (error) throw new Error(`Lecture de l'organigramme : ${error.message}`);

  const roles = new Map<string, Role>();
  for (const row of data ?? []) {
    const r = row as unknown as {
      code: string;
      title: string;
      posts: number;
      time_type: string | null;
      mg2030_organisation: { code: string };
      mg2030_app_user: { full_name: string; is_active: boolean }[];
    };
    roles.set(r.code, {
      code: r.code,
      title: r.title,
      organisation: r.mg2030_organisation.code,
      posts: r.posts,
      timeType: r.time_type,
      holders: (r.mg2030_app_user ?? [])
        .filter((u) => u.is_active)
        .map((u) => u.full_name)
        .sort((a, b) => a.localeCompare(b)),
    });
  }

  const labels = {
    vacant: t("org.vacant"),
    filled: (n: number, of: number) => t("org.filled", { n: String(n), of: String(of) }),
    time: (type: string | null) => (type ? t(`org.time_${type}`) : null),
  };

  const box = (code: string, className?: string) => {
    const role = roles.get(code);
    return role ? <RoleBox role={role} labels={labels} className={className} /> : null;
  };

  const vacantCount = [...roles.values()].filter((r) => r.holders.length === 0).length;
  const taColor = ENTITY_COLOR.TA;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Section title={t("org.title")} description={t("org.intro")}>
        <div className="overflow-x-auto">
          <div className="flex min-w-[1080px] flex-col gap-4 py-2">
            {/* ── Au-dessus du MYS : assistance technique, pilotage, bailleur ── */}
            <div className="grid grid-cols-10 items-start gap-y-4">
              <div className="col-span-3 pr-4">
                <div
                  className="rounded-lg border-2 border-dashed p-3"
                  style={{
                    borderColor: taColor,
                    backgroundColor: `color-mix(in srgb, ${taColor} 7%, var(--surface))`,
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: taColor }}>
                    {t("org.taTitle")}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{t("org.taNote")}</p>
                  {box("TA", "mt-2")}
                </div>
              </div>

              <div className="col-span-4 px-2">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text)]">
                    {t("org.steeringTitle")}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">{t("org.steeringMembers")}</p>
                  <div
                    className="mt-2 rounded-md px-3 py-2"
                    style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
                  >
                    <p className="text-sm font-bold">{t("org.ownerTitle")}</p>
                    <p className="text-[11px] opacity-90">{t("org.ownerNote")}</p>
                  </div>
                </div>
              </div>

              <div className="col-span-3 flex flex-col gap-3 pl-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text)]">
                    {t("org.coOwnersTitle")}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{t("org.coOwnerMesti")}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{t("org.coOwnerMunicipality")}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text)]">
                    {t("org.afdTitle")}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{t("org.afdNote")}</p>
                  {box("AFD", "mt-2")}
                </div>
              </div>
            </div>

            {/* ── Le MYS, qui héberge la PIU ─────────────────────────────── */}
            <div className="rounded-xl border-2 p-3" style={{ borderColor: "var(--accent)" }}>
              <p
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: "var(--accent)" }}
              >
                {t("org.mysLabel")}
              </p>

              <div
                className="rounded-lg border-2 border-dashed p-4"
                style={{ borderColor: "color-mix(in srgb, var(--accent) 55%, transparent)" }}
              >
                <p
                  className="mb-3 text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--accent)" }}
                >
                  {t("org.piuLabel")}
                </p>

                {/* Coordinateur, et à sa droite les représentants sur site,
                    reliés en pointillé : ils rendent compte sans être des
                    membres à temps plein de la PIU. */}
                <div className="relative grid grid-cols-10 items-center">
                  <div className="col-span-4 col-start-4 px-2">{box("COORD")}</div>
                  <div className="col-span-3 col-start-8 flex items-center pl-2">
                    <span
                      aria-hidden="true"
                      className="w-6 shrink-0 border-t-2 border-dashed"
                      style={{ borderColor: "var(--text-muted)" }}
                    />
                    <div className="min-w-0 flex-1">
                      {box("SITEREP")}
                      <p className="mt-1 text-[11px] italic text-[var(--text-muted)]">
                        {t("org.siteRepNote")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Traits : descente du coordinateur, barre horizontale, puis
                    une descente par case. Dessinés DERRIÈRE les cases. */}
                <div className="relative mt-3">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                    <Line style={{ left: "50%", top: -12, height: 12 }} />
                    <Line horizontal style={{ left: "10%", right: "10%", top: 0 }} />
                    {["10%", "30%", "50%", "70%", "90%"].map((x) => (
                      <Line key={x} style={{ left: x, top: 0, height: 24 }} />
                    ))}
                    {/* Colonne de la construction : spécialiste → adjoint. */}
                    <Line style={{ left: "10%", top: 0, bottom: 24 }} />
                    {/* Juriste, communication, comptable : dans les intervalles. */}
                    {["40%", "60%", "80%"].map((x) => (
                      <Line key={x} style={{ left: x, top: 0, bottom: 24 }} />
                    ))}
                  </div>

                  <div className="relative grid grid-cols-10 gap-y-6 pt-6">
                    <div className="col-span-2 px-2">{box("CONSTR", "h-full")}</div>
                    <div className="col-span-2 px-2">{box("PROC", "h-full")}</div>
                    <div className="col-span-2 px-2">{box("ADMFIN", "h-full")}</div>
                    <div className="col-span-2 px-2">{box("MRE", "h-full")}</div>
                    <div className="col-span-2 px-2">{box("ESHS", "h-full")}</div>

                    <div className="col-span-2 col-start-1 px-2">{box("CONSTR-DEP")}</div>
                    <div className="col-span-2 col-start-4 px-2">{box("LEGAL")}</div>
                    <div className="col-span-2 col-start-6 px-2">{box("COMM")}</div>
                    <div className="col-span-2 col-start-8 px-2">{box("ACCT")}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rôle technique de la plateforme, absent du schéma d'organisation
                mais porté par des comptes réels : on le montre à part. */}
            {roles.has("ADMIN") && (
              <div className="grid grid-cols-10">
                <div className="col-span-3 px-2">
                  <p className="mb-1 text-[11px] text-[var(--text-muted)]">{t("org.adminNote")}</p>
                  {box("ADMIN")}
                </div>
              </div>
            )}
          </div>
        </div>

        {vacantCount > 0 && <SourceNote>{t("org.unfilledNote")}</SourceNote>}
      </Section>
    </div>
  );
}

function Line({ style, horizontal = false }: { style: React.CSSProperties; horizontal?: boolean }) {
  return (
    <span
      className="absolute"
      style={{
        ...style,
        backgroundColor: "var(--text-muted)",
        ...(horizontal ? { height: 1 } : { width: 1 }),
      }}
    />
  );
}

/** Une case de poste : intitulé, régime, puis les titulaires — ou « vacant ». */
function RoleBox({
  role,
  labels,
  className,
}: {
  role: Role;
  labels: {
    vacant: string;
    filled: (n: number, of: number) => string;
    time: (type: string | null) => string | null;
  };
  className?: string;
}) {
  // Le coordinateur est la tête de la PIU : case sombre, comme au schéma.
  const lead = role.code === "COORD";
  const time = labels.time(role.timeType);

  return (
    <div
      className={
        "relative z-10 flex flex-col items-center rounded-lg border px-3 py-2 text-center " +
        (className ?? "")
      }
      style={
        lead
          ? { backgroundColor: "var(--text)", borderColor: "var(--text)", color: "var(--surface)" }
          : { backgroundColor: "var(--surface)", borderColor: "var(--border)" }
      }
    >
      <p className={lead ? "text-sm font-bold" : "text-[13px] font-medium text-[var(--text)]"}>
        {role.title}
      </p>
      {time && (
        <p
          className="text-[11px] italic"
          style={{ color: lead ? "var(--surface)" : "var(--text-muted)", opacity: lead ? 0.85 : 1 }}
        >
          {time}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap justify-center gap-1">
        {role.holders.length > 0 ? (
          role.holders.map((name) => (
            <span
              key={name}
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={
                lead
                  ? { backgroundColor: "var(--surface)", color: "var(--text)" }
                  : {
                      backgroundColor: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
                      color: "var(--accent)",
                    }
              }
            >
              {name}
            </span>
          ))
        ) : (
          <span
            className="text-[11px] italic"
            style={{ color: lead ? "var(--surface)" : "var(--text-muted)" }}
          >
            {labels.vacant}
          </span>
        )}
      </div>

      {/* Postes multiples (sites, AFD, TA) : combien sont pourvus. */}
      {role.posts > 1 && (
        <p className="mt-1 text-[10px] tabular-nums text-[var(--text-muted)]">
          {labels.filled(role.holders.length, role.posts)}
        </p>
      )}
    </div>
  );
}
