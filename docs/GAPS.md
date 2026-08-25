# GAPS — manques, ambiguïtés et contradictions

> Recensement exhaustif avant toute migration. Aucun de ces points n'a été
> tranché silencieusement (brief §11.5 et §11.6).
>
> **Convention de gravité**
> - 🔴 **Bloquant** : empêche de charger le seed, d'écrire une migration, ou de
>   présenter une donnée à un utilisateur sans risque d'erreur.
> - 🟠 **À trancher avant le module concerné** : le développement peut démarrer,
>   mais le module qui consomme la donnée ne peut pas être livré.
> - 🟡 **À documenter** : n'empêche rien, mais doit être visible dans l'interface
>   pour ne pas induire l'utilisateur en erreur.
>
> Les points 1 à 7 et 12 à 18 reprennent les écarts déjà relevés par
> `seed/README_SEED.md` et `seed/README_PLANNING.md` ; ils sont repris ici pour
> que ce document soit la seule liste à tenir. Les points marqués **[NOUVEAU]**
> ont été identifiés en vérifiant l'arithmétique des fichiers de seed.
> Les points **✅ TRANCHÉ** portent la décision et la date.

---

## Journal des décisions — 19/08/2026

| Point | Décision | Effet |
|---|---|---|
| **12** — durée de `TV.2.1` / `SC.2.2` | **20 jours** (2,86 semaines) | `end = start + duration_days` devient vrai sur 21/21. Les 12 dates aval et la concordance au jour près avec le plan de passation sont préservées |
| **37** — projet Supabase | Projet **EXTERNAL** (`grnkbnldfzdzrgleorra`, eu-west-3), **partagé**. Toutes les tables et tous les types préfixés `mg2030_` ; fonctions RLS dans `mg2030_private` | Fait apparaître le point **52** ci-dessous, qui est le nouveau risque principal |
| **40** — locale albanaise | **`sq`** | `messages/en.json`, `messages/sq.json` |
| **41** — fuseau et format | Stockage **UTC**, affichage **`Europe/Belgrade`**, format **`dd/mm/yyyy`** dans les deux langues | — |
| **42** — devise | **Euros hors taxes uniquement** | Aucune colonne TTC ni TVA au schéma |
| **44** — politique de reprise | **Recalcul** à l'import | Rendu sûr par la décision 12 : le recalcul est l'identité, aucune date ne bouge. Un contrôle automatique échoue si une date change |
| **46** — couleur d'accent | Emblème du Kosovo fourni en vectoriel. **Proposition** : `--accent #034ea2`, `--accent-2 #d0a650` (valeurs exactes du fichier officiel) | **Reste à confirmer.** Voir point 46 révisé |
| **49** — logos | Emblème de la République du Kosovo **fourni**. Logo *Prishtina 2030* **indisponible** | On code sans lui : bloc de marque typographique isolé dans `<BrandMark/>`, remplaçable en un fichier |
| **50** — bibliothèque Gantt | **Rendu SVG interne, zéro dépendance** | Voir `docs/GANTT_ARBITRAGE.md`. Édition par glisser-déposer différée ; la saisie passe par la grille tableur |
| **11** — matrice rôle × permission | **Proposition adoptée comme défaut**, révisable à tout moment | `mg2030_role_permission` est une **donnée**, pas du schéma : la modifier ne demande aucune migration |
| **33** — tags multiples | **Union** — un seul tag autorisé suffit | Confirme le choix déjà porté par `mg2030_private.can_read_document()` |

---

## A. Données manquantes

### 1. 🟠 Coordonnées GPS des 14 sites
Absentes des documents sources. `sites.csv` : colonnes `latitude` / `longitude`
vides sur 14/14 lignes.
**Impact** : bloque le module carte, qui est en phase 2. Aucun impact version 1.
**Qui** : PIU ou AT. Un relevé manuel des 14 adresses suffirait.

### 2. 🟠 Adresses des 14 sites
Même constat, colonne `address` vide sur 14/14.
**Impact** : la fiche site sera incomplète dès le lot « Référentiel ».

### 3. 🔴 Composition des lots de training venues
La répartition des 13 salles entre les 4 lots n'est pas arrêtée.
`lot_buildings.csv` porte 13 lignes à `lot_code` **vide**.
**Décision de modélisation retenue** : ces 13 lignes ne sont **pas** chargées —
une affectation inconnue est une *absence* de relation, pas une relation à lot
nul (cf. `SCHEMA.md` §3). Sur 59 lignes du fichier, **46 sont chargées**.
**Impact** : la vue « lot → bâtiments » sera vide pour les 4 lots `W-TV-*`, et
le périmètre `lot` d'un utilisateur ne résoudra aucun site pour ces lots.
Un représentant sur site affecté par lot ne verrait donc rien.
**Qui** : PIU. C'est le manque le plus structurant du référentiel.

### 4. 🟡 Surfaces des trois bâtiments démolis du Student Center
`SC-ADMO`, `SC-HEAO`, `SC-AMPH` : ni surface, ni estimation, ni année.
Le BPR 5.2.2 indique 690 m² pour un regroupement ambigu, non exploitable.

### 5. 🟠 Montants estimés de 8 marchés sur 9
Seul `DB-SC` porte un montant (44 400 000 €). Les 8 autres sont « TBD » au plan
de passation. Le plan de passation précise lui-même que « le budget de chaque
marché sera ajouté ou mis à jour en fonction des études de l'équipe de conception ».
**Impact** : tout indicateur financier agrégé sera faux ou vide en version 1.

### 6. 🟡 Dates de publication et d'ouverture des plis de `C-SC-DD`
Marché de conception détaillée du Student Center, passé en gré à gré (`DC`),
donc sans avis de publicité. Ce n'est pas une omission : c'est une conséquence
de la procédure. À afficher comme « sans objet », pas comme « manquant ».

### 7. 🟡 Titulaires des marchés et des lots
`contractor` vide sur les 9 marchés et les 15 lots. Normal avant attribution.

### 8. 🟡 Responsables et valideurs des tâches
Le fichier Excel source ne contient **aucune ressource**. `task.owner_id` et
`task.validator_id` sont nuls sur les 27 tâches au chargement.
**Impact** : les notifications d'échéance n'auront aucun destinataire tant que
la PIU n'aura pas affecté les tâches.

### 9. 🔴 Aucun planning pour le scénario `design_bid_build`
**C'est le point bloquant principal**, déjà signalé au brief §7.

Le fichier Excel calcule ce scénario **à rebours** depuis la fin du Design &
Build (`I47 = I30`), aboutissant à des travaux du 13/07/2029 au **13/10/2031**,
soit 21 mois après les Jeux. Or c'est la voie de **droit commun** : le Design &
Build est autorisé par les lignes directrices AFD mais **interdit par la loi
kosovare sur les marchés publics**, la dérogation reposant sur l'article 3 de la
loi de base (BPR 7.4).

**Décision** : le scénario est créé, chargé **sans tâches**, et marqué
`is_schedulable = false`. L'interface doit refuser de l'afficher.

> **[NOUVEAU] Nuance importante, et voie de résolution.**
> Contrairement à ce que laisse penser le fichier Excel, le **plan de passation
> contient bien un calendrier cohérent** pour cette voie :
>
> | Marché | Publication | Ouverture | Signature | Achèvement |
> |---|---|---|---|---|
> | `C-SC-DD` (conception) | — (gré à gré) | — | 20/10/2026 | 18/05/2027 |
> | `W-SC` (travaux) | 27/03/2027 | 13/07/2027 | 24/08/2027 | **12/09/2029** |
> | `C-SC-SUP` (supervision) | 02/03/2027 | 14/05/2027 | 25/06/2027 | 12/09/2029 |
>
> Ces dates tiennent avant les Jeux. **Ce n'est donc pas le scénario qui est
> infaisable, c'est le fichier Excel qui est faux.** Le manque se réduit à la
> **décomposition en tâches** de la chaîne `design_bid_build` — que la PIU ou
> l'AT peut produire en une séance, en calant les jalons ci-dessus sur le
> gabarit de passation observé (`SCHEMA.md` §11).
> **Recommandation** : demander cette décomposition plutôt que d'attendre une
> correction de l'Excel, qui est de toute façon destiné à l'abandon.

### 10. 🟠 Aucun gabarit de passation dans les sources
`procurement_template` et `procurement_template_step` sont créées **vides**.
Une séquence candidate, observée dans `tasks.csv` et recoupée avec les
Directives AFD de février 2024, est proposée en `SCHEMA.md` §11 — mais non
chargée.
**Impact** : « créer un contrat instancie le gabarit » (brief §7) est
inopérant tant que la séquence n'est pas validée.

### 11. 🟠 Aucune matrice rôle × permission
Le brief §8 donne deux exemples (« le Procurement Specialist crée un contrat, le
Coordinator valide ») mais pas la matrice. Les fiches de poste
(`260803_MG2030_PIU_Job descriptions_V1.docx`) décrivent des responsabilités
métier, pas des droits applicatifs.
Une proposition figure en `SCHEMA.md` §11.
**Impact** : sans matrice validée, la RLS bloque toute écriture sauf pour
l'administrateur. C'est un défaut sûr, mais l'application est inutilisable.

---

## B. Contradictions dans les données fournies

### 12. ✅ TRANCHÉ (19/08/2026) — [NOUVEAU] Anomalie d'un jour sur `TV.2.1` et `SC.2.2`
Deux tâches portent `duration_days = 21` mais couvrent
`2026-09-01 → 2026-09-21`, soit **20 jours**.

Vérification exhaustive des 21 tâches datées de `tasks.csv` :

| Règle | Résultat |
|---|---|
| `duration_weeks = round(duration_days / 7, 2)` | **21/21 exactes** |
| `end_date = start_date + duration_days` | **19/21** — `TV.2.1` et `SC.2.2` à −1 jour |
| `start = MAX(fin des prédécesseurs)` | **17/17 exactes** |
| `summary` : `MIN`/`MAX` des enfants | **3/3 exactes** |

**Conséquence si l'on retient 21 jours** : le moteur recalcule et toute la chaîne
des training venues glisse d'un jour. La publication de l'avis travaux passe du
**05/08/2027 au 06/08/2027**, ce qui rompt la concordance **au jour près** avec
le plan de passation — concordance aujourd'hui parfaite sur les 8 jalons
recoupés (`README_PLANNING`).

**Recommandation : retenir 20 jours** (soit 2,86 semaines). C'est la seule
valeur qui préserve l'intégralité des dates aval et la cohérence avec le
document contractuel. Pour `SC.2.2`, l'écart ne se propage pas (la branche
`AFD's NoN` est une impasse dans le graphe), mais la correction doit être
symétrique.

**✅ Décision du 19/08/2026 : 20 jours.** Le seed est chargé avec
`duration_days = 20` sur ces deux tâches. `end = start + duration_days` devient
vrai sur **21/21**, ce qui rend le recalcul à l'import (point 44) strictement
neutre. Un contrôle automatique post-chargement **échoue** si une seule date de
fin diffère du CSV.

### 13. 🟠 Signature du marché de conception détaillée des training venues
Planning : **07/01/2027**. Plan de passation : **27/11/2026**. Écart : 6 semaines.

Le décalage vient du chaînage : le planning enchaîne validation TA + MYS
(14 jours) puis négociation et NoN AFD (28 jours) après la remise des offres du
26/11/2026, là où le plan de passation retient une signature **dès le lendemain**
de la remise. La date du plan de passation est matériellement irréaliste, mais
c'est elle qui figure au document contractuel.
**Impact** : la plateforme affichera l'une ou l'autre. Il faut choisir laquelle
fait foi, et prévoir de tracer l'écart quand les deux divergent.

### 14. 🟠 Nombre de salles par lot : 12 ou 13 ?
Le BPR 7.4.7 conclut sur « 4 lots de 3 salles, soit 12 salles au total », alors
que le tableau du même paragraphe décrit un lot 4 de **4** salles, soit 13. Le
projet compte 13 salles (`sites.csv` : 13 sites `training_venues`).
Soit la conclusion écrite est erronée, soit une salle est exclue du périmètre
travaux sans que le document le dise. Lié au point 3.

### 15. 🟠 Montants des lots du Student Center : deux jeux irréconciliables

| Source | Zone services et sports | Zone résidentielle | Total |
|---|---:|---:|---:|
| BPR 7.4.7 (lots `W-SC-*`) | 6 900 000 € | 39 700 000 € | **46 600 000 €** |
| Plan de passation (lots `DB-SC-*`) | 15 700 000 € | 28 700 000 € | **44 400 000 €** |

Non seulement les totaux diffèrent de 2,2 M€, mais la **répartition entre zones
est inversée dans ses proportions**. Les deux jeux sont chargés sur leurs lots
respectifs, ce qui est cohérent avec deux scénarios distincts — mais un écart de
cette ampleur sur le même périmètre physique (les mêmes 23 bâtiments, cf.
`lot_buildings.csv`) reste à expliquer.

> **[NOUVEAU]** Contrôle croisé : la somme des estimations des 23 bâtiments du
> Student Center vaut **37 218 706 €**, soit 7,2 M€ de moins que `DB-SC` et
> 9,4 M€ de moins que `W-SC`. L'écart correspond approximativement aux espaces
> extérieurs (9 230 000 €) que les estimations de bâtiments ne couvrent pas —
> ce qui rend le total BPR plus cohérent que celui du plan de passation.

### 16. 🟡 Années de construction des dortoirs
Le BPR 5.2.2 et le BPR 5.4 divergent sur 5 dortoirs (Konvikti 3, 4, 6, 7, 8).
Les valeurs divergentes ont été laissées **vides** dans `buildings.csv` ; seules
les années concordantes sont renseignées.

### 17. 🟡 Surfaces à deux valeurs
- **Tetori** : 3 934 m² (programme architectural) contre 1 987 m² (surface nette
  au budget). Rapport de 1 à 2 : ce n'est pas un arrondi.
- **Pavaresia** : 534 m² brut contre 540 m² net — la surface *nette* est
  supérieure à la surface *brute*, ce qui est physiquement impossible.
- **Qamil Batalli** : 650 m² brut contre 649 m² net.

Les deux valeurs sont conservées dans deux colonnes distinctes. L'interface doit
afficher laquelle sert de référence pour les ratios de coût.

### 18. 🟡 Type de contrat des marchés de fournitures
Les trois marchés de biens sont numérotés `.../C/2027/XX` alors que leur type
est `G`. `contract_number` reproduit la source, `contract_type` vaut `G`.
La contrainte de format du numéro ne croise donc **volontairement pas** le type
(`SCHEMA.md` §3).

### 19. 🟡 [NOUVEAU] `contract_number` n'est pas unique
Le suffixe `XX` n'étant pas attribué, trois marchés partagent
`MYS/MG2030/C/2026/XX`, trois autres `MYS/MG2030/C/2027/XX`, et deux autres
`MYS/MG2030/W/2027/XX`. **Aucune contrainte d'unicité n'est posée** sur cette
colonne ; la clé fonctionnelle est `contract_code`, identifiant technique créé
pour le seed et **absent des documents projet**.
**Impact** : à l'attribution des numéros définitifs, il faudra soit poser
l'unicité, soit accepter qu'elle reste absente. À décider.

### 20. 🟡 [NOUVEAU] Marchés de fournitures numérotés 2027 mais lancés en 2029
`G-SC` et `G-SPORT` portent `MYS/MG2030/C/2027/XX` alors que leur publication
est prévue au 15/01/2029. L'année du numéro ne correspond ni à l'année de
publication ni à celle de signature.

### 21. 🟠 [NOUVEAU] Achèvements postérieurs à la marge terminale

Le seed pose deux jalons : `MS.1` début de la marge de 4 mois au **01/09/2029**
et `MS.2` fin des travaux au **01/01/2030**. Or :

| Marché | Achèvement | Position |
|---|---|---|
| `W-SC` (travaux SC, voie classique) | 12/09/2029 | **11 jours dans la marge** |
| `C-SC-SUP` (supervision SC) | 12/09/2029 | idem |
| `G-SC` / `G-SPORT` (fournitures) | 31/01/2030 | **30 jours après la fin des travaux** |
| `C-TA` (assistance technique) | 15/06/2030 | après les Jeux — attendu, la TA couvre la clôture |

Les deux premières lignes sont un vrai signal : dans la voie de droit commun, les
travaux du Student Center **consomment déjà une partie de la marge terminale**
avant même le moindre aléa. Les fournitures livrées après la fin des travaux
sont probablement une convention (installation pendant la marge), mais cela doit
être explicite.

### 22. 🟡 Date de démarrage projet incohérente
La cellule `C4` du fichier source fixe le démarrage au **30/07/2026** alors que
la première tâche démarre le **01/07/2026**.

### 23. 🟡 Rattachement des tâches aux marchés déduit des libellés
`tasks.csv` : `contract_code` a été déduit des intitulés. Les couples certains
sont renseignés (18 tâches sur 27), les autres laissés vides. À valider.

Trois tâches restent sans marché : `TV.1` et `SC.1` (« Schematic design », en
amont de tout marché) et `SC.2.1` (« Schematic design adjustments »).

### 24. 🟡 Libellés d'étape à normaliser
« TA + MYS validation » et « TA + MYS evaluation » désignent la même nature
d'étape et sont employés indifféremment. Ces libellés alimenteront les gabarits
de passation : à normaliser avant.

### 25. 🟡 Libellé trompeur `SC.2`
La ligne parente du scénario Design & Build est libellée « Detail Design », ce
qui est trompeur pour un marché de conception-réalisation.

### 26. 🟡 [NOUVEAU] Fourchette des lots de travaux TV supérieure aux estimations
Les 4 lots `W-TV-*` sont bornés à 1–2 M€ chacun, soit **4 à 8 M€** au total,
alors que la somme des estimations des 13 salles vaut **3 539 416 €**. L'écart
s'explique probablement par les espaces extérieurs (650 000 €) et les
tolérances, ce qui placerait le besoin à ~4,2 M€ — dans la fourchette basse.
À confirmer : ce n'est pas une incohérence, mais la borne haute (8 M€) est plus
du double du besoin estimé.

### 27. 🟡 Orthographe « Hasan Prishtina »
« Hasan Pristina » au BPR 5.3.1 et 5.4, « Hasan Prishtina » au budget.
La seconde graphie a été retenue.

---

## C. Ambiguïtés du brief

### 28. 🟠 `org_unit` sans données d'unité
Le brief §7 cite `org_unit` comme table, mais `piu_roles.csv` ne contient aucune
unité au-delà des postes eux-mêmes. `SCHEMA.md` modélise l'organigramme comme un
arbre de **postes** (un nœud par ligne de `piu_roles.csv`, relié par
`reports_to`).
**Question** : la PIU souhaite-t-elle des unités nommées (« cellule passation »,
« pôle technique ») ? Si oui, la donnée est à fournir.

### 29. 🔴 Affectation des 14 représentants sur site
Le brief §8 donne comme exemple de périmètre « un représentant sur site ne voit
que son établissement ». `piu_roles.csv` déclare bien 14 postes `SITEREP`, mais
**aucune source ne dit quel représentant couvre quel site**.
**Impact** : la politique RLS la plus visible du projet ne peut pas être testée
sur des données réelles. Les tests utiliseront un utilisateur fictif affecté à
`TV-FAIK`, ce qui valide le mécanisme mais pas la donnée.
**Qui** : PIU, à l'ouverture des comptes.

### 30. 🟠 Périmètre par lot inopérant pour les training venues
Conséquence des points 3 et 29 : un `SITEREP` affecté par **lot** ne résoudrait
aucun site pour les 4 lots `W-TV-*` (aucune ligne `lot_building`). L'affectation
des représentants doit donc se faire **par site**, pas par lot, tant que le
point 3 n'est pas résolu.

### 31. 🟠 Effectif : 30 comptes annoncés, 33 postes déclarés
Le brief §3 annonce « environ 30 comptes » puis détaille : 11 postes PIU +
**14 représentants sur site** + 3 AT + 5 AFD = **33**.
La différence tient-elle à des cumuls de fonction (un représentant occupant
aussi un poste PIU) ? À clarifier pour dimensionner l'administration des comptes.

### 32. 🟠 PIU et AT ont-elles les mêmes droits ?
Le brief §3 range les deux en « Contribution », sans les distinguer. Mais les
libellés du planning (« TA + MYS validation ») suggèrent une AT qui **valide**
conjointement. L'AT peut-elle créer un contrat ? Valider un livrable ?
La proposition de matrice (`SCHEMA.md` §11) donne à `TA` des droits larges en
écriture mais aucun droit de validation. **À confirmer.**

### 33. 🟠 Lecture documentaire multi-tags : union ou intersection ?
Le brief §7 dit « un document sans tag est visible de tous » mais ne traite pas
le cas d'un document portant **plusieurs** tags.
- **Union** (retenu) : un seul tag autorisé suffit. Cohérent avec le mot
  « autorisation », qui décrit un *octroi*.
- **Intersection** : tous les tags doivent être autorisés. Plus prudent en
  confidentialité, plus surprenant à l'usage.

Le choix change le comportement dès qu'un document croise `procurement` et
`environmental_social`. **À trancher avant le lot documentaire.**

### 34. 🟠 « Montant » d'un lot : valeur ou fourchette ?
Le brief §7 écrit « `lot` : montant, titulaire, chiffre d'affaires minimum
exigé » au singulier ; le seed porte des **fourchettes** min/max pour les lots
de travaux. `SCHEMA.md` conserve les deux bornes. À confirmer.

### 35. 🟠 Contradiction interne : notifications d'échéance sans ordonnanceur
Le brief §4 interdit les Edge Functions, le Realtime et les WebSockets. Le
brief §7 demande des notifications de « franchissement de jalon » et de
« retard ». Ces deux notifications sont des **états**, pas des événements :
personne ne « fait » l'action de dépasser une échéance. Il faut donc une
évaluation périodique. Trois voies :

| Voie | Coût | Remarque |
|---|---|---|
| **Vercel Cron** → route Next `/api/cron/…` | Inclus au plan Pro | La plus simple, cohérente avec la stack |
| `pg_cron` côté Supabase | Extension à activer | Contredit l'esprit de « pas d'Edge Functions » sans le violer littéralement |
| Calcul paresseux à la connexion | Nul | Pas de notification tant que l'utilisateur ne se connecte pas |

**Recommandation : Vercel Cron.** À valider.

### 36. 🟠 Contradiction interne : invitations sans fournisseur d'e-mail
Le brief §3 impose des comptes « sur invitation, sans inscription libre ». Le
brief §7 précise « pas d'envoi d'e-mail dans la première version : le
fournisseur reste à choisir ». Or l'invitation Supabase Auth **est** un e-mail.
Trois voies : utiliser le SMTP par défaut de Supabase (limité à 2 messages par
heure, insuffisant pour ouvrir 30 comptes), configurer un SMTP dès la version 1,
ou créer les comptes avec un mot de passe provisoire transmis hors ligne.
**À trancher avant le lot d'authentification.**

### 37. ✅ TRANCHÉ (19/08/2026) — Projet Supabase dédié ou partagé ?
**Décision : projet EXTERNAL (`grnkbnldfzdzrgleorra`, eu-west-3, Postgres 17.6),
partagé.** Toutes les tables et tous les types sont préfixés `mg2030_` ; les
fonctions RLS vivent dans un schéma `mg2030_private`, calqué sur le
`peebcoolsf_private` déjà en place.

Inspection du projet au 19/08/2026 : 29 tables dans `public`, dont 26 préfixées
`peebcoolsf_` et **3 non préfixées** — `buildings` (133 lignes), `profiles`
(11 lignes), `app_params`. Aucun type énuméré. Aucune table `mg2030*`.

> La table `buildings` existante confirme que le préfixe n'est pas une
> précaution de style. `site`, `contract`, `document`, `tag`, `task`, `plan`,
> `folder`, `permission` et `notification` sont autant de noms qu'un futur
> module poserait naturellement.

**Cette décision fait apparaître le point 52**, qui devient le principal risque
de sécurité du projet.

### 38. 🟡 Suppression : dure ou logique ?
Le brief demande un « historique applicatif simple » sans valeur probante.
`change_log` enregistre une suppression mais ne permet pas de restaurer la
ligne. `SCHEMA.md` retient un **soft delete** (`archived_at`) sur le référentiel
et les tâches. À confirmer.

### 39. 🟡 Marge terminale : portée par le scénario ou par les jalons ?
Le brief §7 demande que `schedule_scenario` porte la variante **et** la marge.
Le seed matérialise la marge en deux **jalons** (`MS.1`, `MS.2`) rattachés au
plan `TV` / scénario `base`. Les deux représentations coexistent dans
`SCHEMA.md`. Laquelle fait foi si elles divergent ?
Accessoirement, `MS.1` et `MS.2` sont des jalons de **projet**, pas de plan :
les rattacher au plan `TV` est un artefact de l'extraction.

### 40. ✅ TRANCHÉ (19/08/2026) — Langue albanaise : quel code de locale ?
**Décision : `sq`.** Fichiers `messages/en.json` et `messages/sq.json` ;
`mg2030_app_user.locale` contraint à `('en','sq')`.

### 41. ✅ TRANCHÉ (19/08/2026) — Fuseau horaire et format de date
**Décision : recommandation retenue.** Stockage en UTC (`timestamptz`),
affichage en `Europe/Belgrade` (fuseau de Pristina), format `dd/mm/yyyy` en
anglais comme en albanais. Les dates de planning restent en `date` pur, sans
heure ni fuseau.

### 42. ✅ TRANCHÉ (19/08/2026) — Devise unique et régime fiscal
**Décision : euros hors taxes uniquement.** Aucune colonne TTC, aucune colonne
de TVA au schéma.

> À noter pour l'interface : le plan de passation annonce ses montants
> « inclusive of tax », alors que les valeurs chargées viennent du budget projet
> (BPR 7.7), qui est HT. Les libellés de montant doivent donc porter la mention
> « HT » explicitement, sans quoi un lecteur du plan de passation croira lire du
> TTC. Pour mémoire : coût total projet 70 920 373 € HT / 83 686 040 € TTC.

### 43. 🟡 Étendue de l'historisation
« Historique simple des écritures » : sur quelles tables ? `SCHEMA.md` propose
de poser le trigger sur les 15 tables métier et de l'omettre sur les tables
techniques (`notification`, `change_log` elle-même, `document_tag`). À confirmer.

### 44. ✅ TRANCHÉ (19/08/2026) — Politique de reprise : dates gelées ou recalculées ?
Question directement issue du point 12. Deux régimes possibles au chargement :
- **Gel** : on importe les dates du fichier Excel telles quelles et le moteur ne
  recalcule qu'à la première modification. L'anomalie d'un jour survit, mais
  rien ne bouge à l'import.
- **Recalcul** : le moteur recalcule tout dès l'import. Le planning devient
  cohérent, mais 12 dates changent silencieusement par rapport à l'Excel que la
  PIU connaît.

**✅ Décision du 19/08/2026 : recalcul.** Combinée à la décision du point 12,
elle est sans risque — le recalcul devient l'identité, aucune date ne bouge, et
on démarre sur un planning dont on a prouvé la cohérence. C'est le seul chemin
qui donne les deux garanties à la fois.

---

## D. Charte UI et stack

### 45. 🟡 Aucune bibliothèque de composants incompatible
Le brief §5 demande de signaler toute incompatibilité. **Il n'y en a aucune** :
le dépôt de charte est déjà en Next 16 / React 19 / Tailwind v4 / Supabase, sans
bibliothèque UI. Voir `UI_TOKENS.md` §9.

### 46. 🟠 La couleur d'accent est celle du prestataire
`--accent: #E30513` est le rouge de la charte **Assemblage**, le prestataire.
Le transposer tel quel ferait porter l'identité visuelle du prestataire à une
plateforme du ministère kosovar.

**Proposition (19/08/2026), à confirmer** — valeurs **exactes** relevées sur le
fichier vectoriel officiel de l'emblème de la République du Kosovo, fourni et
versionné dans `assets/logos/kosovo-emblem.svg` :

| Token | Valeur | Origine dans l'emblème |
|---|---|---|
| `--accent` | **`#034ea2`** | Champ et contour (bleu) |
| `--accent-2` | **`#d0a650`** | Bordure et carte du Kosovo (or) |

Le logo *Mediterranean Games Prishtina 2030* reprend la même famille (bleu
institutionnel + or), ce qui rend la substitution cohérente — ses valeurs
exactes restent à relever sur le vectoriel, non encore fourni (point 49).

### 47. ✅ RÉSOLU PAR LA DÉCISION 46 — Pas de token `--danger`
L'accent cessant d'être rouge, l'erreur ne peut plus le réutiliser : `--danger`
passe de « souhaitable » à **nécessaire**. Valeur proposée : `#c0392b`, distincte
du rouge Assemblage (`#E30513`) et du pastel « en retard » (`#ea9999`).

### 48. 🟡 Aucun style de champ en erreur dans la charte
Le dépôt source affiche les erreurs en bandeau sous le formulaire, jamais sur le
champ. Pour un outil de **saisie** dont le critère de succès est la vitesse
(brief §2), un retour au niveau du champ est nécessaire. À concevoir.

### 49. 🟠 PARTIELLEMENT RÉSOLU (19/08/2026) — Logos

| Logo | Statut |
|---|---|
| République du Kosovo (maître d'ouvrage) | ✅ **Fourni**, vectoriel, versionné dans `assets/logos/kosovo-emblem.svg` |
| AFD (bailleur) | ✅ Repris du dépôt de charte (`afd.png`) |
| Assemblage + sigle `.A` | ✅ Repris du dépôt de charte |
| **XXI Mediterranean Games Prishtina 2030** | ⚠ **Manquant en vectoriel.** Seule une image matricielle est disponible ; ses codes couleur ne peuvent pas en être relevés de façon fiable, et un PNG basse définition ne tiendra pas dans un header à deux hauteurs (`h-[40px]` / `sm:h-[44px]`) |

### 50. 🟠 Arbitrage de la bibliothèque Gantt à rendre
Le brief §10 demande un comparatif avant toute installation. Il n'est pas encore
produit — c'est le premier livrable du lot 1 (`PLAN.md`).

> Élément déjà acquis : le dépôt de charte contient **un Gantt SVG développé en
> interne, en production**, avec échelles semaine / mois / trimestre, jalons,
> liens, et export SVG / PNG / PDF, pour ~3 600 lignes et **zéro dépendance**.
> L'option « rendu interne » du brief n'est donc pas théorique.

### 51. 🟡 Charte sans internationalisation
Tous les libellés du dépôt source sont en espagnol, en dur dans les composants.
Le brief §6 impose l'inverse dès le premier composant. La charte fournit les
*styles*, jamais les *chaînes*.

### 52. 🔴 [NOUVEAU] `auth.users` est partagé avec PEEB Cool Santa Fe

**Conséquence directe de la décision 37, et principal risque de sécurité du
projet.**

Le projet EXTERNAL héberge déjà PEEB Cool Santa Fe. `auth.users` y compte
**12 comptes**. Ces comptes obtiendront un JWT valide portant le rôle Postgres
`authenticated` **sur la base MG2030** : c'est la même instance.

**`to authenticated` ne signifie donc pas « utilisateur MG2030 ».** Une seule
politique écrite `using (true) to authenticated` ouvrirait toutes les données du
projet kosovar aux 12 comptes argentins — et réciproquement.

Trois obligations, toutes intégrées à `SCHEMA.md` §1 et §10 :

1. **Aucune politique `using (true)`**, jamais, sur aucune table `mg2030_*`.
   Toutes passent par `mg2030_private.is_member()`, qui exige une ligne dans
   `mg2030_app_user`.
2. **Un quatrième utilisateur fictif** aux tests RLS : un compte PEEB réel, qui
   doit lire **zéro ligne** sur les 29 tables. C'est le test le plus important
   du lot 3.
3. **Un garde-fou structurel** : une requête sur `pg_policies` qui **échoue** si
   une politique `mg2030_*` ne mentionne ni `is_active_user()` ni
   `is_platform_admin()`. Il empêche qu'une politique écrite plus tard, par
   distraction, rouvre la brèche.

**Effet de bord sur l'expérience utilisateur.** Sur PEEB, un compte sans profil
est « en attente de validation ». Sur MG2030, un compte peut être *légitimement
étranger à l'application*. Le message doit être **« ce compte n'a pas accès à
MG2030 »**, pas « en attente » — sinon 12 utilisateurs de Santa Fe attendront
une validation qui ne viendra jamais.

**Point symétrique à vérifier hors de ce périmètre** : les comptes MG2030
apparaîtront dans `auth.users` sans ligne `peebcoolsf_perfiles`. Le comportement
de PEEB Santa Fe face à ces comptes est à contrôler avant l'ouverture des accès.

---

### 53. 🔴 [NOUVEAU — corrigé le 19/08/2026] Une politique `FOR ALL` élargit la lecture

Défaut introduit puis corrigé pendant le lot 3, consigné parce qu'il se
reproduira si personne ne sait pourquoi la règle existe.

**Le mécanisme.** En Postgres, une politique `FOR ALL` couvre aussi le `SELECT`,
et les politiques permissives s'additionnent en **OU**. Une politique
d'*écriture* `FOR ALL` dont la clause `USING` est plus large que celle de
*lecture* élargit donc silencieusement la lecture — sans que rien ne le signale.

**Ce qui a été constaté.** Le représentant sur site affecté à `TV-FAIK` lisait
correctement 1 site sur 14, 1 bâtiment, et 19 tâches sur 27 (les 8 tâches du
marché Design & Build lui étant masquées). Mais il lisait **19 précédences sur
19**, au lieu des 12 dont les deux extrémités sont dans son périmètre. Sa
politique d'écriture `mg2030_task_dependency_write` était `FOR ALL` avec
`USING (can_write() and has_perm('task.write'))` — sans contrôle de périmètre —
et son `USING` s'ajoutait en OU à celui de la lecture.

Quatre tables étaient touchées : `task_dependency`, `task_constraint`,
`no_objection`, `deliverable`. Une précédence visible révèle l'existence d'une
tâche hors périmètre : c'est bien une fuite, pas une gêne d'affichage.

**Le correctif.** On n'a pas rapiécé les quatre cas : la classe de problème est
supprimée. Toute politique d'écriture est désormais exprimée en `INSERT` /
`UPDATE` / `DELETE` explicites, de sorte que le `SELECT` n'est gouverné que par
la politique de lecture. Les 26 politiques `FOR ALL` ont été remplacées par 78
politiques explicites.

**Le garde-fou.** `mg2030_private.check_policy_guardrail()` refuse désormais
deux choses, et doit toujours renvoyer zéro ligne :
1. une politique `mg2030_*` sans contrôle d'appartenance (point 52) ;
2. **toute** politique `FOR ALL` sur une table `mg2030_*`.

**Pourquoi c'est passé inaperçu à l'écriture.** Le patron « une politique de
lecture, une politique d'écriture `FOR ALL` » est le plus répandu dans la
documentation et les exemples. Il est correct tant que la clause `USING`
d'écriture est au moins aussi restrictive que celle de lecture — condition
vraie sur les tables du référentiel, où le périmètre figure des deux côtés, et
fausse partout où l'écriture ne dépend que d'une permission.

---

### 54. 🟠 [NOUVEAU — 19/08/2026] Les notifications d'état exigent une clé de service

**Le problème.** Le brief §7 demande des notifications de « franchissement de
jalon » et de « retard ». Ce sont des **états**, pas des événements : personne
ne fait l'action de dépasser une échéance. Il faut donc une évaluation
périodique, déclenchée par un ordonnanceur — qui n'a **pas de session
utilisateur**. Sans session, `auth.uid()` est nul, la RLS masque tout, et le
travail verrait zéro ligne.

Constaté en écrivant la route : une première version utilisait le client à
session applicative. Elle n'aurait rien fait, silencieusement.

**La décision.** Une clé de service est introduite, **pour cette seule route**.
Le brief §8 interdit de remplacer la RLS par du filtrage applicatif *pour
l'accès des utilisateurs* ; ici l'acteur n'est pas un utilisateur mais un
travail système, qui n'expose aucune donnée — sa réponse ne contient que des
compteurs.

**Les garde-fous**, parce qu'une exception non gardée devient la règle :

| Garde-fou | Effet |
|---|---|
| `npm run check:service-key` | **Échoue le build** si un fichier autre que `lib/supabase/service.ts` et `app/api/cron/schedule-checks/route.ts` mentionne la clé, le client de service ou `service_role` |
| `CRON_SECRET` | La route refuse tout appel sans le secret partagé |
| Absence de préfixe `NEXT_PUBLIC_` | La clé ne peut pas atteindre le navigateur |
| Réponse sans données | Seuls des compteurs sortent, même avec le secret |

**Ce qui reste à faire** : renseigner `SUPABASE_SERVICE_ROLE_KEY` et
`CRON_SECRET` dans l'environnement Vercel. Sans elles, la route renvoie 503 et
le reste de l'application fonctionne normalement.

**Effet de bord du point 8** : aucune tâche du seed ne porte de responsable, et
aucun livrable n'est chargé. Le premier passage du cron ne produira donc
**aucune** notification. C'est correct, pas une panne.

---

## E. Points fermés — aucune action requise

Consignés pour éviter qu'ils ne soient rouverts.

| Point | Statut |
|---|---|
| Conversion `jours = semaines × 7` | **Confirmée** par le fichier source (nom défini `week` = 7) et vérifiée sur 21/21 tâches |
| Gestion des convergences (`MAX` de plusieurs prédécesseurs) | **Confirmée** : `TV.2.4` et `SC.2.5` ont deux prédécesseurs. Vérifiée sur 17/17 dépendances |
| Sémantique des types de tâche | **Confirmée** : `summary` agrège (3/3), `group_header` n'agrège pas (`TV.3` sans dates alors que ses enfants couvrent 18 mois) |
| Concordance planning / plan de passation | **Confirmée au jour près** sur 8 jalons ; un seul écart (point 13) |
| Sommes des estimations de bâtiments | **Confirmées** : 37 218 706 € au Student Center, 3 539 416 € aux training venues, à 2 € près des documents (arrondis) |
| Lignes exclues du fichier Excel | **49 lignes** dans `excluded_rows.csv`, motivées une par une. Non chargées, conservées comme preuve |
| Écarts déjà relevés par les README du seed | Repris ci-dessus, aucun n'a été corrigé silencieusement |

---

## F. Ce qu'il faut trancher pour démarrer

### Tranché le 19/08/2026 — les lots 1 et 2 peuvent démarrer

| Point | Décision |
|---|---|
| 12 — durée de `TV.2.1` / `SC.2.2` | **20 jours** |
| 37 — projet Supabase | **EXTERNAL, partagé, préfixe `mg2030_`** |
| 40 — locale albanaise | **`sq`** |
| 41 — fuseau et format | UTC / `Europe/Belgrade` / `dd/mm/yyyy` |
| 42 — devise | **HT uniquement** |
| 44 — politique de reprise | **Recalcul** |

### 55. 🔴 [NOUVEAU — corrigé le 20/08/2026] Le diagramme n'avait pas la place d'exister

Constaté en chargeant la production dans un navigateur, à 1590 px : la grille
de saisie occupait **986 px** et le diagramme **306**. Sur un portable de
1440 px il ne restait que 160 px pour 2884 px de contenu. Le plan de charge
« sur une même page » existait donc dans le code, pas à l'écran.

**Corrigé** : jeu de colonnes réduit par défaut — activité, durée, début, fin —
soit 616 px de grille et ~990 px de diagramme, avec un lien « toutes les
colonnes » pour les séances de saisie. Le choix passe par l'URL.

Deux défauts d'alignement sont tombés avec : les cellules de ligne
rétrécissaient par débordement flex (la corbeille occupait 26 px que l'en-tête
ne comptait pas), et les colonnes masquées restaient dans la navigation au
clavier — Tab entrait dans une cellule invisible.

**Vérifié après correction** : 0 ligne sur 17 en écart avec l'en-tête,
en-tête à 44 px, pas de 28 px, barres du diagramme centrées ligne à ligne.

### 56. 🔴 [NOUVEAU — corrigé le 20/08/2026] Un sélecteur ouvert sans focus ne se refermait plus

En ouvrant la cellule « responsable » et en lisant `document.activeElement` :
le sélecteur s'affichait mais restait **sans focus**. Ni Échap ni la sortie au
clavier ne le fermaient — il fallait choisir quelqu'un pour s'en sortir.

Cause : le champ texte recevait son focus explicitement par une ref, le
sélecteur s'en remettait à `autoFocus`. Deux mécanismes pour un même rôle,
dont un seul fiable.

**Corrigé** : la cellule donne le focus au premier élément focalisable de son
éditeur, et gère Échap et la sortie **au niveau du conteneur** — un éditeur qui
oublierait de les traiter reste refermable.

### 57. 🟠 [NOUVEAU — corrigé le 20/08/2026] L'ancre contractuelle calait le début, non la fin

Défaut du moteur d'instanciation, trouvé en calculant à la main la chaîne de
C-TA : une étape ancrée sur la date de **signature** commençait à la signature.
« Négociation + avis AFD » démarrait donc le jour où le marché était déjà signé.

**Corrigé** : les ancres sont typées. Un avis de publication ouvre une période
(ancre de début) ; une ouverture des plis, une signature, un achèvement sont
des événements **terminaux** (ancre de fin).

Découverte au passage : le planning porte **deux** séquences réellement
distinctes, pas une. Sélection de consultant (C-TV-DD : 21/14/10/42/14/28) et
appel d'offres travaux, ouvert et sans avis préalable (TV.3.1 : 56/14/28).
Deux gabarits sont donc proposés, durées **relevées** et non estimées.

### 58. 🟠 [NOUVEAU — corrigé le 20/08/2026] L'accueil montrait le plan de développement

La page d'accueil listait les lots de développement, « lot 1 en cours ». Juste
le premier jour, faux ensuite : la PIU y lisait un état de projet là où
figurait un plan de travail.

**Corrigé** : les chiffres réels du projet, comptés en base, chacun cliquable
vers son écran, avec l'échéance des Jeux en jours restants. Le tableau de bord
consolidé reste hors périmètre de la version 1 (brief §9) — cette page compte,
elle n'agrège pas.

### 59. 🟠 [NOUVEAU — corrigé le 20/08/2026] Rôle et périmètre ne se réglaient que par SQL

L'écran d'administration affichait le rôle fonctionnel et le périmètre sans
permettre de les changer. Aucune action n'existait pour le rôle ;
`setUserScope` était morte depuis le premier jour. Avec une trentaine de
comptes à ouvrir, cela signifiait une trentaine de requêtes à la main.

**Corrigé**. Un garde-fou ajouté : seuls les rôles de l'organisation du compte
sont proposés, et l'action refuse les autres — la base les accepterait, mais le
compte hériterait de permissions conçues pour un autre corps de métier.

### 60. 🟠 [NOUVEAU — corrigé le 20/08/2026] La langue ne se choisissait qu'après connexion

L'écran de connexion n'offrait aucune bascule de langue, et aucun logo
institutionnel. Les utilisateurs sont une trentaine d'agents du ministère à
Prishtina : leur demander de se connecter en anglais pour découvrir ensuite
qu'un albanais existait prenait le problème à l'envers.

**Corrigé**, ainsi que trois défauts de saisie mobile relevés au même audit :
champs à 14 px (Safari iOS zoome sous 16 px et ne dézoome pas), cibles
tactiles à 36–38 px contre 44 recommandés, et trois contrôles de filtre
portant le même libellé « Whole project » pour trois sens différents.

### 61. 🔴 [NOUVEAU — 20/08/2026] Le plan entier n'existe dans aucun scénario

Relevé en base pendant l'audit : le scénario `base` porte les 15 tâches
training venues et les 2 jalons transverses ; les 10 tâches du Student Center
vivent dans `design_build`. Aucun scénario ne montre le projet entier, alors
que le filtre affiche « Whole project ».

Ce n'est pas un défaut de code mais une conséquence du chargement : les deux
sous-projets ont été rangés dans deux scénarios. **Arbitrage à rendre** — faut-il
un scénario de référence portant les deux sous-projets, les tâches de scénario
restant les variantes ? Sans lui, personne ne verra jamais le calendrier
complet sur un seul écran.

### 62. 🟠 [NOUVEAU — 20/08/2026] Un seul compte existe

L'affectation des responsables fonctionne — vérifié à l'écran, la liste se
peuple — mais elle ne contient qu'un nom. Les 12 tâches sans responsable ne
peuvent donc recevoir aucune alerte de retard, non par défaut technique mais
faute de destinataires. Les quelques trente comptes de la PIU restent à ouvrir
(docs/ADMIN.md).

### 63. 🔴 [NOUVEAU — décidé le 21/08/2026] Inscription libre, contre le brief §3

Le brief §3 prévoyait des comptes créés à la main par un administrateur, sans
inscription libre. **Décision du 21/08/2026 : l'inscription est ouverte.** Ouvrir
une trentaine de comptes à la main s'est révélé impraticable, et le point 36
— « mode d'invitation sans fournisseur d'e-mail » — n'avait pas d'autre réponse.

**La sûreté ne change pas.** S'inscrire crée un compte d'AUTHENTIFICATION,
jamais un membre. Toute la RLS passe par `mg2030_private.is_member()`, qui
interroge `mg2030_app_user` : sans ligne dans cette table, un compte lit zéro
ligne sur les 30 tables. Le test [1] de la campagne RLS le vérifie déjà avec un
compte réel de l'autre application.

**Conséquence à surveiller.** `auth.users` est partagé (point 52), et la page
d'inscription est publique : n'importe qui peut créer un compte
d'authentification dans le projet Supabase commun. Aucune donnée n'est
atteignable, mais la table `auth.users` se remplit. **Deux garde-fous à régler
dans Supabase** : exiger la confirmation par e-mail, et restreindre les domaines
autorisés si l'AFD ou le MYS l'exigent.

### 64. 🟠 [NOUVEAU — 21/08/2026] Brevo n'est pas configuré

L'envoi vers `louis@assemblage.net` et `clement@assemblage.net` est écrit et
appelé, mais `BREVO_API_KEY` et `BREVO_SENDER_EMAIL` ne sont pas renseignés sur
Vercel — seules les deux variables Supabase le sont.

**Aucun blocage** : un échec d'envoi ne fait pas échouer l'inscription. La
demande est écrite en base d'abord, et se lit dans l'écran des comptes ;
l'e-mail n'est qu'une notification. Tant que la clé manque, il faut ouvrir
l'écran des comptes pour voir qui attend.

### 65. 🟠 [NOUVEAU — corrigé le 21/08/2026] Une dépendance ne déplaçait pas le successeur

L'ancre saisie à la main prime sur les prédécesseurs dans le moteur — c'est sa
raison d'être. Conséquence non vue : relier deux tâches dont la seconde portait
déjà une date épinglée faisait apparaître la flèche **sans rien déplacer**. Le
fin-début n'était vrai qu'en apparence.

**Corrigé** : poser une précédence libère l'épingle. Détacher ne la remet pas.
Trois tests couvrent la règle, dont celui qui vérifie qu'on ne touche pas à
l'ancre des autres tâches.

### 66. 🟡 [NOUVEAU — corrigé le 21/08/2026] Le filtre par site ne discriminait rien

Ajouté le 20/08, retiré le 21/08. Aucune tâche ne désigne de hall précis
(`site_id` nul sur toutes), si bien que le filtre ne pouvait rien retenir que
son sous-projet ne retienne déjà. La colonne éditable partait avec lui.

Le rattachement d'une tâche à un site reste possible en base ; il redeviendra
utile le jour où la PIU décomposera hall par hall. C'est alors qu'il faudra
remettre la colonne, pas avant.

### 67. 🔴 [NOUVEAU — corrigé le 21/08/2026] Quatre requêtes visaient une colonne inexistante

`mg2030_app_user.id` EST l'identifiant Supabase Auth — la table n'a pas de
colonne `auth_user_id` séparée (elle en a une sur `mg2030_access_request`
seulement, où elle est légitime). Le code écrit le 21/08 pour les demandes
d'accès et pour les avis AFD interrogeait `mg2030_app_user` avec
`.eq("auth_user_id", …)`, qui ne matchait jamais rien, et insérait un champ
`auth_user_id` qui n'existe pas sur cette table.

**Trouvé en diagnostiquant le blocage de louis@assemblage.net** — voir le
point 68. Aucun test ne l'avait couvert : les requêtes Supabase ne sont pas
typées sur les noms de colonnes, l'erreur ne se voit qu'à l'exécution.

**Corrigé** dans les quatre fichiers concernés.

### 68. 🔴 [NOUVEAU — corrigé le 21/08/2026] L'inscription se taisait pour une adresse déjà enregistrée

`louis@assemblage.net` possédait déjà un compte `auth.users` — créé le
16/06/2026, confirmé, jamais membre de MG2030 (`auth.users` est partagé avec
l'autre application du projet, point 52). En essayant de créer un compte
MG2030 avec cette même adresse, Supabase répond **sans erreur et sans
session**, pour ne pas révéler qu'une adresse est déjà enregistrée :
`data.user.identities` est un tableau vide. Le code ne vérifiait pas ce
tableau et affichait « vérifiez vos e-mails » — un e-mail qui n'arriverait
jamais, puisqu'aucune inscription n'avait réellement eu lieu.

**Corrigé** : ce cas précis affiche désormais « cette adresse a déjà un
compte », avec un lien vers la connexion. Sur une plateforme fermée à une
trentaine de personnes, le dire est utile et ne révèle rien qu'un
administrateur ne sache déjà.

### 69. 🟠 [NOUVEAU — corrigé le 21/08/2026] Aucun moyen de se déconnecter une fois membre

`SignOutButton` n'existait que sur les écrans de refus (compte en attente,
compte étranger). Un membre pleinement actif n'avait strictement aucun moyen
de se déconnecter depuis l'application.

**Corrigé** : un menu de compte dans le header (nom, e-mail, rôle,
déconnexion), pour tout utilisateur authentifié.

### 70. 🟠 [NOUVEAU — 21/08/2026] La réinitialisation de mot de passe renvoie vers PEEB

Constaté par louis@assemblage.net : le lien de récupération reçu par e-mail
menait à une page de PEEB Cool Santa Fe, pas à MG2030 — et le mail lui-même
est signé « Mael » / « PEEB Jordan ».

**Cause : le service d'e-mail de Supabase Auth a une configuration UNIQUE pour
tout le projet**, partagée entre MG2030 et PEEB (conséquence directe du
point 52). Deux réglages en jeu, à des niveaux différents :

  1. **Le lien de redirection.** Supabase refuse silencieusement une URL de
     redirection absente de sa liste blanche (Authentication → URL
     Configuration → Redirect URLs) et retombe sur l'URL par défaut du
     projet, réglée pour PEEB. **Corrigible en ajoutant
     `https://mg2030.vercel.app/**` à cette liste** — action de tableau de
     bord, hors de portée des outils de ce dépôt.

  2. **L'expéditeur et le gabarit du mail** (« Mael » / « PEEB Jordan») sont
     un réglage de projet, pas d'application : les deux applications
     partagent le même expéditeur SMTP. Le changer changerait aussi ce que
     voient les utilisateurs de PEEB.

**Décision du 21/08/2026 : ne pas toucher à l'expéditeur pour l'instant.**
Le point 1 seul résout la destination du lien, qui était le blocage réel. La
séparation complète de l'expéditeur exigerait soit de renommer un réglage
commun aux deux applications, soit de faire émettre les e-mails
d'authentification par MG2030 lui-même via l'API d'administration Supabase et
Brevo — ce qui suppose la clé de service, gardée confinée à deux fichiers
(GAPS 54). Revenir sur ce point si la confusion de marque devient gênante en
pratique.

### 71. ✅ [RÉSOLU le 22/08/2026] Coordonnées des 14 sites

Les points 1 et 2 signalaient `address`, `latitude` et `longitude` vides sur
les 14 sites — bloquants pour un module carte. La cartographie
`Carte Pristina / All locs.pdf` porte les coordonnées des 14 lieux, et la
correspondance avec la base est **sans ambiguïté** : chaque lieu de la carte a
exactement un site homonyme.

Chargées le 22/08/2026. Emprise obtenue : 42,641 à 42,678 N et 21,141 à
21,180 E, soit environ 4 km sur 3 km centrés sur Pristina — cohérent avec le
périmètre annoncé. `source` porte la trace du document d'origine.

**`address` reste vide** : la carte donne des points, pas des libellés
postaux. Ce n'est pas bloquant pour une carte, qui se trace sur les
coordonnées.

### 72. ✅ [RÉSOLU le 22/08/2026] Composition des lots de travaux

Le point 3 restait ouvert : les sources ne disent pas quels halls composent
chacun des quatre lots `W-TV`. Les libellés annoncent « Lot 1 (3 venues) » à
« Lot 4 (4 venues) » — 3+3+3+4 = 13 — mais la répartition nominative n'existe
dans aucun document.

**Ce n'est pas une donnée à retrouver, c'est un arbitrage de la PIU.** D'où
une saisie à la main, depuis la ligne de lot de l'écran des marchés : les
bâtiments groupés par site, avec un compteur qui confronte ce qui est coché à
ce que le libellé annonce, sans jamais l'imposer.

**Un bâtiment peut appartenir à plusieurs lots**, et c'est normal : le même
hall relève d'un lot de travaux et d'un lot d'équipement, qui sont deux
marchés distincts. Ce qui serait une faute, c'est deux lots du **même**
marché — le même ouvrage payé deux fois. L'écran le signale sans l'interdire :
la PIU peut avoir une raison que nous ignorons, et une règle technique n'a pas
à trancher un arbitrage d'allotissement.

État au 22/08/2026 : les lots du Student Center sont composés (12 et 11
bâtiments, soit les 23 du site) ; **les quatre lots `W-TV` restent à
composer**.

### 73. ✅ [RÉSOLU le 25/08/2026] Carte des sites — hors périmètre v1, implémentée à la demande

Le brief §9 liste la carte parmi les modules **hors périmètre de la version 1**
(phase 2, avec le tableau de bord consolidé). **Décision du 25/08/2026 :
implémentée quand même**, à la demande explicite, une fois les 14 sites
géolocalisés (point 71).

**Seule dépendance externe de toute l'application**, et c'est un choix
délibéré, pas un relâchement de la règle. Le brief §4 proscrit toute
dépendance lourde sans validation préalable — c'est pourquoi le Gantt et le
plan de charge sont du SVG fait main plutôt qu'une bibliothèque de graphes.
Pour une carte, l'arbitrage inverse a été posé EXPLICITEMENT : un semis de
points sans fond réel (sans rues, sans repères de Pristina) aurait perdu
l'essentiel de ce qui rend une carte utile. Leaflet (~40 Ko) et les tuiles
OpenStreetMap ont donc été retenus, après une question directe à l'utilisateur
plutôt qu'un choix pris seul.

**Conséquence à noter** : chaque affichage de `/map` charge des tuiles depuis
`tile.openstreetmap.org`, un service tiers. Aucune donnée du projet n'y est
envoyée au-delà de ce que révèle la zone de carte demandée (une empreinte
Pristina, sans identifiant), mais c'est la première fois que l'application
dépend d'un service externe pour son affichage plutôt que pour son
authentification ou son stockage.

### Reste ouvert, par ordre de blocage

| # | Point | Pourquoi maintenant | Bloque |
|---|---|---|---|
| 1 | **46** — couleur d'accent : confirmer `#034ea2` / `#d0a650` | Conditionne les tokens, donc le premier composant | Lot 1 |
| 2 | **49** — logo *Prishtina 2030* en vectoriel | Le header ne peut pas être finalisé sans lui | Lot 1 |
| 3 | **50** — arbitrage Gantt | À rendre avant toute installation (brief §10) | Lot 1, puis 10 |
| 4 | **11** — matrice rôle × permission | Sans elle, seul l'administrateur peut écrire | Lot 3 |
| 5 | **33** — tags : union ou intersection | Conditionne la RLS documentaire | Lot 3, puis 11 |
| ~~6~~ | ~~**36** — mode d'invitation~~ | **Réglé le 21/08/2026** par l'inscription libre (point 63) | — |
| ~~7~~ | ~~**3** — composition des lots~~ | **Saisissable depuis le 22/08/2026** (point 72). Reste à renseigner par la PIU | — |
| 8 | **9** — décomposition en tâches de `design_bid_build` | Conditionne la voie de droit commun | Lot 9 |
| 9 | **61** — un scénario portant les deux sous-projets | Sans lui, le calendrier complet n'est visible sur aucun écran | Exploitation |
| 10 | **62** — ouverture des ~30 comptes PIU | Sans eux, aucune alerte de retard n'a de destinataire | Exploitation |

> **Le point 52 n'attend aucun arbitrage** : c'est une contrainte technique
> découlant de la décision 37, déjà intégrée au schéma. Il figure ici pour
> mémoire, parce qu'il conditionne le critère de fin du lot 3.
