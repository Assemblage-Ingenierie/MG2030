# messages/ — dictionnaires d'interface

## Règle absolue

**Aucune chaîne de caractères en dur dans un composant**, dès le premier
(brief §6). Tout libellé visible passe par une clé de ce dossier.

Ne sont **pas** traduits : les contenus saisis par les utilisateurs, les noms de
sites, de bâtiments et de marchés, les intitulés de tâches, et les documents
(brief §6). Ils s'affichent tels qu'ils ont été saisis.

## Pourquoi `sq.json` est vide

Le brief §9 range « albanais complet » **hors du périmètre de la version 1** et
demande de « préparer l'infrastructure, une seule langue peuplée ».

`sq.json` ne contient donc qu'un marqueur `_status`. Ce n'est pas un oubli :

- Les libellés officiels en albanais **restent à valider par la PIU**
  (`seed/README_SEED.md`, section Translittération). Y déposer une traduction
  automatique donnerait à relire un texte que personne n'a écrit, et ferait
  passer pour validé ce qui ne l'est pas.
- Le mécanisme de repli (`lib/i18n/translate.ts`) affiche l'anglais pour toute
  clé absente. Basculer en albanais aujourd'hui donne donc une interface
  entièrement en anglais — comportement correct et voulu.

Quand la PIU fournira les traductions, il suffira de remplir `sq.json` avec la
même arborescence que `en.json`. Aucun code à modifier.

## Vérifier qu'aucune chaîne n'est en dur

La page `/design-system` affiche l'état de l'internationalisation : nombre de
clés par langue, et taux de couverture. Pour prouver qu'aucun libellé n'échappe
au dictionnaire, basculer en albanais et comparer visuellement : **tout** doit
provenir du repli anglais, rien ne doit être figé dans le JSX.

## Convention de nommage des clés

Chemin pointé, du général au particulier :

```
app.*        identité de la plateforme
nav.*        navigation
common.*     verbes et libellés réutilisés partout
status.*     états métier (en cours, terminé, en retard, non commencé)
auth.*       connexion et contrôle d'accès
errors.*     messages d'erreur
<module>.*   un espace de noms par module (sites, contracts, schedule…)
```

Interpolation par repères nommés : `"Page {current} of {total}"`.
