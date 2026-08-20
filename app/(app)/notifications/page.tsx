import { getI18n } from "@/lib/i18n/server";
import { listNotifications } from "@/lib/queries/notifications";
import { formatDateTime } from "@/lib/i18n/format";
import { Card, Section } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { SourceNote } from "@/components/referential/source-note";
import { MarkAllReadButton, MarkReadButton } from "@/components/notifications/mark-read";
import { cn } from "@/lib/cn";

/**
 * Notifications applicatives.
 *
 * Pas d'e-mail en version 1 (brief §7) : elles se lisent ici, et nulle part
 * ailleurs. Sans cette page, l'évaluation périodique écrivait des lignes que
 * personne ne pouvait voir.
 *
 * Deux natures distinctes :
 *   • ÉVÉNEMENT (dépôt de document, plainte) — produit par trigger ;
 *   • ÉTAT (retard, échéance proche) — produit par `/api/cron/schedule-checks`,
 *     car personne ne « fait » l'action de dépasser une échéance.
 */
export default async function NotificationsPage() {
  const { t } = await getI18n();
  const notifications = await listNotifications();

  const unread = notifications.filter((n) => n.readAt === null);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Section
        title={t("notifications.title")}
        description={t("notifications.intro")}
        actions={unread.length > 0 ? <MarkAllReadButton count={unread.length} /> : undefined}
      >
        <Card className="divide-y divide-[var(--border)]">
          {notifications.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
              {t("notifications.empty")}
            </p>
          )}

          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3",
                n.readAt === null && "bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]",
              )}
            >
              {/* Un point d'accent marque le non-lu : plus discret qu'un fond
                  vif, et lisible d'un coup d'œil sur une liste longue. */}
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: n.readAt === null ? "var(--accent)" : "var(--border)",
                }}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={cn(
                      "text-sm text-[var(--text)]",
                      n.readAt === null && "font-medium",
                    )}
                  >
                    {n.title}
                  </span>
                  <Chip>{t(`notifications.kind_${n.kind}`)}</Chip>
                </div>
                {n.body && (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{n.body}</p>
                )}
                <p className="mt-1 text-[11px] tabular-nums text-[var(--text-muted)]">
                  {formatDateTime(n.createdAt)}
                </p>
              </div>

              {n.readAt === null && <MarkReadButton id={n.id} />}
            </div>
          ))}
        </Card>

        {notifications.length === 0 && <SourceNote>{t("notifications.emptyNote")}</SourceNote>}
      </Section>
    </div>
  );
}
