"use client";

import { useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { setUserActive } from "./actions";

export function UserRowActions({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  /** Un administrateur ne se désactive pas lui-même : il se verrouillerait dehors. */
  isSelf: boolean;
}) {
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      variant={isActive ? "quiet" : "primary"}
      disabled={pending || (isSelf && isActive)}
      title={isSelf && isActive ? t("users.cannotDeactivateSelf") : undefined}
      onClick={() => start(() => void setUserActive(userId, !isActive))}
    >
      {isActive ? t("users.deactivate") : t("users.activate")}
    </Button>
  );
}
