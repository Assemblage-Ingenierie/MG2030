import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { countUnread } from "@/lib/queries/notifications";
import { BellIcon } from "@/components/ui/icons";

/**
 * Cloche de notification.
 *
 * Server Component : le compteur est lu au rendu, sans requête depuis le
 * navigateur. Pas de Realtime (brief §4) — le compte se rafraîchit à la
 * navigation, ce qui suffit pour des notifications applicatives sans e-mail.
 */
export async function NotificationBell() {
  const { t } = await getI18n();
  const unread = await countUnread();

  return (
    <Link
      href="/notifications"
      title={t("notifications.title")}
      aria-label={
        unread > 0
          ? t("notifications.bellWithCount", { count: String(unread) })
          : t("notifications.title")
      }
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--app-bg)] hover:text-[var(--text)]"
    >
      <BellIcon className="h-5 w-5" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
          style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
