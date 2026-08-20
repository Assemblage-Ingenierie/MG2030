"use client";

import { useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { markAllRead, markRead } from "@/app/(app)/notifications/actions";

export function MarkReadButton({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="quiet"
      disabled={pending}
      onClick={() => start(() => void markRead(id))}
    >
      {t("notifications.markRead")}
    </Button>
  );
}

export function MarkAllReadButton({ count }: { count: number }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => start(() => void markAllRead())}
    >
      {t("notifications.markAllRead", { count: String(count) })}
    </Button>
  );
}
