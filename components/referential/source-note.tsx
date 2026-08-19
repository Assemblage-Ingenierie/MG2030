import { AlertIcon } from "@/components/ui/icons";

/**
 * Note d'écart source.
 *
 * Le brief §11.6 impose de laisser nulle toute donnée absente et de la lister
 * dans `docs/GAPS.md`. Ce composant fait le troisième geste, celui qui manque
 * souvent : **le dire à l'écran**. Sans lui, un utilisateur voyant une colonne
 * vide conclut à un défaut de l'outil, alors que la donnée n'existe pas.
 *
 * Ton volontairement neutre : ce n'est ni une erreur ni un avertissement, c'est
 * un fait sur les sources. D'où l'or institutionnel plutôt que le rouge.
 */
export function SourceNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-md border px-3 py-2"
      style={{
        borderColor: "var(--accent-2)",
        backgroundColor: "color-mix(in srgb, var(--accent-2) 8%, transparent)",
      }}
    >
      <AlertIcon
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ color: "var(--accent-2)" }}
        aria-hidden="true"
      />
      <p className="text-xs text-[var(--text-muted)]">{children}</p>
    </div>
  );
}
