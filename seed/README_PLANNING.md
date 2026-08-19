# Planning — extraction et diagnostic

Source : `Planning_provisoire.xlsx`, onglets `TV` et `SC`.
Fichiers produits : `tasks.csv`, `task_dependencies.csv`, `task_constraints.csv`,
`excluded_rows.csv`.

## Ce qui a été retenu

**Uniquement les lignes visibles** des deux onglets, soit 25 tâches sur les 74 lignes
renseignées du classeur. Toutes les autres sont masquées dans le fichier et exportées dans
`excluded_rows.csv` avec leur motif d'exclusion, sans être supprimées.

| Plan | Scénario | Tâches | Période couverte |
|---|---|---|---|
| `TV` | `base` | 15 | 01/07/2026 au 01/02/2029 |
| `SC-DB` | `design_build` | 10 | 01/07/2026 au 29/05/2029 |

Aucune date n'a été recalculée : les valeurs sont celles produites par Excel.

## Conventions confirmées par le fichier

- **Durées en jours calendaires.** Le nom défini `week` vaut 7 (onglet `parameters`) et
  la colonne D calcule `jours / 7`. La convention du brief est donc bien celle du fichier.
- **Dépendances fin-début à décalage nul**, encodées dans les formules de la colonne C
  (`Start = End` du prédécesseur). Elles sont reconstituées dans `task_dependencies.csv`,
  chaque ligne citant la formule d'origine.
- **Deux tâches ont deux prédécesseurs** (`Proposal Preparation` dans les deux onglets, via
  une formule `MAX`). Le moteur de planification doit donc gérer les convergences, pas
  seulement les chaînes linéaires.
- **Quatre tâches ont une date de début saisie en dur**, sans prédécesseur. Elles constituent
  des contraintes de calendrier et non des dépendances : voir `task_constraints.csv`.
- **Marge terminale de 4 mois** : annotation `4 months buffer` en cellule `AY6`, couvrant
  septembre à décembre 2029, avant la date de fin de travaux du 01/01/2030 (`C5`).

## Recoupement avec le plan de passation

| Jalon | Planning | Plan de passation | Écart |
|---|---|---|---|
| TV travaux, publication de l'avis | 05/08/2027 | 05/08/2027 | aucun |
| TV travaux, ouverture des plis | 30/09/2027 | 30/09/2027 | aucun |
| TV travaux, signature | 11/11/2027 | 11/11/2027 | aucun |
| TV travaux, achèvement | 01/02/2029 | 01/02/2029 | aucun |
| SC Design & Build, publication de l'avis | 01/09/2026 | 01/09/2026 | aucun |
| SC Design & Build, ouverture des plis | 14/01/2027 | 14/01/2027 | aucun |
| SC Design & Build, signature | 27/02/2027 | 27/02/2027 | aucun |
| SC Design & Build, achèvement | 29/05/2029 | 29/05/2029 | aucun |
| **TV conception détaillée, signature** | **07/01/2027** | **27/11/2026** | **6 semaines** |

Les chaînes travaux des deux onglets concordent au jour près avec le plan de passation.
Seule la signature du marché de conception détaillée des training venues diverge de six
semaines. Le décalage vient du chaînage : le planning enchaîne validation TA et MYS
(14 jours), puis négociation et avis de non-objection (28 jours) après la remise des offres
du 26/11/2026, là où le plan de passation retient une signature dès le 27/11/2026, soit le
lendemain de la remise. La date du plan de passation paraît donc irréaliste, mais c'est elle
qui figure au document contractuel. À arbitrer.

Sans objet : la date d'achèvement du marché de conception détaillée (31/10/2028 au plan de
passation) couvre la supervision des travaux, alors que la tâche `TV.2.7` s'arrête à la fin
des études. Ce n'est pas un écart.

## Sept anomalies du fichier source, à arbitrer avant mise en service

Aucune n'a été corrigée. Elles justifient à elles seules l'abandon du fichier.

1. **Le scénario classique du Student Center est inexploitable.** Les lignes 44 à 51 de
   l'onglet `SC` calculent à rebours depuis la fin du Design & Build (`I47 = I30`) et non
   depuis une date de lancement. Résultat : les travaux du Student Center démarreraient le
   13/07/2029 pour s'achever le **13/10/2031**, soit 21 mois après les Jeux. Or c'est la
   voie de droit commun, le Design & Build étant interdit par la loi kosovare sur les marchés
   publics. **La plateforme ne peut donc pas charger de planning pour le scénario
   `design_bid_build` de `contracts.csv`, qui est pourtant celui du plan de passation.**
   C'est le point bloquant principal.

2. **Deux systèmes de calcul de dates coexistent.** Les colonnes C et I d'une part, les
   colonnes F, G et H (« Démmarage estimé », « Fin estimée ») d'autre part. Le second est
   rompu : références croisées vers des lignes sans rapport (`F40 = F28`, `G45 = G33`),
   duplication de durée (`G32 = G30 + E30` au lieu de `E32`), et dates de fin allant jusqu'à
   **2034** dans l'onglet `SC`. Ces colonnes ont été ignorées. Si elles servaient au suivi de
   l'avancement réel, la fonction est à reconstruire, pas à reprendre.

3. **Le bloc de conception détaillée des training venues existe en double** : lignes 16 à 21
   masquées et lignes 24 à 30 visibles, avec des dates différentes (fin de négociation le
   02/01/2027 contre 07/01/2027).

4. **Sept lignes relatives au Student Center subsistent dans l'onglet TV** (lignes 31 à 37,
   dont « Student center work », « COJO », « Négociation du contrat ») avec des dates de fin
   jusqu'au 30/10/2030, postérieures aux Jeux.

5. **Le bloc training venues est dupliqué dans l'onglet SC** (lignes 38 à 43), calé sur la
   fin du Design & Build, ce qui place les travaux des salles en septembre 2029, et avec une
   durée de travaux de 100 jours contre 448 dans l'onglet `TV`.

6. **La ligne parente du scénario Design & Build est libellée « Detail Design »**
   (`SC` ligne 22), ce qui est trompeur pour un marché de conception-réalisation.

7. **Reliquats d'un autre projet.** Les lignes 54 et suivantes des deux onglets portent sur
   un projet de collèges (« EPP COLLEGES - PHASE 0 »), et les deux onglets de pointage
   contiennent le suivi de procédures d'un projet aux Comores, en francs comoriens, daté de
   2021 et 2022. L'onglet `TEST` est saturé de `#REF!`.

## Autres points

- **Date de démarrage projet incohérente.** La cellule `C4` fixe le démarrage au 30/07/2026,
  alors que la première tâche démarre le 01/07/2026.
- **Le rattachement des tâches aux marchés** (`contract_code` dans `tasks.csv`) a été déduit
  des libellés. Les couples certains sont renseignés, les autres laissés vides. À valider.
- **Aucune ressource ni responsable** n'est renseigné dans le fichier. Les colonnes `owner`
  et `validator` du modèle de données restent donc vides au chargement initial.
- **Les libellés « TA + MYS validation » et « TA + MYS evaluation »** sont employés
  indifféremment pour la même nature d'étape. À normaliser, puisque ces libellés alimenteront
  les gabarits de passation.
