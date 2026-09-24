"use client";

// ============================================================
// components/shell/header.tsx
// Géométrie de docs/UI_TOKENS.md §8 : collant, 72 px minimum, bordure basse,
// logos institutionnels à gauche (bailleur puis maître d'ouvrage).
// ============================================================

import { useT } from "@/components/i18n/i18n-context";
import { IconButton } from "@/components/ui/button";
import { MenuIcon } from "@/components/ui/icons";
import { BrandMark, FunderMark, GamesMark, KosovoEmblem } from "./brand-mark";
import { LanguageSwitch } from "./language-switch";
import { AccountMenu } from "./account-menu";

export function Header({ onMenu, bell }: { onMenu: () => void; bell?: React.ReactNode }) {
  const t = useT();

  return (
    <header
      className={
        "sticky top-0 z-20 flex min-h-[72px] flex-wrap items-center gap-x-4 gap-y-2 " +
        "border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2"
      }
    >
      <IconButton label={t("nav.openMenu")} onClick={onMenu} className="h-9 w-9 lg:hidden">
        <MenuIcon className="h-5 w-5" />
      </IconButton>

      {/* Logos : maître d'ouvrage, Jeux, bailleur — puis la devise des Jeux. */}
      <div className="flex items-center gap-3">
        <KosovoEmblem className="h-[38px] w-auto sm:h-[42px]" />
        <span className="sr-only">{t("app.owner")}</span>
        <span className="h-9 w-px bg-[var(--border)]" aria-hidden="true" />
        <GamesMark />
        <span className="h-9 w-px bg-[var(--border)]" aria-hidden="true" />
        <FunderMark />
        {/* Devise officielle, en albanais dans toutes les langues de
            l'interface : c'est un slogan, pas un libellé à traduire. */}
        <span
          lang="sq"
          className="ml-2 hidden text-base font-semibold italic md:inline"
          style={{ color: "var(--accent)" }}
        >
          {t("app.motto")}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <BrandMark />
        {bell}
        <LanguageSwitch />
        <AccountMenu />
      </div>
    </header>
  );
}
