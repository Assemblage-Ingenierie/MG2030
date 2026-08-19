# Données de seed — Plateforme MG2030

Fichiers CSV faisant foi pour le peuplement initial de la base. UTF-8, séparateur virgule.

**Règle** : ces fichiers sont la source unique. Claude Code ne doit **jamais** extraire de
données depuis les PDF de `docs/source/`, qui servent uniquement de contexte. Tout champ vide
est une donnée réellement manquante, à ne pas compléter par déduction.

## Sources

| Sigle | Document | Sections utilisées |
|---|---|---|
| BPR | KOSOVO-MG2030_AFD Board preparation report_V3.pdf | 2.2, 5.2.1, 5.2.2, 5.3.1, 7.4.7, 7.7 (budget projet) |
| PS | KOSOVO_MG_Procurement strategy_V1.pdf | 3.3 (plan de passation) |
| JD | 260803_MG2030_PIU_Job descriptions_V1.docx | 2.4, 3.1 à 3.11 |

## Fichiers

| Fichier | Lignes | Contenu |
|---|---|---|
| `sites.csv` | 14 | Les 14 sites du projet, tous à Pristina |
| `buildings.csv` | 36 | 23 bâtiments du Student Center + 13 salles des training venues |
| `contracts.csv` | 9 | Les procédures de passation du plan de passation |
| `lots.csv` | 15 | Les lots rattachés aux procédures |
| `lot_buildings.csv` | 59 | Affectation bâtiments / lots |
| `piu_roles.csv` | 14 | Les 11 fonctions PIU + admin plateforme + AT + AFD |
| `folder_tree.csv` | 39 | Arborescence documentaire initiale (**proposition**, pas une donnée projet) |

## Conventions

**Numérotation des marchés.** Le plan de passation utilise le suffixe littéral `XX`, non encore
attribué. Le champ `contract_number` reproduit cette valeur telle quelle. La clé fonctionnelle
est `contract_code` (`C-TA`, `W-TV`, `DB-SC`...), qui n'est pas une donnée projet mais un
identifiant technique créé pour ce seed.

**Scénarios.** Le champ `scenario` de `contracts.csv` distingue trois cas :
- `base` : marchés communs aux deux voies ;
- `design_bid_build` : voie classique, conception détaillée puis appel d'offres travaux ;
- `design_build` : voie Design & Build.

Les scénarios `design_bid_build` et `design_build` sont **mutuellement exclusifs**. Le seed doit
charger les deux, l'interface devant permettre de basculer d'une hypothèse à l'autre. Rappel du
BPR 7.4 : le Design & Build est autorisé par les lignes directrices AFD mais interdit par la loi
kosovare sur les marchés publics, la dérogation reposant sur l'article 3 de la loi de base.

**Zones du Student Center.** `residential` regroupe les 8 Konvikti et les 3 nouveaux dortoirs.
`services_and_sports` regroupe le reste, conformément au découpage en lots du BPR 7.4.7.

**Montants.** Estimations hors taxes issues du budget projet (BPR 7.7). Contrôle effectué :
la somme des bâtiments du Student Center donne 37 218 706 € contre 37 218 704 € au document
(A.1 + A.2), et les training venues 3 539 416 € contre 3 539 414 € (C.1). Écarts de 2 € dus aux
arrondis du document source.

Les estimations de bâtiments **ne couvrent pas** : espaces extérieurs (9 230 000 € au SC,
650 000 € aux TV), structures temporaires des Jeux (281 500 €), mobilier et équipements
(1 715 920 € au SC, 350 000 € d'équipement sportif), tolérances, honoraires, révisions de prix
et TVA. Le coût total projet est de 70 920 373 € HT et 83 686 040 € TTC.

## Données manquantes

À compléter par la PIU ou l'AT. Ne pas inventer.

1. **Coordonnées GPS des 14 sites.** Absentes des documents. Bloquant pour le module carte
   (phase 2), pas pour la version 1.
2. **Adresses des 14 sites.**
3. **Composition des lots de training venues.** La répartition des 13 salles entre les 4 lots
   n'est pas arrêtée : `lot_buildings.csv` les laisse non affectées.
4. **Surfaces des trois bâtiments démolis du Student Center** (administration existante, centre
   de santé existant, amphithéâtre). Le BPR 5.2.2 indique 690 m² pour un regroupement ambigu.
5. **Montants estimés de la plupart des marchés**, notés « TBD » au plan de passation.
6. **Dates de publication et d'ouverture des plis du marché de conception détaillée du Student
   Center**, passé en gré à gré (`DC`), donc sans avis.
7. **Titulaires des marchés et des lots**, à renseigner à l'attribution.

## Écarts et incohérences relevés dans les documents sources

À arbitrer avant mise en service. Aucun n'a été corrigé silencieusement.

1. **Nombre de training venues par lot.** Le BPR 7.4.7 conclut sur « 4 lots de 3 salles, soit
   12 salles au total », alors que le tableau du même paragraphe décrit un lot 4 de 4 salles,
   soit 13. Le projet compte 13 salles. La conclusion écrite est donc erronée ou une salle est
   exclue du périmètre travaux sans que le document le dise.
2. **Montants des lots du Student Center.** Le BPR 7.4.7 retient 39,7 M€ pour la zone
   résidentielle et 6,9 M€ pour la zone services et sports, soit 46,6 M€. Le plan de passation
   retient 28,7 M€ et 15,7 M€ en Design & Build, soit 44,4 M€, avec une répartition entre zones
   très différente. Les deux jeux de valeurs sont chargés, respectivement sur les lots `W-SC-*`
   et `DB-SC-*`.
3. **Années de construction des dortoirs.** Le tableau du BPR 5.2.2 et celui du BPR 5.4
   divergent : Konvikti 3 (1963 contre 1969), Konvikti 4 (1967 contre 1974), Konvikti 6
   (2007 contre 2009), Konvikti 7 (2007 contre 2011), Konvikti 8 (2014 contre 2017). Les valeurs
   divergentes ont été laissées **vides** dans `buildings.csv`. Seules les années concordantes
   sont renseignées.
4. **Surface de la salle Tetori.** 3 934 m² au programme architectural, 1 987 m² de surface nette
   au budget. Les deux valeurs sont conservées dans des colonnes distinctes.
5. **Type de contrat des marchés de fournitures.** Le plan de passation numérote les trois
   marchés de biens en `.../C/2027/XX` alors que la colonne « type de contrat » indique `G`.
   `contract_number` reproduit la source, `contract_type` vaut `G`.
6. **Surfaces des training venues.** Surface brute au BPR 5.3.1 et surface nette au budget
   diffèrent pour Pavaresia (534 contre 540) et Qamil Batalli (650 contre 649). Les deux colonnes
   sont renseignées.
7. **Nom de l'école Hasan Prishtina.** Orthographié « Hasan Pristina » au BPR 5.3.1 et 5.4,
   « Hasan Prishtina » au budget. La seconde graphie a été retenue.

## Translittération

Les diacritiques albanais sont conservés dans les libellés lorsqu'ils figurent aux documents
sources, sauf dans les codes (`site_code`, `building_code`), volontairement en ASCII.
Les libellés officiels en albanais restent à valider par la PIU.
