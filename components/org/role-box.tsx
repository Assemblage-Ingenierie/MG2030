"use client";

// ============================================================
// components/org/role-box.tsx — une case de l'organigramme, modifiable.
//
// ⚠ C'EST LA CASE QUI SAIT SI ON PEUT L'ÉDITER, pas la page. L'organigramme
// est rendu par le serveur ; le droit vit dans le contexte d'identité, qui est
// client. Lui passer un booléen depuis la page marcherait, mais obligerait
// chaque appel de `box()` à le transporter — et une fonction `children:
// (canEdit) => …` ne traverse pas la frontière serveur / client, comme la
// bibliothèque l'a appris à ses dépens.
//
// L'édition reste un CONFORT : la RLS décide (brief §8), et chaque action
// vérifie le nombre de lignes réellement écrites.
// ============================================================

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { PopoverPanel } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Gloss } from "@/components/acronyms/glossary";
import { EditIcon } from "@/components/ui/icons";
import { assignRoleHolder, updateRoleBox } from "@/app/(app)/org-chart/actions";
import { TIME_TYPES } from "@/lib/org/time-types";

export interface ChartRole {
  id: string;
  code: string;
  title: string;
  organisation: string;
  posts: number;
  timeType: string | null;
  holders: { id: string; name: string }[];
}

/** Un compte actif et le poste qu'il occupe aujourd'hui. */
export interface ChartPerson {
  id: string;
  name: string;
  roleTitle: string;
}

export function RoleBox({
  role,
  people,
  className,
}: {
  role: ChartRole;
  people: ChartPerson[];
  className?: string;
}) {
  const t = useT();
  const { isAdmin } = usePermissions();

  // Le coordinateur est la tête de la PIU : case sombre, comme au schéma.
  const lead = role.code === "COORD";
  const time = role.timeType ? t(`org.time_${role.timeType}`) : null;

  return (
    <div
      className={
        "group relative z-10 flex flex-col items-center rounded-lg border px-3 py-2 text-center " +
        (className ?? "")
      }
      style={
        lead
          ? { backgroundColor: "var(--text)", borderColor: "var(--text)", color: "var(--surface)" }
          : { backgroundColor: "var(--surface)", borderColor: "var(--border)" }
      }
    >
      {isAdmin && <EditRole role={role} lead={lead} />}

      <p className={lead ? "text-sm font-bold" : "text-[13px] font-medium text-[var(--text)]"}>
        <Gloss>{role.title}</Gloss>
      </p>
      {time && (
        <p
          className="text-[11px] italic"
          style={{ color: lead ? "var(--surface)" : "var(--text-muted)", opacity: lead ? 0.85 : 1 }}
        >
          {time}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
        {role.holders.length > 0 ? (
          role.holders.map((holder) => (
            <span
              key={holder.id}
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
              {holder.name}
            </span>
          ))
        ) : (
          <span
            className="text-[11px] italic"
            style={{ color: lead ? "var(--surface)" : "var(--text-muted)" }}
          >
            {t("org.vacant")}
          </span>
        )}

        {isAdmin && <AddHolder role={role} people={people} lead={lead} />}
      </div>

      {/* Postes multiples (sites, AFD, TA) : combien sont pourvus. */}
      {role.posts > 1 && (
        <p className="mt-1 text-[10px] tabular-nums text-[var(--text-muted)]">
          {t("org.filled", { n: String(role.holders.length), of: String(role.posts) })}
        </p>
      )}
    </div>
  );
}

/**
 * Intitulé, régime et nombre de postes.
 *
 * Dans un panneau et non en ligne : trois champs dans une case de cent
 * cinquante pixels de large la feraient enfler, et toutes les cases voisines
 * se décaleraient le temps de l'édition — l'organigramme se relit alors de
 * zéro à chaque correction.
 */
function EditRole({ role, lead }: { role: ChartRole; lead: boolean }) {
  const t = useT();
  const router = useRouter();
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(role.title);
  const [posts, setPosts] = useState(String(role.posts));
  const [timeType, setTimeType] = useState(role.timeType ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) first.current?.select();
  }, [open]);

  function submit() {
    setError(null);
    start(async () => {
      const result = await updateRoleBox(
        role.id,
        title,
        Number(posts),
        timeType === "" ? null : timeType,
      );
      if (!result.ok) {
        setError(t(`org.error_${result.error}`));
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {/* Au SURVOL seulement : quatorze crayons affichés en permanence
          transformeraient le schéma en barre d'outils. */}
      <button
        ref={setTrigger}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={t("org.editRole")}
        className="absolute right-1 top-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100 focus:opacity-100"
        style={{ color: lead ? "var(--surface)" : "var(--text-muted)" }}
      >
        <EditIcon className="h-3.5 w-3.5" />
      </button>

      <PopoverPanel anchor={trigger} open={open} onClose={() => setOpen(false)} width={280}>
        <div className="flex flex-col gap-2 p-3 text-left">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {t("org.roleTitle")}
            </span>
            <input
              ref={first}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--focus)]"
            />
          </label>

          <div className="flex gap-2">
            <label className="flex w-20 flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {t("org.posts")}
              </span>
              <input
                type="number"
                min={1}
                max={99}
                value={posts}
                onChange={(e) => setPosts(e.target.value)}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--focus)]"
              />
            </label>

            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {t("org.timeType")}
              </span>
              <select
                value={timeType}
                onChange={(e) => setTimeType(e.target.value)}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--focus)]"
              >
                <option value="">{t("org.timeUnset")}</option>
                {TIME_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`org.time_${value}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Le CODE est montré, et il ne s'édite pas : il tient la mise en
              page du schéma et les autorisations documentaires. */}
          <p className="text-[11px] text-[var(--text-muted)]">
            {t("org.codeFixed", { code: role.code })}
          </p>

          {error && (
            <p role="alert" className="text-xs" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" type="button" onClick={submit} disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </PopoverPanel>
    </>
  );
}

/**
 * Placer quelqu'un sur le poste.
 *
 * ⚠ ON DÉPLACE, ON NE RETIRE PAS — un compte tient toujours exactement un
 * poste (voir `assignRoleHolder`). La liste montre donc CHAQUE compte actif
 * avec sa fonction actuelle : ce qu'on fait ici, c'est un transfert, et le
 * cacher ferait disparaître des gens d'une autre case sans prévenir.
 */
function AddHolder({
  role,
  people,
  lead,
}: {
  role: ChartRole;
  people: ChartPerson[];
  lead: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const held = new Set(role.holders.map((h) => h.id));
  const available = people.filter((p) => !held.has(p.id));
  if (available.length === 0) return null;

  return (
    <>
      <button
        ref={setTrigger}
        type="button"
        disabled={pending}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={t("org.addHolder")}
        aria-label={t("org.addHolder")}
        className="flex h-5 w-5 items-center justify-center rounded-full border text-[13px] leading-none text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--app-bg)] group-hover:opacity-100 focus:opacity-100 disabled:opacity-40"
        style={{ borderColor: lead ? "var(--surface)" : "var(--border)" }}
      >
        +
      </button>

      <PopoverPanel anchor={trigger} open={open} onClose={() => setOpen(false)} width={240}>
        <p className="border-b border-[var(--border)] px-2 py-1.5 text-left text-[11px] text-[var(--text-muted)]">
          {t("org.addHolderHint")}
        </p>
        <div className="max-h-56 overflow-auto p-1">
          {available.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => {
                setOpen(false);
                start(async () => {
                  await assignRoleHolder(person.id, role.id);
                  router.refresh();
                });
              }}
              className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left hover:bg-[var(--app-bg)]"
            >
              <span className="text-xs font-medium text-[var(--text)]">{person.name}</span>
              <span className="text-[11px] text-[var(--text-muted)]">{person.roleTitle}</span>
            </button>
          ))}
        </div>
      </PopoverPanel>
    </>
  );
}
