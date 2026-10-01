// ============================================================
// components/roadmap/rich-text.tsx — afficher et saisir le détail enrichi.
//
// ⚠ AUCUN `dangerouslySetInnerHTML` NULLE PART.
//
// C'est le point de tout le dispositif : `lib/roadmap/rich-text.ts` rend des
// NŒUDS, pas du HTML, et ce composant ne sait fabriquer que `<strong>`, `<em>`,
// `<code>`, `<li>` et un lien dont l'adresse a été vérifiée. Rien de ce qu'un
// utilisateur écrit ne peut donc devenir une balise — la désinfection n'est pas
// une étape qu'on pourrait oublier, elle est structurelle.
//
// L'éditeur est un `textarea` plus trois boutons, et non un `contenteditable` :
// la source reste visible et copiable, la sélection se comporte comme partout
// ailleurs, et on ne réécrit pas un moteur d'édition.
// ============================================================

"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { BoldIcon, BulletIcon, ItalicIcon } from "@/components/ui/icons";
import { fieldClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { applyMark, parseRichText, type RichSpan } from "@/lib/roadmap/rich-text";

export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = parseRichText(source);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {blocks.map((block, i) =>
        block.kind === "paragraph" ? (
          // `whitespace-pre-line` : un saut de ligne simple reste un saut de
          // ligne, comme dans une note prise à la volée.
          <p key={i} className="whitespace-pre-line">
            <Spans spans={block.spans} />
          </p>
        ) : (
          <ul key={i} className="ml-4 list-disc">
            {block.items.map((spans, j) => (
              <li key={j}>
                <Spans spans={spans} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function Spans({ spans }: { spans: RichSpan[] }) {
  return (
    <>
      {spans.map((span, i) => {
        if (span.kind === "bold") return <strong key={i}>{span.text}</strong>;
        if (span.kind === "italic") return <em key={i}>{span.text}</em>;
        if (span.kind === "code")
          return (
            <code key={i} className="rounded bg-[var(--app-bg)] px-1 text-[0.9em]">
              {span.text}
            </code>
          );
        if (span.kind === "link")
          return (
            <a
              key={i}
              href={span.href}
              target="_blank"
              // `noreferrer` autant que `noopener` : la page ouverte n'a pas à
              // savoir d'où vient le clic.
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--accent)" }}
            >
              {span.text}
            </a>
          );
        return <span key={i}>{span.text}</span>;
      })}
    </>
  );
}

/** Zone de saisie avec ses trois boutons et son aperçu. */
export function RichTextEditor({
  id,
  value,
  onChange,
  rows = 4,
  placeholder,
  autoFocus = false,
  onBlur,
  onKeyDown,
  compact = false,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** En cellule de tableau : pas d'aperçu, pas de rappel de syntaxe. */
  compact?: boolean;
}) {
  const t = useT();
  const area = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function mark(kind: "bold" | "italic" | "bullet") {
    const el = area.current;
    if (!el) return;
    const next = applyMark(value, el.selectionStart, el.selectionEnd, kind);
    onChange(next.value);
    // Rendre la sélection APRÈS le rendu, sinon React la replace au bout du
    // texte et le bouton suivant s'applique au mauvais endroit.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-0.5">
        <Tool label={t("roadmap.bold")} onClick={() => mark("bold")}>
          <BoldIcon className="h-3.5 w-3.5" />
        </Tool>
        <Tool label={t("roadmap.italic")} onClick={() => mark("italic")}>
          <ItalicIcon className="h-3.5 w-3.5" />
        </Tool>
        <Tool label={t("roadmap.bulletList")} onClick={() => mark("bullet")}>
          <BulletIcon className="h-3.5 w-3.5" />
        </Tool>
        {!compact && value.trim() !== "" && (
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            aria-pressed={preview}
            className="ml-auto rounded px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t(preview ? "common.edit" : "common.preview")}
          </button>
        )}
      </div>

      {preview && !compact ? (
        <div
          className={cn(fieldClasses(), "min-h-[88px] text-sm")}
          style={{ backgroundColor: "var(--surface)" }}
        >
          <RichText source={value} />
        </div>
      ) : (
        <textarea
          id={id}
          ref={area}
          rows={rows}
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className={cn(fieldClasses(), compact && "text-xs")}
        />
      )}

      {!compact && (
        <p className="text-xs text-[var(--text-muted)]">{t("roadmap.formattingHint")}</p>
      )}
    </div>
  );
}

function Tool({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // `onMouseDown` et non `onClick` : un clic retire d'abord le focus du
      // `textarea`, et la sélection serait perdue avant qu'on l'ait lue.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--text)]"
    >
      {children}
    </button>
  );
}
