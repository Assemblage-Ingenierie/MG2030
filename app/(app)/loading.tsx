import { Card } from "@/components/ui/card";

/**
 * Écran d'attente commun à tous les écrans métier.
 *
 * ⚠ CE FICHIER NE FAIT PAS QUE MONTRER UN SQUELETTE : IL REND LE PRÉCHARGEMENT
 * POSSIBLE. C'est sa raison d'être principale, et elle n'est pas devinable.
 *
 * Toutes les routes de la plateforme sont dynamiques — chacune interroge la
 * base avec la session de l'appelant, rien n'est prérendu. Or, pour une route
 * dynamique, `next/link` ne précharge QUE jusqu'à la frontière de chargement la
 * plus proche. Sans `loading.tsx` nulle part, il n'y avait aucune frontière,
 * donc rien à mettre en cache : le préchargement ne faisait rien du tout.
 *
 * Et sans frontière, le routeur ATTEND le rendu serveur complet avant de
 * changer l'écran — authentification, puis requêtes de la page, puis rendu.
 * D'où le lag signalé le 18/09/2026 : on cliquait, rien ne bougeait, puis la
 * page apparaissait d'un coup. L'ancienne page restait affichée pendant tout ce
 * temps, ce qui se lit comme un clic perdu et fait recliquer.
 *
 * Le squelette est VOLONTAIREMENT GÉNÉRIQUE. Il coiffe une dizaine d'écrans de
 * formes très différentes — plan de charge, carte, bibliothèque, annuaire — et
 * un faux qui imiterait l'un d'eux mentirait sur les neuf autres. Il annonce
 * qu'il se passe quelque chose et où, pas ce qui va arriver.
 *
 * Le cadre applicatif — en-tête, barre latérale — n'est PAS redessiné : il vit
 * dans le layout, que le routeur conserve d'une navigation à l'autre. Seule
 * cette zone clignote.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4" aria-busy="true">
      {/* `aria-busy` sur le conteneur et pas de texte dans les blocs : un
          lecteur d'écran annonce l'attente sans énumérer des barres grises. */}
      <div className="flex flex-col gap-2">
        <Bar className="h-6 w-56" />
        <Bar className="h-4 w-full max-w-md" />
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <Bar className="h-4 w-40" />
        <Bar className="h-24 w-full" />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <Bar className="h-4 w-32" />
          <Bar className="h-16 w-full" />
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <Bar className="h-4 w-32" />
          <Bar className="h-16 w-full" />
        </Card>
      </div>
    </div>
  );
}

/**
 * Bloc gris pulsé.
 *
 * `--app-bg` plutôt qu'un gris choisi à la main : le squelette suit le thème
 * comme le reste, et reste discret. Un squelette trop contrasté attire l'œil
 * sur l'attente au lieu de la faire oublier.
 */
function Bar({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-[var(--app-bg)] ${className}`}
    />
  );
}
