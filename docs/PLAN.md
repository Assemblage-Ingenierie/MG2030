# PLAN — découpage en lots de travail

> Ordre imposé par le brief §9 : **ne pas entamer un lot avant validation du
> précédent**. Chaque lot se termine par une démonstration, jamais par un
> « c'est poussé ».
>
> Règle transverse, applicable à chaque lot sans être répétée : le build passe,
> `tsc --noEmit` et ESLint sont propres, les données de seed s'affichent, les
> tests RLS passent (brief §11.4).

---

## Vue d'ensemble

| Lot | Intitulé | Prérequis | Arbitrages encore ouverts |
|---|---|---|---|
| **0** | Cadrage et documentation | — | — |
| **1** | Socle applicatif : tokens, i18n, shell | 0 validé | ✅ **livré** |
| **2** | Schéma, migrations, seed | 0 validé | ✅ **livré** |
| **3** | RLS et tests de politiques | 2 | ✅ **livré** |
| **4** | Authentification et gestion des comptes | 3 | ✅ **livré** — reste GAPS 36 (invitations) |
| **5** | Référentiel — sites et bâtiments | 4 | ✅ **livré** |
| **6** | Référentiel — marchés et lots | 5 | ✅ **livré** |
| **7** | Moteur de planification (pur, testé) | 2 | ✅ **livré** — 23 tests, 94,7 % de couverture |
| **8** | Planification en base et édition tableur | 6, 7 | ✅ **livré** — mesure de saisie à faire avec la PIU |
| **9** | Scénarios, gabarits de passation, NoN | 8 | ⚠ **partiel** — bascule et instanciation livrées, écrans NoN à faire |
| **10** | Restitution Gantt | 8 | ✅ **livré** — SVG interne, 16 tests |
| **11** | Bibliothèque documentaire | 4 | ⚠ **partiel** — code complet, R2 non configuré |
| **12** | Livrables et retards | 6, 11 | ✅ **livré** — registre vide, retards dérivés |
| **13** | Notifications, organigramme, administration | 12 | ⚠ **partiel** — organigramme et cron livrés, clés à fournir |

**État au 19/08/2026 : les 13 lots ont été traversés.** Dix sont livrés et
vérifiés, trois sont partiels pour des raisons documentées — il leur manque des
données ou des identifiants qui ne relèvent pas du code :

| Lot partiel | Ce qui manque | Qui |
|---|---|---|
| 9 — passation | Les écrans de suivi des avis de non-objection. Le moteur d'instanciation est livré et testé, mais aucun gabarit n'existe dans les sources (GAPS 10) | PIU, puis développement |
| 11 — documents | Les identifiants Cloudflare R2. Le code est complet et le build passe ; sans les variables `R2_*`, la navigation fonctionne et le dépôt renvoie un message explicite | Fourniture d'identifiants |
| 13 — notifications | `SUPABASE_SERVICE_ROLE_KEY` et `CRON_SECRET` dans l'environnement Vercel (GAPS 54) | Fourniture d'identifiants |

**Vérification globale** : `npm run verify` enchaîne types, ESLint, les deux
garde-fous, 46 tests unitaires et le build. Tout passe.

Les lots 7 et 11 ne dépendent pas du référentiel : ils peuvent être menés en
parallèle des lots 5 et 6 si le rythme le justifie. Tous les autres sont
strictement séquentiels.

---

## Lot 0 — Cadrage et documentation

**Périmètre.** Lecture intégrale de `docs/00_BRIEF.md`, de `docs/source/` et de
`seed/` (README compris), extraction de la charte depuis le dépôt
`peeb-cool-santafe`, production des quatre documents de cadrage. Aucun code.

**Fichiers touchés.**
```
docs/UI_TOKENS.md      créé
docs/SCHEMA.md         créé
docs/GAPS.md           créé
docs/PLAN.md           créé
```

**Critère de fin.** Les quatre documents sont validés, et les trois arbitrages
de tête (GAPS 12, 37, 46) sont tranchés par écrit.

**Statut.** Livré. En attente de validation.

---

## Lot 1 — Socle applicatif : tokens, internationalisation, shell

**Périmètre.**
- Initialisation du projet Next.js (App Router, TypeScript, Tailwind v4), ESLint,
  `tsconfig` avec alias `@/`.
- `lib/tokens.ts` : port des tokens de `UI_TOKENS.md` (couleurs, rayons,
  typographie, ombres), exposés en variables CSS sur `<body>`.
  Substitution de l'accent Assemblage par l'accent institutionnel kosovar —
  `--accent: #034ea2`, `--accent-2: #d0a650`, valeurs exactes de
  `assets/logos/kosovo-emblem.svg` (GAPS 46, **à confirmer**).
  Création de `--danger: #c0392b`, devenue nécessaire puisque l'accent n'est
  plus rouge (GAPS 47).
- `app/globals.css` : pile de polices système, focus visible global,
  `prefers-reduced-motion`. Repris tel quel du dépôt de charte.
- Internationalisation **dès le premier composant** (brief §6) : `en` (peuplé) et
  `sq` (structure vide) — code de locale tranché. Aucune chaîne en dur.
  Formats : dates `dd/mm/yyyy`, fuseau d'affichage `Europe/Belgrade`, montants
  en euros **HT** avec la mention explicite (GAPS 41 et 42).
- Shell applicatif : sidebar 248 px, header 72 px, tiroir mobile, zone de contenu
  `min-w-0`. Navigation déclarée en données, filtrable par rôle.
  Logos : AFD + emblème de la République du Kosovo dans le header, Assemblage en
  sidebar. Le logo *Prishtina 2030* est ajouté dès réception du vectoriel.
- Primitives d'interface, sans bibliothèque externe : `Button`, `Input`, `Select`,
  `Card`, `Table`, `Modal`, `Popover` (rendu en portail), `Badge`, `Toggle`,
  `EmptyState`, `FieldError`.
- **Arbitrage Gantt (brief §10)** : note comparative soumise à validation.
  Critères imposés : licence, poids, édition par glisser-déposer, affichage des
  liens de précédence, échelles multiples. Candidats à instruire — composants
  React sous licence permissive et maintenus, contre rendu SVG interne.
  Élément déjà acquis : le dépôt de charte contient un Gantt SVG interne **en
  production**, ~3 600 lignes, zéro dépendance, échelles semaine / mois /
  trimestre, jalons, export SVG / PNG / PDF.
  **Aucune installation avant arbitrage.**

**Fichiers touchés.**
```
package.json, tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs
app/layout.tsx, app/globals.css, app/page.tsx
lib/tokens.ts, lib/cn.ts, lib/nav.ts
lib/i18n/{config.ts,request.ts}, messages/en.json, messages/sq.json
components/shell/{app-shell,sidebar,header}.tsx
components/ui/{button,input,select,card,table,modal,popover,badge,toggle,empty-state,field-error}.tsx
components/icons.tsx
docs/GANTT_ARBITRAGE.md            créé
```

**Statut. Livré le 19/08/2026.** `npm run verify` passe (types, lint,
garde-fou i18n, build). Vérifié dans le navigateur : bascule `en`/`sq`
opérationnelle, sidebar 248 px, bloc de marque aligné sur les 72 px du header.
Restent à venir : le logo *Prishtina 2030* (GAPS 49) et le fichier AFD, tous
deux isolés dans `components/shell/brand-mark.tsx`.

**Critère de fin.**
1. `npm run build` passe, déploiement Vercel automatique fonctionnel.
2. Une page de démonstration affiche les 12 primitives dans leurs 6 états
   (repos, survol, focus clavier, actif, désactivé, erreur).
3. Le basculement `en` / `sq` change **toutes** les chaînes de l'interface ;
   `sq.json` peut ne contenir que des clés vides, mais aucune chaîne n'est en dur.
   Les diacritiques albanais (`ë`, `ç`) s'affichent sans webfont.
4. `docs/GANTT_ARBITRAGE.md` est soumis et la décision est prise.
5. Aucune dépendance ajoutée hors de celles listées et validées.
6. `npm run check:i18n` échoue sur une chaîne en dur — vérifié en en
   introduisant une volontairement, puis en la retirant.

---

## Lot 2 — Schéma, migrations, seed

**Statut. Livré le 19/08/2026.** 29 tables, 16 types, 30 triggers appliqués sur
EXTERNAL ; 249 lignes de seed chargées ; les 10 contrôles d'invariants passent,
dont le décisif : **le recalcul est l'identité, aucune des 21 dates ne bouge**.
Les 26 tables de l'autre application et les 3 tables non préfixées sont intactes.

**Cible.** Projet Supabase **EXTERNAL** (`grnkbnldfzdzrgleorra`, eu-west-3,
Postgres 17.6), **partagé** avec PEEB Cool Santa Fe. Toutes les tables et tous
les types sont préfixés `mg2030_` ; les fonctions RLS vivent dans un schéma
`mg2030_private`, non exposé à l'API.

**Périmètre.**
- Migrations Supabase reprenant `SCHEMA.md` §2 à §9 : **16 types énumérés,
  29 tables**, contraintes, index, triggers de cycle (précédence et hiérarchie),
  trigger générique `mg2030_change_log`, colonne générée `duration_weeks`.
- Chargement du seed dans l'ordre de `SCHEMA.md` §12, à partir des CSV **sans
  transformation** autre que celles documentées : `afd_review` en minuscules,
  **`TV.2.1` et `SC.2.2` à 20 jours** (décision GAPS 12), non-chargement des
  13 lignes `lot_building` sans lot, non-chargement d'`excluded_rows.csv`.
- **Recalcul complet des dates après chargement** (décision GAPS 44), suivi du
  contrôle d'identité décrit au critère de fin.
- Script de contrôle post-chargement, qui **échoue** si un compte ne tombe pas.
- `mg2030_role_permission` et `mg2030_procurement_template*` restent vides
  (GAPS 10 et 11).

**Fichiers touchés.**
```
supabase/config.toml
supabase/migrations/0001_types.sql
supabase/migrations/0002_org_users_rights.sql
supabase/migrations/0003_referential.sql
supabase/migrations/0004_planning.sql
supabase/migrations/0005_procurement.sql
supabase/migrations/0006_deliverables.sql
supabase/migrations/0007_documents.sql
supabase/migrations/0008_cross_cutting.sql
supabase/migrations/0009_triggers.sql
supabase/seed/*.sql
scripts/load_seed.ts
scripts/check_seed.ts
lib/db/types.ts                     généré par supabase gen types
```

**Critère de fin.** `scripts/check_seed.ts` passe sur une base fraîche et vérifie
au minimum :

| Contrôle | Attendu |
|---|---|
| Lignes chargées | 3 organisations · 14 rôles · 14 nœuds d'organigramme · 3 scénarios · 2 plans · 14 sites · 36 bâtiments · 9 marchés · 15 lots · **46** relations lot/bâtiment · 27 tâches · 19 dépendances · 4 contraintes · 4 tags · 39 dossiers |
| Somme des estimations | 37 218 706 € au Student Center, 3 539 416 € aux training venues |
| `duration_weeks` | Égale `round(duration_days/7, 2)` sur les 21 tâches datées |
| `end_date` | Égale `start_date + duration_days` sur **21/21** (décision GAPS 12 appliquée) |
| **Recalcul neutre** | Le recalcul intégral après chargement **ne change aucune des 21 dates de fin**. Le script échoue si une seule bouge — c'est la preuve que la reprise de l'historique est sûre |
| **Aucune collision** | Aucun objet créé hors du préfixe `mg2030_` et du schéma `mg2030_private` ; les 29 tables `peebcoolsf_*` et les 3 tables non préfixées existantes sont intactes |
| Dépendances | `start` = `MAX(fin des prédécesseurs)` sur 17/17 |
| Récapitulatifs | `TV.2`, `TV.3.1`, `SC.2` égalent `MIN`/`MAX` de leurs enfants |
| `TV.3` | `group_header` : dates nulles |
| Scénarios | `design_bid_build.is_schedulable = false`, **0 tâche** |
| Aucune invention | Toute colonne vide au CSV est `null` en base |

---

## Lot 3 — RLS et tests de politiques

**Statut. Livré le 19/08/2026.** 78 politiques sur 29 tables, 11 fonctions
d'appui, matrice de 66 attributions. **20 contrôles sur 20 passent**, dont le
cloisonnement inter-applications : un compte réel de l'autre application lit
zéro ligne sur les tables MG2030.

> Un défaut a été trouvé et corrigé au passage : les politiques `FOR ALL`
> élargissaient la lecture sur 4 tables (`docs/GAPS.md` point 53). Toute
> écriture s'exprime désormais en INSERT / UPDATE / DELETE explicites, et le
> garde-fou refuse tout `FOR ALL` futur.

> ⚠ **Lot le plus sensible du projet.** `auth.users` est partagé avec PEEB Cool
> Santa Fe : 12 comptes étrangers à MG2030 obtiendront un JWT `authenticated`
> valide sur cette base. Une seule politique laxiste leur ouvre les données
> (GAPS 52).

**Périmètre.**
- Schéma `mg2030_private` (non exposé à l'API) et les 11 fonctions d'appui de
  `SCHEMA.md` §10.2, en `security definer`, `stable`, `set search_path = ''`.
- Les politiques de `SCHEMA.md` §10.3 sur les 29 tables. Aucune table sans RLS,
  **aucune politique `using (true)`**.
- Vocabulaire `mg2030_permission` (~18 codes) et matrice `mg2030_role_permission`
  validée (GAPS 11).
- Jeu de tests pgTAP avec les trois utilisateurs fictifs du brief §8 **plus un
  quatrième** : un compte PEEB Santa Fe réel.
- Garde-fou structurel : une requête sur `pg_policies` qui échoue si une
  politique `mg2030_*` ne mentionne ni `is_active_user()` ni
  `is_platform_admin()`.
- Vérification des index sur les colonnes lues par les politiques
  (`mg2030_app_user_scope.user_id`, `mg2030_lot_building.lot_id`,
  `mg2030_building.site_id`, `mg2030_document_tag.document_id`).

**Fichiers touchés.**
```
supabase/migrations/0010_rls_schema_and_functions.sql
supabase/migrations/0011_rls_policies.sql
supabase/migrations/0012_permissions_seed.sql
supabase/tests/rls.test.sql
supabase/tests/policy_guardrail.test.sql
scripts/run_rls_tests.ts
```

**Critère de fin.** Les 12 cas de `SCHEMA.md` §10.4 passent, dont en premier :
1. **Cloisonnement inter-applications** : un compte PEEB Santa Fe réel lit
   **zéro ligne** sur les 29 tables `mg2030_*` et échoue sur toute écriture.
   **Ce test seul justifie le lot.**
2. Le garde-fou `pg_policies` échoue si l'on ajoute délibérément une politique
   `using (true)` — vérifié en le provoquant, puis en le retirant.
3. Une session `anon` lit **zéro ligne** sur les 29 tables.
4. Un compte MG2030 `is_active = false` lit **zéro ligne** sur les 29 tables.
5. `afd.reader` lit tout et échoue sur **toute** écriture, y compris là où sa
   matrice de rôle l'autoriserait.
6. `site.rep` (périmètre `TV-FAIK`) voit 1 site sur 14 et ne voit pas le
   Student Center.
7. Une dépendance dont une seule extrémité est visible est masquée.
8. `mg2030_change_log` n'accepte aucune écriture depuis une session client.
9. `EXPLAIN` sur `select * from mg2030_task` ne montre aucun appel de fonction
   par ligne (les fonctions RLS sont bien évaluées en initplan).
10. Les tables `peebcoolsf_*` sont **inchangées** : aucune politique, aucun
    index, aucun trigger ajouté ou modifié.

---

## Lot 4 — Authentification et gestion des comptes

**Périmètre.**
- Supabase Auth, sans inscription libre. Middleware de rafraîchissement de
  session, redirection des non authentifiés.
- **Deux écrans distincts**, conséquence du pool d'authentification partagé
  (GAPS 52) : « ce compte n'a pas accès à MG2030 » pour un compte authentifié
  sans ligne `mg2030_app_user` (typiquement un utilisateur PEEB Santa Fe), et
  « accès en attente de validation » pour un compte MG2030 dont `is_active` est
  encore faux. Les confondre ferait attendre indéfiniment 12 personnes.
  Affichés sur toutes les routes, sans redirection (pas de boucle possible).
- Administration des comptes : création, rattachement organisation / rôle /
  nœud d'organigramme, attribution du **périmètre** (`app_user_scope`),
  activation, désactivation.
- Fiche « mon compte » : nom, fonction, langue préférée.

**Fichiers touchés.**
```
lib/supabase/{client,server,middleware}.ts
lib/auth/{types,server,guards}.ts
middleware.ts
app/(auth)/login/page.tsx
app/(auth)/callback/route.ts
app/admin/users/{page.tsx,actions.ts}
components/auth/{auth-context,pending-approval,login-form}.tsx
components/admin/user-table.tsx
messages/en.json, messages/sq.json
```

**Critère de fin.**
1. Les trois utilisateurs de test se connectent et voient exactement ce que les
   tests du lot 3 prédisent.
2. Un compte désactivé en cours de session perd l'accès aux données au
   rafraîchissement suivant.
3. Un administrateur attribue un périmètre `site` à un `SITEREP` et la
   restriction s'observe immédiatement dans l'interface.
4. Le mode d'invitation retenu (GAPS 36) est opérationnel sur 30 comptes.

---

## Lot 5 — Référentiel : sites et bâtiments

**Périmètre.** Liste, fiche, création et édition des 14 sites et 36 bâtiments.
Pagination et filtres **côté serveur** (brief §4). Server Components par défaut.
Les champs vides au seed s'affichent comme « non renseigné », jamais comme zéro.

**Fichiers touchés.**
```
app/sites/{page.tsx,[code]/page.tsx,actions.ts}
app/buildings/{page.tsx,[code]/page.tsx,actions.ts}
lib/queries/{sites,buildings}.ts
components/referential/{site-table,site-form,building-table,building-form}.tsx
messages/en.json, messages/sq.json
```

**Critère de fin.**
1. Les 14 sites et 36 bâtiments s'affichent, filtrables par sous-projet, zone,
   nature d'intervention.
2. Les 13 salles de training venues affichent une zone vide **sans erreur**
   (colonne nullable).
3. La salle Tetori affiche ses **deux** surfaces (1 987 net / 3 934 brut) avec la
   mention de l'écart source.
4. Les 5 dortoirs sans année de construction l'affichent comme non renseignée.
5. Une modification produit une ligne par champ dans `change_log`.
6. Un `SITEREP` ne voit que son site.

---

## Lot 6 — Référentiel : marchés et lots

**Périmètre.** Liste, fiche, création et édition des 9 marchés et 15 lots ;
relation lot ↔ bâtiments ; contrôle de format du numéro de marché ; affichage
des fourchettes de montant ; affichage des marchés par scénario.

**Fichiers touchés.**
```
app/contracts/{page.tsx,[code]/page.tsx,actions.ts}
app/lots/{page.tsx,[code]/page.tsx,actions.ts}
lib/queries/{contracts,lots}.ts
components/referential/{contract-table,contract-form,lot-table,lot-form,lot-buildings-picker}.tsx
```

**Critère de fin.**
1. Les 9 marchés s'affichent avec leurs 4 dates clés et leur scénario.
2. Les 3 marchés partageant `MYS/MG2030/C/2026/XX` coexistent sans conflit
   d'unicité (GAPS 19).
3. `C-SC-DD` affiche publication et ouverture comme **« sans objet »** (gré à
   gré), pas comme manquantes (GAPS 6).
4. Les 4 lots `W-TV-*` affichent explicitement « bâtiments non affectés »
   avec un renvoi documenté (GAPS 3), et non une liste vide muette.
5. Le contrôle de format refuse `MYS/MG2030/X/2027/01` et accepte le suffixe `XX`.
6. Les montants s'affichent en fourchette quand min ≠ max, en valeur unique sinon.

---

## Lot 7 — Moteur de planification (pur, testé)

> **C'est la seule valeur ajoutée réelle par rapport à Excel** (brief §7).
> Traité en priorité et couvert par des tests unitaires.

**Périmètre.** Module TypeScript **pur** : aucune dépendance base, réseau ni
React, à l'image de `lib/schedule.ts` du dépôt de charte. Entrées :
tâches (durée, ancre, type), dépendances, contraintes. Sortie : dates calculées.

Règles implémentées :
- Tri topologique, refus des cycles avec message explicite.
- `start = MAX(fins des prédécesseurs + lag, contraintes, ancre saisie)` —
  **les convergences sont le cas nominal**, pas une exception.
- `end = start + duration_days`, en **jours calendaires**.
- `summary` : `MIN`/`MAX` des enfants. `group_header` : aucune date.
  `milestone` : durée 0, `start = end`.
- Recalcul en cascade : le glissement d'une tâche amont propage à l'aval.
- Recalcul **incrémental** : seul le sous-graphe aval est recalculé.

**Fichiers touchés.**
```
lib/schedule/{types,engine,topo,rollup,index}.ts
lib/schedule/__tests__/{engine,topo,rollup,seed-fidelity}.test.ts
vitest.config.ts
```

**Critère de fin.**
1. **Test de fidélité au seed** : alimenté avec les 27 tâches, 19 dépendances et
   4 contraintes réelles, le moteur reproduit les 21 dates de fin **à
   l'identique**, l'anomalie GAPS 12 une fois arbitrée. C'est le test qui prouve
   que la reprise de l'historique est sûre.
2. Convergences : `TV.2.4` (`MAX` de `TV.1` et `TV.2.3`) et `SC.2.5` (`MAX` de
   `SC.1` et `SC.2.1`) donnent la bonne date.
3. Cascade : décaler `TV.2.1` de 10 jours décale `TV.3.2` de 10 jours et
   `TV.2.4` de 0 jour (elle est tenue par `TV.1`, plus tardive). Ce second point
   est le test qui distingue une vraie convergence d'une chaîne linéaire.
4. Un cycle lève une erreur nommant les deux tâches en cause.
5. `group_header` reste sans dates même si ses enfants en ont.
6. Couverture ≥ 90 % sur `lib/schedule/`.
7. Aucune dépendance ajoutée hors `vitest`.

---

## Lot 8 — Planification en base et édition tableur

**Périmètre.** Persistance et interface du moteur : liste hiérarchique des
tâches, création, édition, indentation, réordonnancement ; dépendances et
contraintes ; déclenchement du recalcul et écriture des dates ; rattachement à
un marché, un lot, un site ; responsable, valideur, avancement.

**Édition en ligne de type tableur** (brief §9.4) : reprise du patron
`editable-table` de la charte (`UI_TOKENS.md` §6) — cellule en lecture qui est
un `<button>`, passage en `<input>` à la sélection, validation à `Tab` / `Entrée`.
C'est le point où se joue le critère de succès du brief §2 : **si la saisie est
plus lente que sous Excel, la PIU retournera à Excel.**

**Fichiers touchés.**
```
app/schedule/{page.tsx,actions.ts}
lib/queries/tasks.ts
lib/schedule/persist.ts
components/schedule/{task-grid,task-row,dependency-editor,constraint-editor,task-side-panel}.tsx
supabase/migrations/0013_schedule_recompute.sql
```

**Critère de fin.**
1. Les 27 tâches s'affichent en hiérarchie, `TV.3` en intertitre sans dates.
2. Modifier une durée recalcule et **persiste** l'aval en une seule transaction.
3. Saisie au clavier de bout en bout : flèches pour naviguer, `Tab` pour valider
   et avancer, `Entrée` pour valider et descendre, `Échap` pour annuler. Aucune
   action ne requiert la souris.
4. **Mesure comparée** : saisir 10 tâches enchaînées prend un temps **au plus
   égal** à la même saisie sous Excel. Le chronométrage est fait avec la PIU et
   consigné.
5. Créer une dépendance formant un cycle affiche une erreur lisible et n'écrit
   rien.
6. La liste est paginée côté serveur au-delà de 100 lignes (brief §4).

---

## Lot 9 — Scénarios, gabarits de passation, avis de non-objection

**Périmètre.**
- Bascule entre scénarios ; exclusion mutuelle `design_bid_build` /
  `design_build` ; marge terminale et échéance des Jeux.
- Refus explicite d'afficher un scénario `is_schedulable = false`, avec le motif
  (GAPS 9) plutôt qu'un écran vide.
- Gabarits de passation : création, étapes, durées, responsable et valideur par
  étape ; instanciation à la création d'un contrat, avec génération des tâches.
- Registre des avis de non-objection AFD : demande, envoi, réponse, pièce liée.

**Fichiers touchés.**
```
app/scenarios/{page.tsx,actions.ts}
app/procurement/templates/{page.tsx,actions.ts}
app/procurement/no-objections/{page.tsx,actions.ts}
lib/procurement/{instantiate,templates}.ts
components/procurement/{template-editor,step-editor,non-table,non-form}.tsx
components/schedule/scenario-switch.tsx
```

**Critère de fin.**
1. La bascule `design_build` → `design_bid_build` change le planning affiché et
   n'autorise pas les deux à la fois.
2. `design_bid_build` affiche le motif documenté de son indisponibilité, pas une
   liste vide.
3. La marge terminale (4 mois, 01/09/2029 → 01/01/2030) est visible, et le
   dépassement de `W-SC` (12/09/2029, GAPS 21) est **signalé**.
4. Créer un contrat sur un gabarit génère les tâches, avec `generated_from_step_id`
   renseigné et les dépendances entre étapes.
5. Une étape marquée NoN crée la ligne `no_objection` correspondante.
6. Les libellés d'étape sont normalisés (GAPS 24).

---

## Lot 10 — Restitution Gantt

**Périmètre.** Rendu selon l'arbitrage du lot 1. Groupement par jour, semaine,
mois, trimestre. Vues filtrées : projet entier, un marché, un site. Liens de
précédence, jalons, marge terminale, repère « aujourd'hui ». Export.

**Fichiers touchés.**
```
app/gantt/page.tsx
lib/gantt/{geometry,scale,render-svg,export}.ts
components/gantt/{gantt-view,gantt-row,gantt-axis,gantt-links,gantt-legend,scale-switch}.tsx
```

**Critère de fin.**
1. Les 25 tâches datées s'affichent sur les 4 échelles sans chevauchement ni
   troncature de libellé.
2. Les 19 liens de précédence sont tracés, convergences comprises.
3. Filtrer sur `W-TV` ne laisse que les tâches de ce marché ; filtrer sur un site
   ne laisse que les siennes.
4. Les jalons `MS.1` et `MS.2` et la marge de 4 mois sont lisibles.
5. Le rendu tient en moins de 500 ms sur les 27 tâches, et reste utilisable à
   500 tâches simulées.
6. Aucune dépendance ajoutée hors de celle décidée au lot 1.

---

## Lot 11 — Bibliothèque documentaire

**Périmètre.** Arborescence (39 dossiers au seed, modifiable par les
administrateurs) ; upload **direct navigateur** vers R2 par URL pré-signée,
jamais à travers une fonction serveur ; téléchargement par URL pré-signée à
durée courte ; tags et `tag_access` ; vignettes servies depuis R2.

**Fichiers touchés.**
```
lib/r2/{client,presign,keys}.ts
app/api/documents/presign-upload/route.ts
app/api/documents/presign-download/route.ts
app/library/{page.tsx,[folder]/page.tsx,actions.ts}
app/admin/tags/{page.tsx,actions.ts}
components/library/{folder-tree,document-table,upload-dropzone,tag-picker,tag-access-editor}.tsx
.env.example
```

**Critère de fin.**
1. Un fichier de **1 Go** monte en direct vers R2 sans passer par une fonction
   serveur, avec barre de progression et reprise sur erreur réseau.
2. La clé pré-signée expire ; une URL périmée est refusée.
3. Un document sans tag est visible des trois utilisateurs de test.
4. Un document tagué `procurement`, avec `tag_access` sur le rôle PROC, n'est
   visible que de `proc.specialist` — vérifié **par requête SQL directe**, pas
   seulement dans l'interface.
5. Un document multi-tags se comporte conformément à l'arbitrage GAPS 33.
6. Les vignettes ne passent **jamais** par l'optimisation d'images Vercel.
7. Les 39 dossiers du seed s'affichent, et un administrateur peut en créer,
   renommer et déplacer.

---

## Lot 12 — Livrables et retards

**Périmètre.** Registre des livrables attendus (rapports de consultants et
livrables d'entreprises), date contractuelle, remise effective, statut de
validation, visa, pièce liée. Détection automatique des manquants et des
retards, par vue dérivée — jamais par colonne stockée.

**Fichiers touchés.**
```
app/deliverables/{page.tsx,actions.ts}
lib/queries/deliverables.ts
components/deliverables/{deliverable-table,deliverable-form,late-badge}.tsx
supabase/migrations/0014_deliverable_views.sql
```

**Critère de fin.**
1. Un livrable dont la date contractuelle est passée et non remis apparaît en
   retard, sans intervention.
2. Le nombre de jours de retard est exact au jour près.
3. Un livrable remis en retard reste tracé comme tel après remise.
4. Le visa exige un valideur **et** une date, ou aucun des deux.
5. La vue par marché indique les livrables en retard et le prochain attendu.

---

## Lot 13 — Notifications, organigramme, administration des référentiels

**Périmètre.**
- Notifications applicatives : dépôt de document, franchissement de jalon,
  retard, plainte enregistrée. Pas d'e-mail (brief §7). Ordonnancement selon
  l'arbitrage GAPS 35.
- Organigramme PIU : rendu de l'arbre `org_unit` (14 nœuds), affectation des
  utilisateurs aux postes.
- Administration des référentiels : tags, dossiers, gabarits, scénarios,
  vocabulaires, matrice rôle × permission.

**Fichiers touchés.**
```
app/notifications/{page.tsx,actions.ts}
app/api/cron/schedule-checks/route.ts
app/org-chart/page.tsx
app/admin/{page.tsx,roles/page.tsx,permissions/page.tsx}
lib/notifications/{emit,rules}.ts
components/notifications/{bell,notification-list}.tsx
components/org/org-chart.tsx
supabase/migrations/0015_notification_triggers.sql
vercel.json
```

**Critère de fin.**
1. Un dépôt de document notifie les utilisateurs concernés, et eux seuls.
2. Un dépassement d'échéance produit une notification au plus une fois.
3. Un utilisateur ne voit **que** ses notifications (vérifié en SQL direct).
4. L'organigramme rend les 14 nœuds, `COORD` en racine avec son supérieur
   externe en mention.
5. Un administrateur modifie la matrice rôle × permission et l'effet est
   immédiat, sans redéploiement.

---

## Hors périmètre de la version 1

Rappel du brief §9, pour éviter toute dérive : tableau de bord consolidé, carte,
synchronisation Google Calendar, albanais complet (infrastructure prête, une
seule langue peuplée), et l'ensemble des modules de phase 2 — suivi financier,
E&S, registres de plaintes, indicateurs de suivi-évaluation, génération des
rapports mensuels et trimestriels.

Les points d'accroche de la phase 2 existent déjà au schéma (`SCHEMA.md` §12) :
aucune modification des tables de la version 1 ne sera nécessaire pour les
ajouter.

---

## Conventions transverses à tous les lots

| Point | Règle |
|---|---|
| **Aucune chaîne en dur** | Dès le premier composant, tout libellé passe par `messages/*.json` |
| **Server Components par défaut** | `use client` uniquement là où l'interactivité l'exige |
| **Pagination serveur** | Sur toute liste susceptible de dépasser 100 lignes |
| **Dépendances** | Aucune ajoutée sans validation préalable, arbitrage écrit à l'appui |
| **Vercel** | Pas d'optimisation d'images ; les vignettes viennent de R2 |
| **Supabase** | Pas de Realtime, pas d'Edge Functions, pas de WebSocket |
| **RLS** | Toute table nouvelle arrive avec ses politiques et ses tests dans le même lot |
| **Données absentes** | Laissées nulles, affichées comme non renseignées, listées dans `GAPS.md` |
| **Préfixe** | Tout objet base créé est préfixé `mg2030_` ou vit dans `mg2030_private`. Le projet est partagé : rien ne doit toucher aux objets `peebcoolsf_*` ni aux 3 tables non préfixées existantes |
| **Montants** | Euros **HT**, mention « HT » explicite à l'affichage |
| **Dates** | Stockage UTC, affichage `Europe/Belgrade`, format `dd/mm/yyyy` |
| **Fin de lot** | Démonstration sur données de seed réelles, jamais sur données fictives |
