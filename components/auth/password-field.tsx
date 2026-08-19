"use client";

// ============================================================
// Champ mot de passe avec bascule afficher/masquer.
// Reprend le patron du dépôt de charte (docs/UI_TOKENS.md §6).
// ============================================================

import { useId, useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Label, fieldClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function PasswordField({
  label,
  id,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  const t = useT();
  const generated = useId();
  const fieldId = id ?? generated;
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="relative mt-1">
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          className={cn(fieldClasses(), "pr-10")}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <EyeIcon crossed={visible} />
        </button>
      </div>
    </div>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {crossed ? (
        <>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </>
      ) : (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}
