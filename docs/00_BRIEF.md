# Brief de développement — Plateforme de suivi MG2030

> À placer à la racine du dépôt sous `docs/00_BRIEF.md`.
> À la première session Claude Code, coller le bloc « Message d'amorçage » en fin de document.

---

## 1. Contexte

Le Ministère de la Jeunesse et des Sports du Kosovo (MYS) met en œuvre un programme
d'infrastructures financé par l'AFD dans le cadre des Jeux Méditerranéens 2030 :
14 sites à Pristina, répartis en deux sous-projets.

- **Athletes' Village** : le Student Center de l'Université de Pristina, environ 13 bâtiments
  (8 dortoirs, administration, centre de santé, amphithéâtre, restaurant et cuisine,
  équipements sportifs et culturels), à réhabiliter, partiellement démolir et étendre,
  avec 3 nouveaux dortoirs et une piscine semi-olympique.
- **Training venues** : 13 salles d'éducation physique à réhabiliter (la salle FEFS de
  l'Université et 12 salles d'écoles primaires et secondaires).

La mise en œuvre est assurée par une PIU (Project Implementation Unit) de 11 postes,
appuyée par une Assistance Technique (AT), sous supervision de l'AFD.
L'échéance des Jeux est non négociable.

## 2. Objectif de la plateforme

Outil de **suivi** du projet, alimenté par la PIU elle-même. Ce n'est **pas** un outil
d'archivage probant ni un système d'audit : pas de chaîne de preuve, pas de versioning
documentaire complet, pas de journal immuable. Un historique applicatif simple suffit.

Il remplace un fichier Excel de planning aujourd'hui maintenu manuellement, qui sera
abandonné. La plateforme devient la source unique du planning de référence.

**Critère de succès déterminant** : si la saisie est plus lente que sous Excel, la PIU
retournera à Excel. L'ergonomie de saisie du planning primera toujours sur l'esthétique
des restitutions.

## 3. Utilisateurs

Environ 30 comptes au total, **tous internes**, sur invitation, sans inscription libre :

| Organisation | Effectif | Accès |
|---|---|---|
| PIU (MYS) | 11 postes + 14 représentants du maître d'ouvrage sur site | Contribution |
| Assistance Technique | 3 | Contribution |
| AFD | 5 | Lecture seule |

Les consultants et les entreprises **ne sont pas utilisateurs**. Leurs livrables et les
plaintes reçues sont saisis par la PIU ou l'AT à réception.

Rôles fonctionnels dans la PIU : Project Coordinator, Construction Specialist, Deputy
Construction Specialist, Procurement Specialist, Administrative and Financial Specialist,
Accountant, Monitoring Reporting and Evaluation Specialist, Environmental Social Health
and Safety Specialist, Legal Specialist, Communication Specialist, On-site Project Owner
Representative, plus un rôle Admin technique.

## 4. Stack imposée

- **Front et API** : Next.js (App Router), TypeScript, Tailwind. Déploiement Vercel (plan Pro).
- **Base et authentification** : Supabase (Postgres + Auth). RLS activée sur toutes les tables.
- **Fichiers** : Cloudflare R2 via API S3. Upload direct navigateur par URL pré-signée,
  jamais à travers une fonction serveur (limite de charge utile). Téléchargement par
  URL pré-signée à durée courte.
- **CI** : GitHub, déploiement automatique via l'intégration Vercel.

### Contraintes d'architecture

Volume documentaire cible : 10 à 50 Go. Environ 30 utilisateurs, trafic faible.

- Pas de Realtime Supabase, pas d'Edge Functions, pas de WebSocket.
- Pas d'optimisation d'images Vercel (quota de transformations coûteux). Servir les
  vignettes depuis R2.
- Server Components par défaut, `use client` uniquement là où c'est nécessaire.
- Pagination et filtres côté serveur sur toute liste susceptible de dépasser 100 lignes.
- Aucune dépendance lourde sans validation préalable.

## 5. Interface

**Étape obligatoire avant toute écriture d'interface.** Lire le dépôt local
`C:\Users\cleme\github\peeb-cool-santafe` et en extraire la charte :
palette et variables de couleur, typographies et échelle typographique, rayons,
ombres, espacements, style des boutons, champs, cartes, tableaux et états
(hover, focus, disabled, erreur).

Consigner le résultat dans `docs/UI_TOKENS.md`, puis me le soumettre avant de coder.
Reprendre les **tokens et le style**, pas nécessairement les mêmes dépendances :
si ce dépôt utilise une bibliothèque de composants incompatible avec la stack
ci-dessus, le signaler plutôt que de l'imposer.

## 6. Internationalisation

Anglais (par défaut) et albanais. Aucune chaîne de caractères en dur dès le premier
composant : toutes les libellés passent par les fichiers de traduction. Les contenus
saisis par les utilisateurs et les documents ne sont pas traduits. Langue de référence
de l'interface : l'anglais.

## 7. Modèle de données

À produire dans `docs/SCHEMA.md` avant les migrations, à partir des fichiers de
`seed/` et des documents de `docs/source/`. Structure attendue :

### Référentiel

- `site` : 14 enregistrements. Sous-projet, nom, institution bénéficiaire, latitude,
  longitude, adresse, statut d'occupation, représentant sur site.
- `building` : rattaché à un site. Zone (`residential` | `services_and_sports`),
  typologie, surface, nature d'intervention (réhabilitation, démolition, extension,
  construction neuve), estimation de travaux.
- `contract` : numéro au format `MYS/MG2030/{C|W|G|NC|DB}/{année}/XX`, intitulé,
  type de contrat, type de compétition (`NPC` | `IPC`), procédure
  (`REOI` | `IB` | `PQL+IB` | `RQ` | `DC`), méthode de sélection
  (`QCBS` | `QBS` | `FBS` | `LCS` | `lowest_evaluated_compliant_bid`),
  revue AFD (`prior` | `post`), montant estimé, montant contractualisé, titulaire,
  dates clés (publication SPN, ouverture des plis, signature, achèvement).
- `lot` : rattaché à un contrat. Montant, titulaire, chiffre d'affaires minimum exigé.
- `lot_building` : relation n:n entre lots et bâtiments.
- `org_unit` et `app_user` : organigramme PIU, rôle fonctionnel, organisation,
  périmètre d'accès (sous-projet, site, lot), rattachement hiérarchique.

### Moteur de planification (cœur du système)

Le calendrier global et le calendrier de passation sont **le même objet**. Ne pas
construire deux modules.

- `task` : hiérarchie parent/enfant sur profondeur arbitraire, date de début,
  durée en semaines et en jours, date de fin, responsable, valideur, avancement,
  rattachement optionnel à un contrat, un lot ou un site.
- **Durées en jours calendaires**, pas en jours ouvrés. Le fichier Excel existant
  compte 14 semaines pour 98 jours : la conversion est `jours = semaines x 7`.
  Toute autre convention casserait la reprise de l'historique.
- `task_dependency` : précédence fin-début avec décalage. Recalcul en cascade des
  dates lorsqu'une tâche amont glisse. C'est la seule valeur ajoutée réelle par
  rapport à Excel, donc à traiter en priorité et à couvrir par des tests unitaires.
  **Gérer les convergences** : une tâche peut avoir plusieurs prédécesseurs
  (ex. `start = MAX(fin_prédécesseur_1, fin_prédécesseur_2)`), pas seulement des
  chaînes linéaires.
- `task_constraint` : contrainte de date indépendante d'un prédécesseur
  (« ne peut pas démarrer avant telle date »), pour les tâches dont la date de
  départ est fixée en dur plutôt que déduite d'une dépendance.

**Fichiers de seed réels du planning** (`seed/tasks.csv`, `seed/task_dependencies.csv`,
`seed/task_constraints.csv`) : lire `seed/README_PLANNING.md` avant de construire le
schéma. Colonnes de `tasks.csv` : `wbs_code, plan_code, scenario, parent_wbs, task_type
(task|summary|milestone|group_header), group, activity, start_date, duration_weeks,
duration_days, end_date, contract_code, source_sheet, source_row`.

**Écart connu et volontairement non comblé.** Le planning fourni ne couvre que deux
scénarios : `base` (training venues) et `design_build` (Student Center en
conception-réalisation). Le scénario `design_bid_build` de `contracts.csv` — la voie de
droit commun, seule juridiquement acquise puisque le Design & Build repose sur une
dérogation — **n'a pas de planning exploitable dans le fichier source** (voir
`README_PLANNING.md`, point 1). Ne pas inventer de dates pour ce scénario. Charger le
schéma et les deux scénarios disponibles, laisser `design_bid_build` sans tâches, et le
signaler dans `docs/GAPS.md` comme donnée manquante bloquante avant que ce scénario
puisse être présenté à un utilisateur.

`seed/excluded_rows.csv` liste les lignes du fichier Excel volontairement écartées
(masquées, dupliquées ou obsolètes), avec le motif. Ne pas les charger, mais le fichier
sert de preuve que rien n'a été omis par erreur.
- `schedule_scenario` : variantes de planning. Le projet compare notamment une voie
  classique (conception détaillée puis appel d'offres travaux) et une voie
  Design & Build, avec une marge terminale (« buffer ») avant l'échéance des Jeux.
  Le modèle doit porter la variante et la marge, sinon la capacité d'arbitrage
  actuelle est perdue.
- `procurement_template` et `procurement_template_step` : séquences types par
  procédure, avec durée standard, responsable et valideur par étape. Étapes typiques
  d'une passation AFD : publication de l'avis, préparation des offres, ouverture des
  plis, évaluation par le comité, avis de non-objection AFD (NoN), négociation,
  signature. Créer un contrat instancie le gabarit et génère les tâches associées.
- `no_objection` : demandes de NoN, date d'envoi, date de réponse, statut, pièce liée.

### Livrables

- `deliverable` : contrat ou lot d'origine, émetteur, intitulé, date contractuelle,
  date de remise effective, statut de validation, visa. Sert au suivi des rapports
  des consultants comme des livrables des entreprises. Détection automatique des
  manquants et des retards.

### Documents

- `folder` : arborescence auto-référencée, modifiable par les administrateurs.
- `document` : dossier, clé de l'objet R2, taille, type MIME, auteur du dépôt,
  horodatage, description.
- `tag` et `document_tag` : tags paramétrables. Quatre tags initiaux :
  `procurement`, `technical_documentation`, `piu_admin`, `environmental_social`.
- `tag_access` : autorisation de lecture par tag et par rôle ou par utilisateur.
  Un document sans tag est visible de tous les utilisateurs authentifiés.

### Transverse

- `notification` : notifications applicatives par utilisateur (dépôt de document,
  franchissement de jalon, retard, plainte enregistrée). Pas d'envoi d'e-mail dans
  la première version : le fournisseur reste à choisir.
- `change_log` : historique simple des écritures (table, identifiant, champ,
  valeur avant, valeur après, auteur, horodatage). Sans prétention probante.

### Modules de phase 2 (à prévoir dans le schéma, à ne pas développer maintenant)

Suivi financier (engagements, avenants, décomptes, paiements), E&S (instruments de
sauvegarde, permis, non-conformités, incidents), deux registres de plaintes distincts
(réclamations de passation sous régime AFD, mécanisme de gestion des plaintes E&S
avec données personnelles cloisonnées), indicateurs de suivi-évaluation et génération
des rapports mensuels et trimestriels.

## 8. Droits d'accès

Trois dimensions, et **pas une de plus** : chaque dimension supplémentaire multiplie
les politiques RLS à écrire et à tester.

| Dimension | Détermine | Exemple |
|---|---|---|
| Organisation | Le mode d'accès | L'AFD est en lecture seule sur tout |
| Rôle fonctionnel | Les actions autorisées | Le Procurement Specialist crée un contrat, le Coordinator valide |
| Périmètre | Le champ des données | Un représentant sur site ne voit que son établissement |

Les tags gouvernent la lecture documentaire, indépendamment des trois dimensions.

Mise en œuvre par RLS Postgres, jamais par filtrage applicatif seul. Écrire un jeu de
tests SQL couvrant chaque politique avec trois utilisateurs fictifs (AFD lecteur,
Procurement Specialist, représentant sur site).

## 9. Périmètre de la version 1

Dans l'ordre. Ne pas entamer un module avant validation du précédent.

1. Socle : schéma, migrations, seed, authentification, gestion des utilisateurs et des rôles, RLS.
2. Référentiel : sites, bâtiments, contrats, lots, avec création et édition.
3. Moteur de planification : tâches, précédences, recalcul en cascade, gabarits de
   passation, variantes, marge terminale.
4. Restitution Gantt : groupement par jour, semaine, mois, trimestre. Vues filtrées
   (projet entier, un contrat, un site). Édition en ligne de type tableur sur la liste
   des tâches.
5. Bibliothèque documentaire : arborescence, tags, upload R2, droits de lecture.
6. Suivi des livrables et des retards.
7. Notifications applicatives, organigramme PIU, administration des référentiels.

Hors périmètre de la version 1 : tableau de bord consolidé, carte, synchronisation
Google Calendar, albanais complet (préparer l'infrastructure, une seule langue peuplée),
et tous les modules de phase 2.

## 10. Bibliothèque Gantt

Ne rien installer avant arbitrage. Comparer et me soumettre : les composants React
existants sous licence permissive, leur état de maintenance, et l'option d'un rendu
SVG développé en interne au-dessus du modèle de données. Pour 30 utilisateurs, l'option
interne est défendable et évite une dépendance lourde. Critères : licence, poids,
édition par glisser-déposer, affichage des liens de précédence, échelles multiples.

## 11. Méthode de travail attendue

1. Lire `docs/source/` et `seed/`, y compris chaque `README*.md` présent dans `seed/`
   (`README_SEED.md`, `README_PLANNING.md`), qui documentent les sources, les
   conventions et les écarts connus de chaque fichier. Puis lire le dépôt de charte UI.
2. Produire `docs/SCHEMA.md`, `docs/UI_TOKENS.md` et `docs/PLAN.md` (découpage en
   lots de travail). **Attendre ma validation avant toute migration.**
3. Ensuite seulement : migrations, seed, puis les modules dans l'ordre du point 9.
4. À chaque étape : vérifier que le build passe, que les données de seed s'affichent,
   et que les tests RLS passent.
5. Signaler explicitement tout point où le brief est ambigu, incohérent ou insuffisant,
   plutôt que de trancher seul.
6. Ne jamais inventer une donnée projet. Toute donnée absente des fichiers de seed est
   laissée nulle et listée dans `docs/GAPS.md`.

## 12. Message d'amorçage à coller en session 1

```
Lis docs/00_BRIEF.md en entier, puis tous les fichiers de docs/source/ et de seed/.
Lis aussi le dépôt local C:\Users\cleme\github\peeb-cool-santafe pour en extraire
la charte UI.

Ne code rien pour l'instant. Produis dans cet ordre :
1. docs/UI_TOKENS.md : les tokens de design extraits du dépôt de charte.
2. docs/SCHEMA.md : le schéma Postgres complet en SQL commenté, avec les politiques
   RLS, à partir de la section 7 du brief et des fichiers de seed.
3. docs/GAPS.md : tout ce qui manque, est ambigu ou contradictoire dans le brief et
   dans les données fournies.
4. docs/PLAN.md : le découpage en lots de travail, avec pour chacun le périmètre,
   les fichiers touchés et le critère de fin.

Puis arrête-toi et attends ma validation.
```
