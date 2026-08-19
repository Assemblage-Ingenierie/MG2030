"use client";

// ============================================================
// components/shell/sidebar.tsx — navigation latérale.
// Géométrie reprise de docs/UI_TOKENS.md §8 : 248 px en colonne de grille,
// 264 px en tiroir mobile, bloc de logo aligné sur la hauteur du header (72 px).
// ============================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { NavIcon } from "@/components/ui/icons";
import { NAV, isActive } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { BrandMark } from "./brand-mark";

export function Sidebar({
  mobileOpen,
  onNavigate,
}: {
  mobileOpen: boolean;
  /** Ferme le tiroir mobile au clic d'un lien. */
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const t = useT();

  return (
    <aside
      id="sidebar"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col",
        "bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] shadow-xl",
        "transition-transform duration-200 ease-out",
        "lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-full lg:translate-x-0 lg:shadow-none",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Bloc de marque — même hauteur que le header, pour aligner les deux */}
      <div className="flex h-[72px] shrink-0 items-center border-b border-[var(--sidebar-border)] px-5">
        <Link
          href="/"
          onClick={onNavigate}
          aria-label={t("nav.brandAria")}
          className="rounded-md"
        >
          {/* Sur fond sombre, l'accent bleu manquerait de contraste : la marque
              passe en blanc, l'or restant lisible. */}
          <span className="text-xl font-bold tracking-tight text-[var(--sidebar-text)]">
            MG
            <span style={{ color: "var(--accent-2)" }}>2030</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label={t("nav.main")}>
        {NAV.map((group, index) => (
          <div key={group.labelKey ?? `group-${index}`} className={index > 0 ? "mt-5" : undefined}>
            {group.labelKey && (
              <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--sidebar-text-muted)]">
                {t(group.labelKey)}
              </h2>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);

                // Un module non livré est annoncé mais NON cliquable : mieux
                // vaut une entrée grisée qu'une page vide qui laisse croire à
                // une panne.
                if (item.upcoming) {
                  return (
                    <li key={item.href}>
                      <span
                        aria-disabled="true"
                        title={t("nav.upcoming")}
                        className={cn(
                          "flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2",
                          "text-sm font-medium text-[var(--sidebar-text-muted)] opacity-50",
                        )}
                      >
                        <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
                        <span className="truncate">{t(item.labelKey)}</span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-[var(--sidebar-active)] font-semibold text-[var(--sidebar-text)]"
                          : "font-medium text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]",
                      )}
                    >
                      {/* Liseré vertical de l'item actif, en or : sur le fond
                          sombre de la sidebar, le bleu d'accent disparaîtrait. */}
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1 left-0 w-[3px] rounded-full"
                          style={{ backgroundColor: "var(--accent-2)" }}
                        />
                      )}
                      <NavIcon
                        name={item.icon}
                        className="h-5 w-5 shrink-0"
                        style={active ? { color: "var(--accent-2)" } : undefined}
                      />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pied : maître d'ouvrage. L'authentification arrive au lot 4 ; ce bloc
          accueillera alors le nom de l'utilisateur et la déconnexion. */}
      <div className="shrink-0 border-t border-[var(--sidebar-border)] px-5 py-3">
        <p className="text-xs text-[var(--sidebar-text-muted)]">{t("app.owner")}</p>
      </div>
    </aside>
  );
}
