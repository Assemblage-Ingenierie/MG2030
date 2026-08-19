import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { Card, Section } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { SourceNote } from "@/components/referential/source-note";

interface Node {
  id: string;
  code: string;
  title: string;
  organisation: string;
  accessMode: string;
  posts: number;
  timeType: string | null;
  levelOfEffort: string | null;
  parentId: string | null;
  reportsToExternal: string | null;
  supervisesNote: string | null;
  sortOrder: number;
  holders: string[];
}

/**
 * Organigramme PIU.
 *
 * Le seed ne contient aucune unité au-delà des postes eux-mêmes : l'arbre est
 * donc un arbre de POSTES, relié par `reports_to` (docs/GAPS.md point 28).
 * Le Project Coordinator reporte à un supérieur hiérarchique MYS « to be
 * specified » : hors périmètre applicatif, affiché en mention.
 */
export default async function OrgChartPage() {
  const { t } = await getI18n();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mg2030_org_unit")
    .select(
      `id, code, parent_id, reports_to_external, supervises_note, sort_order,
       mg2030_functional_role!inner (
         title, posts, time_type, level_of_effort,
         mg2030_organisation!inner ( code, access_mode ),
         mg2030_app_user ( full_name )
       )`,
    )
    .order("sort_order");

  if (error) throw new Error(`Lecture de l'organigramme : ${error.message}`);

  const nodes: Node[] = (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown> & {
      mg2030_functional_role: {
        title: string;
        posts: number;
        time_type: string | null;
        level_of_effort: string | null;
        mg2030_organisation: { code: string; access_mode: string };
        mg2030_app_user: { full_name: string }[];
      };
    };
    const role = r.mg2030_functional_role;
    return {
      id: r.id as string,
      code: r.code as string,
      title: role.title,
      organisation: role.mg2030_organisation.code,
      accessMode: role.mg2030_organisation.access_mode,
      posts: role.posts,
      timeType: role.time_type,
      levelOfEffort: role.level_of_effort,
      parentId: (r.parent_id as string) ?? null,
      reportsToExternal: (r.reports_to_external as string) ?? null,
      supervisesNote: (r.supervises_note as string) ?? null,
      sortOrder: r.sort_order as number,
      holders: (role.mg2030_app_user ?? []).map((u) => u.full_name),
    };
  });

  const childrenOf = new Map<string | null, Node[]>();
  for (const node of nodes) {
    const list = childrenOf.get(node.parentId);
    if (list) list.push(node);
    else childrenOf.set(node.parentId, [node]);
  }

  const roots = (childrenOf.get(null) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
  const unfilled = nodes.filter((n) => n.holders.length === 0).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Section title={t("org.title")} description={t("org.intro")}>
        <Card className="p-4">
          <ul className="flex flex-col gap-1">
            {roots.map((node) => (
              <OrgNode
                key={node.id}
                node={node}
                childrenOf={childrenOf}
                depth={0}
                labels={{
                  posts: t("org.posts"),
                  vacant: t("org.vacant"),
                  readOnly: t("org.readOnly"),
                  reportsTo: t("org.reportsToExternal"),
                }}
              />
            ))}
          </ul>
        </Card>

        {unfilled > 0 && <SourceNote>{t("org.unfilledNote")}</SourceNote>}
      </Section>
    </div>
  );
}

function OrgNode({
  node,
  childrenOf,
  depth,
  labels,
}: {
  node: Node;
  childrenOf: Map<string | null, Node[]>;
  depth: number;
  labels: { posts: string; vacant: string; readOnly: string; reportsTo: string };
}) {
  const children = (childrenOf.get(node.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <li>
      <div
        className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md px-2 py-1.5 hover:bg-[var(--app-bg)]"
        style={{ marginLeft: depth * 20 }}
      >
        {/* Le liseré d'accent marque la profondeur sans dessiner de traits. */}
        {depth > 0 && (
          <span
            aria-hidden="true"
            className="inline-block h-3 w-[2px] rounded-full"
            style={{ backgroundColor: "var(--accent-2)" }}
          />
        )}
        <span className="font-medium text-[var(--text)]">{node.title}</span>
        <Chip>{node.code}</Chip>
        <Chip>{node.organisation}</Chip>
        {node.accessMode === "read_only" && (
          <span className="text-[11px] text-[var(--text-muted)]">{labels.readOnly}</span>
        )}
        {node.posts > 1 && (
          <span className="text-[11px] text-[var(--text-muted)]">
            {`${node.posts} ${labels.posts}`}
          </span>
        )}
        {node.levelOfEffort && (
          <span className="text-[11px] text-[var(--text-muted)]">{node.levelOfEffort}</span>
        )}

        {node.holders.length > 0 ? (
          <span className="text-xs text-[var(--text-muted)]">
            · {node.holders.join(", ")}
          </span>
        ) : (
          <span className="text-xs italic text-[var(--text-muted)]">· {labels.vacant}</span>
        )}

        {node.reportsToExternal && (
          <span className="w-full text-[11px] text-[var(--text-muted)]">
            {labels.reportsTo} : {node.reportsToExternal}
          </span>
        )}
      </div>

      {children.length > 0 && (
        <ul className="flex flex-col gap-1">
          {children.map((child) => (
            <OrgNode
              key={child.id}
              node={child}
              childrenOf={childrenOf}
              depth={depth + 1}
              labels={labels}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
