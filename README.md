# MG2030 — plateforme de suivi

Suivi du programme d'infrastructures des XXI<sup>es</sup> Jeux méditerranéens
(Prishtina 2030), financé par l'AFD et mis en œuvre par le Ministère de la
Jeunesse et des Sports du Kosovo.

---

## Démarrer

```bash
npm install
```

```bash
npm run dev
```

L'application écoute sur `http://localhost:3000`. **Aucun compte n'existe au
départ** : suivre [`docs/ADMIN.md`](docs/ADMIN.md) §2 pour créer le premier
administrateur. Sans lui, toutes les pages affichent l'écran d'accès refusé.

La page [`/design-system`](http://localhost:3000/design-system) reste accessible
**sans compte, hors production** : elle ne lit aucune donnée projet, et il
serait absurde d'exiger une manipulation SQL pour relire des couleurs. En
production, elle exige une session comme le reste.

## Vérifier

```bash
npm run verify
```

Enchaîne types, ESLint, les deux garde-fous, 46 tests unitaires et le build.
À passer avant toute remise.

| Vérification | Ce qu'elle empêche |
|---|---|
| `npm run typecheck` | — |
| `npm run lint` | — |
| `npm run check:i18n` | Une chaîne visible écrite en dur dans le JSX (brief §6) |
| `npm run check:service-key` | La clé de service qui contourne la RLS employée ailleurs que dans l'unique route autorisée |
| `npm run test` | Une régression du moteur de planification ou de la géométrie du Gantt |

Deux jeux de tests vivent en base et se lancent depuis l'éditeur SQL Supabase :

- `supabase/tests/seed-invariants.sql` — 10 contrôles sur les données chargées ;
- `supabase/tests/rls.test.sql` — 20 contrôles de politiques. **Il s'annule
  intégralement** (il se termine par `raise exception`), donc il est exécutable
  sur la base partagée. Le message d'erreur *est* le rapport.

---

## Documentation

À lire avant toute contribution, dans cet ordre :

| Document | Contenu |
|---|---|
| [`docs/00_BRIEF.md`](docs/00_BRIEF.md) | Le brief de départ. Fait autorité |
| [`docs/GAPS.md`](docs/GAPS.md) | Manques, ambiguïtés, contradictions, et le journal des décisions |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Modèle Postgres complet, politiques RLS comprises |
| [`docs/UI_TOKENS.md`](docs/UI_TOKENS.md) | Charte : couleurs, typographie, rayons, composants, états |
| [`docs/PLAN.md`](docs/PLAN.md) | Découpage en lots, périmètre et critère de fin de chacun |
| [`docs/GANTT_ARBITRAGE.md`](docs/GANTT_ARBITRAGE.md) | Comparatif et décision sur la restitution Gantt |
| [`docs/ADMIN.md`](docs/ADMIN.md) | Ouverture des comptes, périmètres, retrait d'accès |
| [`seed/README_SEED.md`](seed/README_SEED.md) | Sources, conventions et écarts des données de référence |
| [`seed/README_PLANNING.md`](seed/README_PLANNING.md) | Extraction du planning et anomalies du fichier source |

---

## Base de données

Projet Supabase **EXTERNAL** (`grnkbnldfzdzrgleorra`, eu-west-3, Postgres 17.6),
**partagé** avec une autre application.

> ⚠ **Deux conséquences, détaillées dans [`docs/SCHEMA.md`](docs/SCHEMA.md) §1.**
>
> 1. Tout objet créé est préfixé `mg2030_` ou vit dans `mg2030_private`.
>    Une table `buildings` non préfixée existe déjà sur ce projet : le préfixe
>    n'est pas une précaution de style.
> 2. **`auth.users` est commun.** Le rôle `authenticated` ne prouve donc pas
>    l'appartenance à MG2030 : seule une ligne dans `mg2030_app_user` le fait.
>    Aucune politique RLS ne doit s'écrire `using (true)`, et aucune ne doit
>    être `for all` — un garde-fou en base le vérifie.

29 tables, 16 types énumérés, 112 politiques, 249 lignes de seed.

---

## Architecture

```
app/
  (app)/            écrans métier — sous le cadre applicatif et le garde d'accès
  login/            connexion, sans chrome ni garde (sinon elle se protégerait d'elle-même)
  api/              routes : URL pré-signées R2, évaluation périodique
components/
  ui/               primitives, sans bibliothèque externe
  shell/            sidebar, header, marque
  schedule/ gantt/  grille de saisie, restitution
lib/
  schedule/         MOTEUR DE PLANIFICATION — pur, testé, sans dépendance
  gantt/            géométrie et échelles — pures, testées
  queries/          accès aux données ; la RLS filtre, ce code ne refiltre rien
  i18n/ tokens.ts   internationalisation et charte, sources uniques
supabase/
  migrations/       le schéma, dans l'ordre d'application
  tests/            invariants du seed, politiques RLS
scripts/            génération du seed, garde-fous
```

---

## Règles non négociables

Elles viennent du brief et ne se rediscutent pas au cas par cas.

- **Aucune chaîne en dur.** Tout libellé passe par `messages/`. Vérifié
  automatiquement ; le build échoue.
- **Aucune couleur en dur.** `lib/tokens.ts` est la source unique ; les
  composants ne consomment que `var(--token)`.
- **La RLS protège les données, jamais le code applicatif.** Les modules de
  `lib/queries/` ne refiltrent rien : un filtrage redondant donnerait
  l'illusion d'une sécurité qui n'est pas là.
- **Server Components par défaut.** `use client` seulement là où
  l'interactivité l'exige.
- **Aucune dépendance sans validation préalable** (brief §4). L'application
  tourne sur Next, React, Tailwind et Supabase — rien d'autre.
- **Jamais inventer une donnée projet.** Une donnée absente reste nulle,
  s'affiche comme non renseignée à l'écran, et est consignée dans
  [`docs/GAPS.md`](docs/GAPS.md).
- **Les dates du planning sont un résultat, pas une saisie.** Les seules
  entrées du moteur sont la durée, l'ancre, les précédences et les contraintes.
- **Pas d'optimisation d'images Vercel** ; les vignettes viennent de R2.
- **Pas de Realtime, pas d'Edge Functions, pas de WebSocket.**

---

## État d'avancement

Les 13 lots du [`plan`](docs/PLAN.md) ont été traversés. Dix sont livrés et
vérifiés ; trois sont partiels faute de données ou d'identifiants — pas faute
de code :

| Lot | Ce qu'il manque |
|---|---|
| 9 — passation | Les gabarits eux-mêmes : aucun n'existe dans les sources (GAPS 10). Le moteur d'instanciation est livré et testé |
| 11 — documents | Les identifiants Cloudflare R2 (`R2_*`). Sans eux, la navigation fonctionne, le dépôt affiche un message explicite |
| 13 — notifications | `SUPABASE_SERVICE_ROLE_KEY` et `CRON_SECRET` (GAPS 54) |

**Hors périmètre de la version 1** (brief §9) : tableau de bord consolidé,
carte, synchronisation Google Calendar, albanais peuplé, et l'ensemble des
modules de phase 2.
