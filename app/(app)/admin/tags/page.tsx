import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isPlatformAdmin } from "@/lib/auth/types";
import { listTagOptions } from "@/lib/queries/library";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { AlertIcon } from "@/components/ui/icons";
import { TagColour, TagName, NewTag } from "@/components/library/tag-admin";

/**
 * Étiquettes documentaires.
 *
 * Elles n'avaient aucun écran : les quatre du système venaient d'une migration,
 * et en ajouter une demandait du SQL. Demandé le 01/10/2026.
 *
 * ⚠ CRÉER UNE ÉTIQUETTE NE DONNE ACCÈS À RIEN, et c'est le piège de cet écran.
 * La lecture documentaire est gouvernée par `mg2030_tag_access` : une étiquette
 * neuve n'est accordée à personne, donc un document qui ne porterait qu'elle
 * deviendrait invisible de tout le monde sauf d'un administrateur. C'est
 * exactement ce qui avait vidé la bibliothèque en septembre (migration 0026).
 * L'avertissement est à l'écran, pas seulement ici.
 *
 * Pas de suppression : retirer une étiquette porterait sur les documents qui la
 * portent et sur les autorisations qui s'y rattachent, en cascade. On renomme,
 * ce qui couvre le besoin réel — une étiquette mal nommée.
 */
export default async function TagsAdminPage() {
  const { t } = await getI18n();
  const me = await getCurrentUser();

  if (!isPlatformAdmin(me)) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <AlertIcon className="mx-auto h-7 w-7" style={{ color: "var(--danger)" }} />
        <p className="mt-3 text-sm text-[var(--text-muted)]">{t("errors.forbidden")}</p>
      </Card>
    );
  }

  const tags = await listTagOptions();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Section title={t("tags.title")} description={t("tags.intro")}>
        <Card
          className="flex items-start gap-3 p-4"
          style={{ borderColor: "var(--accent-2)" }}
        >
          <AlertIcon
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: "var(--accent-2)" }}
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--text-muted)]">{t("tags.warning")}</p>
        </Card>

        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("tags.label")}</Th>
              <Th>{t("tags.code")}</Th>
              <Th align="right">{t("tags.colour")}</Th>
            </Thead>
            <tbody>
              {tags.length === 0 && <EmptyRow colSpan={3}>{t("common.empty")}</EmptyRow>}
              {tags.map((tag) => (
                <Tr key={tag.id}>
                  <Td>
                    <TagName tagId={tag.id} label={tag.label} />
                  </Td>
                  {/* Le CODE ne se change pas : il identifie l'étiquette dans
                      les autorisations et dans le tag par défaut des dossiers.
                      Le renommer ferait d'un rebaptême une migration. */}
                  <Td className="font-mono text-xs text-[var(--text-muted)]">{tag.code}</Td>
                  <Td align="right">
                    <TagColour tagId={tag.id} colour={tag.color} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="border-t border-[var(--border)] px-3 py-2">
            <NewTag />
          </div>
        </Card>
      </Section>
    </div>
  );
}
