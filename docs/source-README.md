# docs/source/ — non versionné

Ce dossier contient les documents sources du projet. Il est **exclu du dépôt**
(`.gitignore`) parce que le dépôt est public et que ces pièces ne sont pas
diffusables :

| Document | Pourquoi il n'est pas publié |
|---|---|
| `KOSOVO-MG2030_AFD Board preparation report_V3.pdf` | Document interne de préparation du conseil d'administration de l'AFD |
| `KOSOVO_MG_Procurement strategy_V1.pdf` | Contient les dates de publication et les montants estimés de marchés **non encore lancés**. Les diffuser donnerait le budget aux candidats (Directives AFD §3.1.2, confidentialité) |
| `260803_MG2030_PIU_Job descriptions_V1.docx` | Document interne de ressources humaines |
| `Directives PM - 2024.pdf` | Publié par l'AFD, mais laissé ici avec les autres pour ne pas scinder le dossier |

Ils se transmettent **hors dépôt**, et se déposent dans `docs/source/` en local.

## Ce qui EST versionné, et pourquoi

`seed/` contient l'extraction déjà arbitrée de ces documents : c'est la source
unique du peuplement de la base (`seed/README_SEED.md`). Sans elle, le projet
ne se déploie pas.

Les données qui y figurent sont celles nécessaires au fonctionnement de l'outil,
et leurs écarts sont documentés. Si la PIU juge que les montants estimés ou les
seuils de chiffre d'affaires ne doivent pas non plus être publics, il faut
sortir `seed/` du dépôt et le transmettre par le même canal — le projet reste
alors déployable, mais la base doit être peuplée à la main.
