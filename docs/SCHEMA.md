# SCHEMA — modèle de données Postgres / Supabase

> Établi à partir de la section 7 du brief et des fichiers de `seed/`
> (`README_SEED.md`, `README_PLANNING.md` inclus).
> **Aucune migration n'a été écrite.** Ce document est soumis à validation.
>
> Tout point non tranché par le brief ou par les données est signalé par
> `>> ARBITRAGE` et repris dans `GAPS.md`.

---

## 0. Cible de déploiement et conventions

### 0.1 Projet Supabase — décision du 19/08/2026

| Point | Valeur |
|---|---|
| Projet | **EXTERNAL** — `grnkbnldfzdzrgleorra` |
| Organisation | `amjedudflodlkbrteptt` |
| Région | `eu-west-3` (Paris) |
| Postgres | 17.6.1 |
| Nature | **Projet partagé** — il héberge déjà PEEB Cool Santa Fe |

État constaté du projet au 19/08/2026 :

- 29 tables dans `public`, dont 26 préfixées `peebcoolsf_` et **3 non
  préfixées** : `buildings` (133 lignes), `profiles` (11 lignes), `app_params`
  (1 ligne).
- Un schéma privé applicatif existe déjà : `peebcoolsf_private`.
- **Aucun type énuméré** dans `public` : PEEB n'en utilise pas.
- `auth.users` contient **12 comptes**.
- Aucune table `mg2030*` : le préfixe est libre.

> ⚠ **`buildings` existe déjà, non préfixée.** Sans préfixe, la table
> `building` de ce schéma serait passée à côté de la collision de justesse
> (singulier contre pluriel) — mais `site`, `contract`, `document`, `tag`,
> `task`, `plan`, `folder`, `permission` et `notification` sont autant de noms
> génériques qu'un futur module poserait naturellement. Le préfixe n'est pas une
> précaution de style : il est nécessaire.

### 0.2 Nommage

| Objet | Convention | Exemple |
|---|---|---|
| Tables | `mg2030_<nom>` | `mg2030_task_dependency` |
| Types énumérés | `mg2030_<nom>` | `mg2030_task_type` |
| Vues | `mg2030_<nom>_v` | `mg2030_task_window_v` |
| Fonctions RLS | schéma dédié `mg2030_private` | `mg2030_private.can_see_site()` |
| Politiques RLS | `<table>_<action>_<qui>` | `mg2030_site_read_scoped` |
| Index | `<table>_<colonnes>_idx` | `mg2030_task_plan_idx` |

Le schéma `mg2030_private` **calque la convention maison** (`peebcoolsf_private`
existe déjà). Il n'est **pas** exposé à l'API PostgREST : les fonctions RLS ne
doivent jamais être appelables depuis le client.

> **Alternative écartée.** Un schéma dédié `mg2030` contenant tables, types et
> fonctions non préfixés aurait été plus court à écrire. Écarté : il faut alors
> l'exposer dans `Settings → API → Exposed schemas`, passer
> `{ db: { schema: 'mg2030' } }` à chaque client, et `supabase gen types` prend
> une option supplémentaire. Le préfixe suit la convention déjà en place sur le
> projet et ne demande aucune configuration.

### 0.3 Décisions arrêtées

| # | Point | Décision |
|---|---|---|
| GAPS 12 | Durée de `TV.2.1` et `SC.2.2` | **20 jours** (2,86 semaines), et non 21. Préserve les 12 dates aval et la concordance au jour près avec le plan de passation |
| GAPS 37 | Projet Supabase | **EXTERNAL, partagé, toutes les tables préfixées `mg2030_`** |
| GAPS 40 | Locale albanaise | **`sq`** |
| GAPS 41 | Fuseau et format | Stockage **UTC** (`timestamptz`), affichage **`Europe/Belgrade`**, format **`dd/mm/yyyy`** dans les deux langues |
| GAPS 42 | Devise et fiscalité | **Euros hors taxes uniquement.** Aucune colonne TTC, aucune colonne de TVA |
| GAPS 44 | Politique de reprise | **Recalcul** à l'import. Rendu sûr par la décision GAPS 12 : le recalcul devient l'identité, aucune date ne bouge |

### 0.4 Conventions générales

| Point | Choix | Motif |
|---|---|---|
| Clés primaires | `uuid` `default gen_random_uuid()` | Natif en Postgres 17, pas de séquence exposée |
| Clés naturelles | `*_code text unique not null` | Les codes de `seed/` sont la clé fonctionnelle et servent au chargement |
| Dates de planning | `date` | Jours calendaires, sans heure ni fuseau |
| Horodatages | `timestamptz default now()` | UTC en base, `Europe/Belgrade` à l'affichage |
| Montants | `numeric(14,2)`, **euros HT** | Décision GAPS 42 |
| Champ absent | `null`, jamais une valeur inventée | Brief §11.6 |
| Traçabilité | Colonne `source text` sur le référentiel | Reprend la colonne `source` des CSV |
| Suppression | Soft delete (`archived_at timestamptz`) | `change_log` n'est pas probant. `>> ARBITRAGE` GAPS 38 |
| RLS | Activée sur **toutes** les tables, sans exception | Brief §4 et §8 |

### 0.5 Extensions

```sql
-- Déjà présentes sur le projet EXTERNAL, rien à installer :
--   pgcrypto (gen_random_uuid), pg_graphql, pg_stat_statements, supabase_vault.
-- Une seule à activer, pour la contrainte d'exclusion des scénarios (§4.1) :
create extension if not exists btree_gist;
```

Pas de `pg_cron` en version 1 (voir `GAPS.md`, point 35).

---

## 1. ⚠ Conséquence majeure du projet partagé : `auth.users` est commun

**C'est le point de sécurité structurant de ce schéma.**

`auth.users` compte 12 comptes, tous issus de PEEB Cool Santa Fe. Ces comptes
obtiendront un JWT valide portant le rôle Postgres `authenticated` **sur la base
MG2030**, puisque c'est la même instance.

**Conséquence : `to authenticated` ne signifie pas « utilisateur MG2030 ».**
Une politique écrite `using (true) to authenticated` ouvrirait les données
MG2030 aux 12 comptes de Santa Fe, et réciproquement.

Toutes les politiques de ce document passent donc par
`mg2030_private.is_member()`, qui exige une ligne dans `mg2030_app_user` :

```sql
-- Appartenance à l'application MG2030. AUCUNE politique ne s'en dispense.
create or replace function mg2030_private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mg2030_app_user u where u.id = (select auth.uid())
  );
$$;
```

Trois obligations qui en découlent :

1. **Aucune politique `using (true)`**, jamais, sur aucune table `mg2030_*`.
2. **Le test RLS ajoute un quatrième utilisateur fictif** : un compte PEEB Santa
   Fe existant, qui doit lire **zéro ligne** sur les 29 tables MG2030.
3. **L'écran d'accès refusé change de sens.** Sur PEEB, un compte sans profil est
   « en attente de validation ». Sur MG2030, un compte peut être *légitimement
   étranger à l'application*. Le message doit être « ce compte n'a pas accès à
   MG2030 », pas « en attente » — sans quoi 12 utilisateurs de Santa Fe
   attendront une validation qui ne viendra jamais.

Symétriquement, les comptes MG2030 apparaîtront dans `auth.users` sans ligne
`peebcoolsf_perfiles` : le comportement de PEEB face à ces comptes est à
vérifier avant l'ouverture (hors périmètre de ce document, mais à signaler).

---

## 2. Types énumérés

Les vocabulaires **fermés par le brief** sont des `enum`. Les vocabulaires
seulement *observés* dans le seed (typologie, type de site, mode constructif,
statut d'occupation) restent en `text` : les fermer reviendrait à inventer une
liste.

```sql
-- ── Référentiel ─────────────────────────────────────────────────────────────
create type mg2030_subproject as enum ('athletes_village', 'training_venues');

-- Zone du Student Center (BPR 7.4.7). NULLABLE : les 13 salles des training
-- venues n'ont pas de zone dans buildings.csv (colonne vide sur 13/36 lignes).
create type mg2030_building_zone as enum ('residential', 'services_and_sports');

create type mg2030_intervention_type as enum (
  'renovation',        -- réhabilitation
  'demolition',
  'extension',         -- prévu au brief §7, aucune ligne de seed ne l'emploie
  'new_construction'
);

-- ── Passation ───────────────────────────────────────────────────────────────
-- C = consulting, W = works, G = goods, NC = non-consulting, DB = design & build.
create type mg2030_contract_type as enum ('C', 'W', 'G', 'NC', 'DB');

-- NPC = national, IPC = international. NULLABLE : C-SC-DD (gré à gré) n'en a pas.
create type mg2030_competition_type as enum ('NPC', 'IPC');

create type mg2030_procedure as enum ('REOI', 'IB', 'PQL+IB', 'RQ', 'DC');

create type mg2030_selection_method as enum (
  'QCBS', 'QBS', 'FBS', 'LCS', 'lowest_evaluated_compliant_bid'
);

-- Le seed écrit « PRIOR » en majuscules : à normaliser en minuscules au chargement.
create type mg2030_afd_review as enum ('prior', 'post');

create type mg2030_no_objection_status as enum (
  'draft', 'sent', 'no_objection', 'no_objection_with_comments', 'rejected', 'cancelled'
);

-- ── Planification ───────────────────────────────────────────────────────────
create type mg2030_task_type as enum (
  'task',          -- feuille : porte durée et dates
  'summary',       -- récapitulatif : dates AGRÉGÉES depuis les enfants
  'milestone',     -- jalon : durée 0, start = end
  'group_header'   -- simple intertitre : AUCUNE date, aucune agrégation
);

create type mg2030_dependency_type as enum ('FS', 'SS', 'FF', 'SF');

create type mg2030_constraint_kind as enum (
  'start_no_earlier_than', 'start_no_later_than',
  'finish_no_earlier_than', 'finish_no_later_than',
  'must_start_on', 'must_finish_on'
);

-- ── Livrables ───────────────────────────────────────────────────────────────
create type mg2030_deliverable_status as enum (
  'expected', 'submitted', 'under_review',
  'approved', 'approved_with_comments', 'rejected'
);

-- ── Droits ──────────────────────────────────────────────────────────────────
create type mg2030_access_mode as enum ('contributor', 'read_only');
create type mg2030_scope_kind  as enum ('global', 'subproject', 'site', 'lot');

-- ── Transverse ──────────────────────────────────────────────────────────────
create type mg2030_notification_kind as enum (
  'document_uploaded', 'milestone_reached', 'task_late',
  'deliverable_due', 'deliverable_late', 'no_objection_answered', 'complaint_registered'
);
```

16 types, tous préfixés. Aucun ne collisionne : le projet n'en compte aucun à ce
jour.

---

## 3. Organisation, utilisateurs, droits

Le brief §8 fixe **trois dimensions et pas une de plus** : organisation (mode
d'accès), rôle fonctionnel (actions), périmètre (champ des données). Les tags
gouvernent la lecture documentaire **indépendamment** de ces trois dimensions.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_organisation — DIMENSION 1 : le MODE d'accès.
-- 3 lignes, depuis la colonne `organisation` de piu_roles.csv (PIU, TA, AFD).
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_organisation (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,             -- 'PIU' | 'TA' | 'AFD'
  name         text not null,
  access_mode  mg2030_access_mode not null,      -- PIU et TA = contributor ; AFD = read_only
  created_at   timestamptz not null default now()
);
comment on column mg2030_organisation.access_mode is
  'Brief §3 : PIU et AT contribuent, AFD est en lecture seule sur tout. '
  'Cette colonne prime sur toute permission de rôle : un read_only ne peut jamais écrire.';

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_functional_role — DIMENSION 2 : les ACTIONS autorisées.
-- 14 lignes = piu_roles.csv (11 fonctions PIU + admin plateforme + TA + AFD).
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_functional_role (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,        -- COORD, CONSTR, PROC, SITEREP, ADMIN…
  title             text not null,
  organisation_id   uuid not null references mg2030_organisation(id),
  time_type         text,                        -- full_time | part_time | full_time_or_part_time
  posts             integer not null default 1,  -- SITEREP = 14, tous les autres = 1
  level_of_effort   text,                        -- ex. « 5 days per month » (COMM)
  is_platform_admin boolean not null default false,  -- vrai pour ADMIN uniquement
  source            text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_org_unit — l'ORGANIGRAMME. Une ligne par ligne de piu_roles.csv,
-- reliée à son supérieur par `parent_id` (colonne `reports_to`).
--
-- >> ARBITRAGE (GAPS 28) — Le brief cite `org_unit` comme table distincte, mais
-- le seed ne contient aucune unité au-delà des postes eux-mêmes. On modélise
-- donc l'organigramme comme un arbre de POSTES, un nœud par ligne de
-- piu_roles.csv. Si la PIU veut des unités nommées (« cellule passation »…),
-- il faudra une table supplémentaire — donnée à fournir, pas à inventer.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_org_unit (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,      -- identique à functional_role.code
  functional_role_id  uuid not null references mg2030_functional_role(id),
  parent_id           uuid references mg2030_org_unit(id) on delete set null,
  -- COORD reports_to = « MYS hierarchical superior (to be specified) » : hors
  -- périmètre applicatif, conservé en texte plutôt qu'en FK orpheline.
  reports_to_external text,
  supervises_note     text,                      -- COORD : « All PIU members »
  sort_order          integer not null default 0,
  constraint mg2030_org_unit_no_self_parent check (parent_id is null or parent_id <> id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_app_user — l'utilisateur. 1:1 avec auth.users (POOL PARTAGÉ, cf. §1).
-- Aucune inscription libre : la ligne est créée par un administrateur, puis
-- rattachée à l'identité auth à la première connexion (brief §3).
-- L'EXISTENCE d'une ligne ici est ce qui distingue un utilisateur MG2030 d'un
-- utilisateur PEEB Santa Fe.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_app_user (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null unique,
  full_name           text not null,
  job_title           text,
  organisation_id     uuid not null references mg2030_organisation(id),
  functional_role_id  uuid not null references mg2030_functional_role(id),
  org_unit_id         uuid references mg2030_org_unit(id),
  locale              text not null default 'en'
                      check (locale in ('en', 'sq')),   -- décision GAPS 40
  is_active           boolean not null default false,
  approved_at         timestamptz,
  approved_by         uuid references mg2030_app_user(id),
  last_seen_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table mg2030_app_user is
  'PROJET PARTAGÉ : auth.users est commun avec PEEB Cool Santa Fe (12 comptes '
  'préexistants). Une ligne dans cette table est la SEULE preuve qu''un compte '
  'authentifié appartient à MG2030. Voir SCHEMA.md §1.';
comment on column mg2030_app_user.is_active is
  'Faux tant qu''un administrateur n''a pas validé le compte. Un compte inactif '
  'ne franchit AUCUNE politique RLS : il ne voit rien.';
comment on column mg2030_app_user.organisation_id is
  'Dénormalisé depuis functional_role pour que les fonctions RLS ne fassent '
  'qu''une lecture. Un trigger le maintient cohérent avec le rôle.';

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_app_user_scope — DIMENSION 3 : le PÉRIMÈTRE. n lignes par utilisateur.
-- Une seule ligne `global` suffit pour l'AFD, la coordination et l'AT.
-- Un représentant sur site (SITEREP) reçoit une ligne `site`.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_app_user_scope (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references mg2030_app_user(id) on delete cascade,
  kind         mg2030_scope_kind not null,
  subproject   mg2030_subproject,                              -- ssi kind = 'subproject'
  site_id      uuid references mg2030_site(id) on delete cascade,  -- ssi kind = 'site'
  lot_id       uuid references mg2030_lot(id)  on delete cascade,  -- ssi kind = 'lot'
  created_at   timestamptz not null default now(),
  constraint mg2030_app_user_scope_target check (
    (kind = 'global'     and subproject is null and site_id is null and lot_id is null) or
    (kind = 'subproject' and subproject is not null and site_id is null and lot_id is null) or
    (kind = 'site'       and subproject is null and site_id is not null and lot_id is null) or
    (kind = 'lot'        and subproject is null and site_id is null and lot_id is not null)
  )
);
create unique index mg2030_app_user_scope_uniq
  on mg2030_app_user_scope (user_id, kind, coalesce(subproject::text, ''),
                            coalesce(site_id::text, ''), coalesce(lot_id::text, ''));
create index mg2030_app_user_scope_user_idx on mg2030_app_user_scope (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_permission / mg2030_role_permission — la matrice des ACTIONS par rôle.
-- `permission` est un vocabulaire TECHNIQUE (créé ici, pas une donnée projet).
-- `role_permission` est une donnée PROJET : elle n'est pas dans le seed.
-- >> ARBITRAGE (GAPS 11) — matrice à valider (proposition en §12).
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_permission (
  code        text primary key,   -- 'contract.write', 'task.validate', 'document.upload'…
  entity      text not null,
  action      text not null,
  description text not null
);

create table mg2030_role_permission (
  functional_role_id uuid not null references mg2030_functional_role(id) on delete cascade,
  permission_code    text not null references mg2030_permission(code)    on delete cascade,
  primary key (functional_role_id, permission_code)
);
```

---

## 4. Référentiel

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_site — 14 lignes (sites.csv). 1 Student Center + 13 salles.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_site (
  id                      uuid primary key default gen_random_uuid(),
  site_code               text not null unique,          -- SC, TV-FEFS, TV-FAIK…
  subproject              mg2030_subproject not null,
  name                    text not null,
  beneficiary_institution text,
  -- Valeurs observées : student_campus | university_sports_hall | school_sports_hall.
  site_type               text,
  address                 text,                          -- VIDE sur les 14 lignes
  latitude                numeric(9,6),                  -- VIDE sur les 14 lignes
  longitude               numeric(9,6),                  -- VIDE sur les 14 lignes
  gross_area_sqm          numeric(10,2),
  year_of_construction    integer,
  -- Valeurs observées : occupied_year_round | occupied_academic_year.
  occupancy_status        text,
  -- Brief §7 : « représentant sur site ». Nul au chargement (aucune affectation
  -- nominative dans les sources) — voir GAPS 29.
  site_representative_id  uuid references mg2030_app_user(id),
  source                  text,
  archived_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint mg2030_site_lat_lon_together check ((latitude is null) = (longitude is null))
);
comment on table mg2030_site is
  'address / latitude / longitude sont VIDES sur les 14 lignes de seed : donnée '
  'réellement absente des documents sources (README_SEED, manques 1 et 2). '
  'Bloquant pour le module carte (phase 2), pas pour la version 1.';

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_building — 36 lignes : 23 au Student Center, 13 salles TV.
-- ⚠ Une table `buildings` (non préfixée, 133 lignes) existe déjà sur le projet :
--    elle appartient à une autre application et n'a AUCUN lien avec celle-ci.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_building (
  id                   uuid primary key default gen_random_uuid(),
  building_code        text not null unique,
  site_id              uuid not null references mg2030_site(id) on delete restrict,
  name                 text not null,
  -- NULL sur les 13 salles TV : la zone ne concerne que le Student Center.
  zone                 mg2030_building_zone,
  -- Valeurs observées : dormitory, restaurant, sports_hall, administration,
  -- health_centre, amphitheatre, swimming_pool, multi_purpose_hall, cafeteria,
  -- library, commercial.
  typology             text,
  intervention_type    mg2030_intervention_type not null,
  net_area_sqm         numeric(10,2),
  gross_area_sqm       numeric(10,2),
  unit_cost_eur_sqm    numeric(10,2),
  works_estimate_eur   numeric(14,2),
  year_of_construction integer,
  construction_type    text,                     -- « TYPE 1 (unique) », « TYPE 4 »…
  source               text,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index mg2030_building_site_idx on mg2030_building (site_id);

comment on column mg2030_building.zone is
  'Contrainte volontairement ABSENTE : on pourrait exiger zone NOT NULL quand le '
  'site est athletes_village, mais cela ferait échouer le chargement si la PIU '
  'ajoute un bâtiment SC sans zone. Règle laissée à l''applicatif.';
comment on column mg2030_building.net_area_sqm is
  'Salle Tetori : 1 987 m² net (budget) contre 3 934 m² brut (programme). Les '
  'deux valeurs sont conservées — écart source, non arbitré (GAPS 17).';
comment on column mg2030_building.year_of_construction is
  'VIDE sur 5 dortoirs (Konvikti 3, 4, 6, 7, 8) : les tableaux BPR 5.2.2 et 5.4 '
  'divergent, les valeurs discordantes ont été écartées (GAPS 16).';

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_contract — 9 lignes (contracts.csv). Montants en EUROS HT.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_contract (
  id                    uuid primary key default gen_random_uuid(),
  contract_code         text not null unique,      -- C-TA, W-TV, DB-SC… (clé technique du seed)
  -- ⚠ PAS unique : 3 marchés partagent « MYS/MG2030/C/2026/XX », 3 autres
  -- « MYS/MG2030/C/2027/XX », 2 autres « MYS/MG2030/W/2027/XX ». Le suffixe XX
  -- n'est pas encore attribué (GAPS 19).
  contract_number       text not null,
  name                  text not null,
  contract_type         mg2030_contract_type not null,
  competition_type      mg2030_competition_type,   -- NULL pour C-SC-DD (gré à gré)
  procedure             mg2030_procedure not null,
  selection_method      mg2030_selection_method,   -- NULL pour C-SC-DD
  afd_review            mg2030_afd_review not null default 'prior',
  scenario_id           uuid not null references mg2030_schedule_scenario(id),
  estimated_amount_eur  numeric(14,2),             -- HT. Renseigné sur DB-SC seulement (8/9 « TBD »)
  contracted_amount_eur numeric(14,2),             -- HT. Brief §7 ; absent du seed
  contractor            text,                      -- nul jusqu'à l'attribution
  spn_publication_date  date,
  bid_opening_date      date,
  signature_date        date,
  completion_date       date,
  source                text,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint mg2030_contract_number_format check (
    contract_number ~ '^MYS/MG2030/(C|W|G|NC|DB)/[0-9]{4}/([0-9]{2}|XX)$'
  ),
  constraint mg2030_contract_dates_ordered check (
    (spn_publication_date is null or bid_opening_date  is null or spn_publication_date <= bid_opening_date) and
    (bid_opening_date     is null or signature_date    is null or bid_opening_date     <= signature_date)   and
    (signature_date       is null or completion_date   is null or signature_date       <= completion_date)
  )
);
create index mg2030_contract_scenario_idx on mg2030_contract (scenario_id);

comment on constraint mg2030_contract_number_format on mg2030_contract is
  'Format imposé au brief §7. Le suffixe littéral XX est accepté : c''est la '
  'valeur réelle du plan de passation, non encore attribuée.';
comment on column mg2030_contract.contract_type is
  'Les 3 marchés de fournitures sont numérotés .../C/... au plan de passation '
  'alors que leur type est G. contract_number reproduit la source, '
  'contract_type vaut G (GAPS 18). La contrainte de format ne croise donc PAS '
  'contract_type et le segment du numéro — volontairement.';
comment on column mg2030_contract.estimated_amount_eur is
  'EUROS HORS TAXES (décision GAPS 42). Le plan de passation annonce des '
  'montants « inclusive of tax » mais les valeurs chargées viennent du budget '
  'projet BPR 7.7, qui est HT. Aucune colonne TTC n''est prévue.';

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_lot — 15 lignes (lots.csv).
-- >> ARBITRAGE (GAPS 34) — Le brief §7 dit « montant » (singulier) ; le seed
-- porte une FOURCHETTE (min/max), le BPR donnant des bornes pour les lots de
-- training venues. On conserve les deux bornes ; l'interface affichera une
-- fourchette quand min <> max et une valeur unique sinon.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_lot (
  id                    uuid primary key default gen_random_uuid(),
  lot_code              text not null unique,
  contract_id           uuid not null references mg2030_contract(id) on delete cascade,
  lot_number            integer not null,
  name                  text not null,
  amount_eur_min        numeric(14,2),
  amount_eur_max        numeric(14,2),
  contracted_amount_eur numeric(14,2),
  min_turnover_eur_min  numeric(14,2),
  min_turnover_eur_max  numeric(14,2),
  contractor            text,
  source                text,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (contract_id, lot_number),
  constraint mg2030_lot_amount_range   check (amount_eur_min       is null or amount_eur_max       is null or amount_eur_min       <= amount_eur_max),
  constraint mg2030_lot_turnover_range check (min_turnover_eur_min is null or min_turnover_eur_max is null or min_turnover_eur_min <= min_turnover_eur_max)
);
create index mg2030_lot_contract_idx on mg2030_lot (contract_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_lot_building — relation n:n. 46 lignes chargées sur les 59 du CSV.
-- Les 13 lignes à lot_code VIDE (les 13 salles TV) ne sont PAS chargées : une
-- affectation inconnue est une ABSENCE de ligne, pas une ligne à lot nul.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_lot_building (
  lot_id      uuid not null references mg2030_lot(id)      on delete cascade,
  building_id uuid not null references mg2030_building(id) on delete cascade,
  source      text,
  primary key (lot_id, building_id)
);
create index mg2030_lot_building_building_idx on mg2030_lot_building (building_id);

comment on table mg2030_lot_building is
  'Les 23 bâtiments du Student Center apparaissent DEUX fois : une fois sur les '
  'lots W-SC-* (voie classique) et une fois sur les lots DB-SC-* (Design & Build). '
  'C''est voulu : les deux scénarios sont mutuellement exclusifs et l''interface '
  'bascule de l''un à l''autre. 23 x 2 = 46 lignes.';
```

---

## 5. Moteur de planification — cœur du système

> Le calendrier global et le calendrier de passation sont **le même objet**
> (brief §7). Il n'y a donc qu'une seule table de tâches.

### 5.1 Scénarios et plans

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_schedule_scenario — 3 lignes : base, design_bid_build, design_build.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_schedule_scenario (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,   -- 'base' | 'design_bid_build' | 'design_build'
  name               text not null,
  description        text,
  -- Deux scénarios partageant le même groupe sont MUTUELLEMENT EXCLUSIFS.
  -- 'sc_route' pour design_bid_build et design_build ; NULL pour base, commun
  -- aux deux voies (README_SEED, conventions).
  exclusive_group    text,
  is_active          boolean not null default false,  -- l'hypothèse retenue à l'instant t
  -- Marge terminale (brief §7). Portée ici ET matérialisée en jalons dans la
  -- table des tâches (MS.1 / MS.2). Voir >> ARBITRAGE GAPS 39.
  buffer_start_date  date,
  buffer_months      integer,
  deadline_date      date,                   -- échéance des Jeux, non négociable
  -- Vrai tant qu'aucune tâche n'est chargée : interdit de présenter le scénario
  -- à un utilisateur. Voir GAPS 9.
  is_schedulable     boolean not null default false,
  created_at         timestamptz not null default now()
);

-- Un seul scénario actif par groupe d'exclusion.
create unique index mg2030_schedule_scenario_one_active_per_group
  on mg2030_schedule_scenario (exclusive_group)
  where is_active and exclusive_group is not null;

comment on column mg2030_schedule_scenario.is_schedulable is
  'FAUX pour design_bid_build : le fichier Excel source calcule ce scénario À '
  'REBOURS depuis la fin du Design & Build, aboutissant à une fin de travaux au '
  '13/10/2031, soit 21 mois APRÈS les Jeux (README_PLANNING, anomalie 1). Aucune '
  'date n''est inventée : le scénario est chargé SANS tâches et l''interface doit '
  'refuser de l''afficher tant que is_schedulable est faux. C''est la voie de '
  'droit commun — le Design & Build repose sur une dérogation (BPR 7.4).';

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_plan — regroupement de tâches issu d'un onglet du fichier source.
-- 2 lignes : TV (→ base) et SC-DB (→ design_build).
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_plan (
  id           uuid primary key default gen_random_uuid(),
  plan_code    text not null unique,          -- 'TV' | 'SC-DB'
  name         text not null,
  scenario_id  uuid not null references mg2030_schedule_scenario(id) on delete restrict,
  source_sheet text,
  created_at   timestamptz not null default now()
);
```

### 5.2 Tâches

**Convention de durée — vérifiée sur les 21 tâches datées du seed :**

| Règle | Vérification |
|---|---|
| `duration_weeks = round(duration_days / 7, 2)` | **21/21 exactes** (98→14,00 · 10→1,43 · 15→2,14 · 30→4,29 · 822→117,43) |
| `end_date = start_date + duration_days` | 19/21 au CSV — **21/21 après la correction GAPS 12** |
| `start = MAX(fin des prédécesseurs) + lag` | **17/17 exactes**, convergences `MAX` incluses |
| `summary` : `start = MIN(enfants)`, `end = MAX(enfants)` | **3/3 exactes** (TV.2, TV.3.1, SC.2) |
| `group_header` : **aucune** agrégation | Confirmé : TV.3 est sans dates alors que ses enfants couvrent 2027-08-05 → 2029-02-01 |

> **Correction appliquée (décision GAPS 12).** `TV.2.1` (EOI) et `SC.2.2`
> (Initial Selection) portaient `duration_days = 21` pour un écart de dates de
> **20 jours**. La durée retenue est **20 jours** (2,86 semaines) : c'est la
> seule valeur qui préserve les 12 dates aval et la concordance au jour près
> avec le plan de passation. Avec cette correction, `end = start + duration_days`
> est vrai sur **21/21** et le recalcul à l'import (décision GAPS 44) devient
> l'identité — aucune date ne bouge.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_task — hiérarchie de profondeur arbitraire. 27 lignes au chargement
-- (15 plan TV + 10 plan SC-DB + 2 jalons projet).
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_task (
  id               uuid primary key default gen_random_uuid(),
  wbs_code         text not null,               -- TV.2.7, SC.2.8, MS.1…
  plan_id          uuid not null references mg2030_plan(id) on delete cascade,
  scenario_id      uuid not null references mg2030_schedule_scenario(id) on delete restrict,
  parent_id        uuid references mg2030_task(id) on delete cascade,
  task_type        mg2030_task_type not null default 'task',
  group_label      text,                        -- colonne `group` : Design, Works, DESIGN & BUILD
  activity         text not null,               -- l'intitulé affiché

  -- ── Entrées du moteur ────────────────────────────────────────────────────
  -- duration_days est l'AUTORITÉ. duration_weeks est dérivée : le fichier Excel
  -- source calcule lui-même jours / 7 (nom défini `week` = 7, onglet parameters).
  duration_days    integer check (duration_days >= 0),
  duration_weeks   numeric(6,2)
                   generated always as (round(duration_days / 7.0, 2)) stored,

  -- Date de début SAISIE (ancre). Nulle si la tâche est pilotée par ses
  -- prédécesseurs. Les 4 tâches sans prédécesseur du seed portent une contrainte
  -- start_no_earlier_than plutôt qu'une valeur ici.
  start_date_input date,

  -- Dates EFFECTIVES, résultat du recalcul en cascade. Écrites par le moteur,
  -- jamais saisies directement.
  start_date       date,
  end_date         date,

  -- ── Rattachements ────────────────────────────────────────────────────────
  contract_id      uuid references mg2030_contract(id) on delete set null,
  lot_id           uuid references mg2030_lot(id)      on delete set null,
  site_id          uuid references mg2030_site(id)     on delete set null,

  -- ── Suivi ────────────────────────────────────────────────────────────────
  owner_id          uuid references mg2030_app_user(id),  -- VIDE au chargement
  validator_id      uuid references mg2030_app_user(id),  -- VIDE au chargement
  progress_pct      numeric(5,2) check (progress_pct between 0 and 100),
  actual_start_date date,
  actual_end_date   date,

  -- ── Origine ──────────────────────────────────────────────────────────────
  generated_from_step_id uuid references mg2030_procurement_template_step(id) on delete set null,
  source_sheet     text,
  source_row       text,                        -- « 15 », « AY6 », « C5 » → text, pas integer
  sort_order       integer not null default 0,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (plan_id, wbs_code),
  constraint mg2030_task_no_self_parent check (parent_id is null or parent_id <> id),
  constraint mg2030_task_dates_ordered  check (start_date is null or end_date is null or start_date <= end_date),
  -- Un jalon n'a pas de durée et ne dure pas.
  constraint mg2030_task_milestone_zero check (
    task_type <> 'milestone'
    or (coalesce(duration_days, 0) = 0 and (start_date is null or start_date = end_date))
  ),
  -- Un intertitre ne porte ni durée ni date : il ne fait qu'organiser la liste.
  constraint mg2030_task_group_header_bare check (
    task_type <> 'group_header'
    or (duration_days is null and start_date is null and end_date is null)
  )
);

create index mg2030_task_plan_idx     on mg2030_task (plan_id, sort_order);
create index mg2030_task_parent_idx   on mg2030_task (parent_id);
create index mg2030_task_scenario_idx on mg2030_task (scenario_id);
create index mg2030_task_contract_idx on mg2030_task (contract_id) where contract_id is not null;
create index mg2030_task_lot_idx      on mg2030_task (lot_id)      where lot_id      is not null;
create index mg2030_task_site_idx     on mg2030_task (site_id)     where site_id     is not null;
create index mg2030_task_window_idx   on mg2030_task (start_date, end_date);

comment on column mg2030_task.source_row is
  'TEXT et non INTEGER : les deux jalons du seed viennent de cellules nommées '
  '(AY6 pour le début de la marge de 4 mois, C5 pour la fin des travaux).';
comment on column mg2030_task.duration_weeks is
  'Colonne GÉNÉRÉE. La conversion jours = semaines x 7 du brief §7 est confirmée '
  'par le fichier source (nom défini `week` = 7). Toute autre convention '
  'casserait la reprise de l''historique.';

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_task_dependency — précédence avec décalage. 19 lignes au chargement,
-- toutes FS lag 0. DEUX tâches ont deux prédécesseurs (TV.2.4 et SC.2.5,
-- formules MAX) : le moteur DOIT gérer les convergences.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_task_dependency (
  predecessor_id  uuid not null references mg2030_task(id) on delete cascade,
  successor_id    uuid not null references mg2030_task(id) on delete cascade,
  dependency_type mg2030_dependency_type not null default 'FS',
  lag_days        integer not null default 0,
  source_formula  text,                       -- « TV!C27 = MAX(I15,I26) »
  created_at      timestamptz not null default now(),
  primary key (successor_id, predecessor_id),
  constraint mg2030_task_dependency_not_self check (predecessor_id <> successor_id)
);
create index mg2030_task_dependency_pred_idx on mg2030_task_dependency (predecessor_id);

comment on table mg2030_task_dependency is
  'Version 1 : seul FS est produit par le seed et utilisé par le moteur. '
  'SS / FF / SF sont déclarés dans l''enum pour ne pas avoir à migrer plus tard, '
  'mais le moteur doit lever une erreur explicite tant qu''ils ne sont pas '
  'implémentés.';

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_task_constraint — contrainte de date INDÉPENDANTE d'un prédécesseur.
-- 4 lignes au chargement (TV.1, TV.2.1, SC.1, SC.2.2), toutes
-- start_no_earlier_than : ce sont les 4 dates saisies en dur du fichier Excel.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_task_constraint (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references mg2030_task(id) on delete cascade,
  kind            mg2030_constraint_kind not null,
  constraint_date date not null,
  source          text,
  created_at      timestamptz not null default now(),
  unique (task_id, kind)
);
```

### 5.3 Règles de recalcul en cascade

Le moteur est **pur** (TypeScript, sans accès base ni React), à l'image de
`lib/schedule.ts` du dépôt de charte, et **couvert par des tests unitaires**
(brief §7). Postgres ne fait que persister le résultat.

```
Pour chaque tâche T, en ordre topologique sur mg2030_task_dependency :

  1. group_header          → aucune date, aucune agrégation. On passe.

  2. summary               → start = MIN(start des enfants)
                             end   = MAX(end   des enfants)

  3. milestone             → start = end = date issue de la contrainte
                             ou du prédécesseur. duration = 0.

  4. task (feuille)        →
       candidats_start = [ ]
       pour chaque dépendance FS entrante :
           candidats_start += predecesseur.end + lag_days
       pour chaque contrainte start_no_earlier_than :
           candidats_start += constraint_date
       si start_date_input est renseignée :
           candidats_start += start_date_input

       start = MAX(candidats_start)              ← gère les CONVERGENCES
       end   = start + duration_days

Convention de bornes : end est la date à laquelle le successeur DÉMARRE.
Une tâche de 14 jours du 21/09 finit le 05/10, et son successeur commence
le 05/10. La durée est donc l'écart entre les deux dates, borne de fin
exclue. Confirmé par les 17 dépendances du seed.

Cycles : refusés, par trigger (parcours récursif) à l'insertion et à la
mise à jour.
```

```sql
-- Refus des cycles de précédence.
create or replace function mg2030_private.task_dependency_no_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    with recursive reachable(id) as (
      select new.successor_id
      union
      select d.successor_id
        from public.mg2030_task_dependency d
        join reachable r on d.predecessor_id = r.id
    )
    select 1 from reachable where id = new.predecessor_id
  ) then
    raise exception
      'Cycle de precedence refuse : % ne peut pas preceder % (chemin inverse existant)',
      new.predecessor_id, new.successor_id;
  end if;
  return new;
end;
$$;

create trigger mg2030_task_dependency_no_cycle
  before insert or update on mg2030_task_dependency
  for each row execute function mg2030_private.task_dependency_no_cycle();

-- Même principe sur mg2030_task.parent_id
-- (fonction mg2030_private.task_parent_no_cycle, non répétée ici).
```

---

## 6. Passation

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Gabarits de passation (brief §7).
-- >> ARBITRAGE (GAPS 10) — AUCUNE donnée de gabarit dans seed/ : ces tables
-- sont créées VIDES. Une séquence candidate, OBSERVÉE dans tasks.csv, est
-- proposée en §12 mais n'est pas chargée.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_procurement_template (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  procedure        mg2030_procedure not null,
  contract_type    mg2030_contract_type,
  selection_method mg2030_selection_method,
  description      text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table mg2030_procurement_template_step (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references mg2030_procurement_template(id) on delete cascade,
  step_no               integer not null,
  name                  text not null,
  default_duration_days integer not null check (default_duration_days >= 0),
  owner_role_id         uuid references mg2030_functional_role(id),
  validator_role_id     uuid references mg2030_functional_role(id),
  -- Vrai si l'étape est un avis de non-objection AFD : l'instanciation crée
  -- alors aussi une ligne mg2030_no_objection.
  is_afd_no_objection   boolean not null default false,
  -- Étape rattachée à un jalon contractuel connu : permet de recaler le gabarit
  -- sur les dates du marché.
  contract_date_anchor  text check (contract_date_anchor in
                          ('spn_publication_date','bid_opening_date','signature_date','completion_date')),
  unique (template_id, step_no)
);

-- Instanciation : créer un contrat applique le gabarit et génère les tâches.
-- Le lien remonte par mg2030_task.generated_from_step_id (§5.2).
create table mg2030_contract_template_instance (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references mg2030_contract(id) on delete cascade,
  template_id  uuid not null references mg2030_procurement_template(id) on delete restrict,
  applied_at   timestamptz not null default now(),
  applied_by   uuid references mg2030_app_user(id),
  unique (contract_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_no_objection — demandes d'avis de non-objection AFD (brief §7).
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_no_objection (
  id            uuid primary key default gen_random_uuid(),
  reference     text unique,
  subject       text not null,
  contract_id   uuid references mg2030_contract(id) on delete cascade,
  lot_id        uuid references mg2030_lot(id)      on delete cascade,
  task_id       uuid references mg2030_task(id)     on delete set null,
  status        mg2030_no_objection_status not null default 'draft',
  sent_date     date,
  response_date date,
  document_id   uuid references mg2030_document(id) on delete set null,  -- « pièce liée »
  requested_by  uuid references mg2030_app_user(id),
  comments      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint mg2030_no_objection_has_target check (
    contract_id is not null or lot_id is not null or task_id is not null
  ),
  constraint mg2030_no_objection_dates check (
    sent_date is null or response_date is null or sent_date <= response_date
  ),
  -- Une réponse implique une date de réponse, et inversement.
  constraint mg2030_no_objection_answer_coherent check (
    (status in ('no_objection','no_objection_with_comments','rejected'))
      = (response_date is not null)
  )
);
create index mg2030_no_objection_contract_idx on mg2030_no_objection (contract_id);
create index mg2030_no_objection_open_idx     on mg2030_no_objection (status) where status = 'sent';
```

---

## 7. Livrables

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_deliverable — rapports des consultants ET livrables des entreprises.
-- L'émetteur est un TEXTE : ni les consultants ni les entreprises ne sont
-- utilisateurs de la plateforme (brief §3).
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_deliverable (
  id                     uuid primary key default gen_random_uuid(),
  contract_id            uuid references mg2030_contract(id) on delete cascade,
  lot_id                 uuid references mg2030_lot(id)      on delete cascade,
  title                  text not null,
  issuer                 text,                    -- consultant ou entreprise, en clair
  contractual_date       date,
  actual_submission_date date,
  status                 mg2030_deliverable_status not null default 'expected',
  visa_by                uuid references mg2030_app_user(id),
  visa_date              date,
  document_id            uuid references mg2030_document(id) on delete set null,
  comments               text,
  archived_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint mg2030_deliverable_has_origin  check (contract_id is not null or lot_id is not null),
  constraint mg2030_deliverable_visa_coherent check ((visa_by is null) = (visa_date is null))
);
create index mg2030_deliverable_due_idx on mg2030_deliverable (contractual_date)
  where status in ('expected', 'submitted', 'under_review');

-- Détection des manquants et des retards : DÉRIVÉE, jamais stockée.
create view mg2030_deliverable_status_v
with (security_invoker = true) as
select d.*,
       (d.actual_submission_date is null
        and d.contractual_date is not null
        and d.contractual_date < current_date)                       as is_late,
       (d.actual_submission_date is not null
        and d.contractual_date is not null
        and d.actual_submission_date > d.contractual_date)           as was_late,
       case
         when d.actual_submission_date is not null then null
         when d.contractual_date is null           then null
         else d.contractual_date - current_date
       end                                                           as days_to_due
  from mg2030_deliverable d
 where d.archived_at is null;
```

---

## 8. Documents

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_folder — arborescence auto-référencée, modifiable par les
-- administrateurs. 39 lignes au chargement (folder_tree.csv) — c'est une
-- PROPOSITION, pas une donnée projet : la colonne `note` de tous les
-- enregistrements vaut « proposition ».
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_folder (
  id             uuid primary key default gen_random_uuid(),
  parent_id      uuid references mg2030_folder(id) on delete restrict,
  name           text not null,
  -- Chemin matérialisé, maintenu par trigger : évite un CTE récursif à chaque
  -- affichage de l'arborescence.
  path           text not null unique,
  default_tag_id uuid references mg2030_tag(id) on delete set null,
  sort_order     integer not null default 0,
  created_by     uuid references mg2030_app_user(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (parent_id, name),
  constraint mg2030_folder_no_self_parent check (parent_id is null or parent_id <> id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_document — métadonnées. Le fichier vit dans Cloudflare R2 ; l'upload
-- se fait en direct par URL pré-signée, jamais via une fonction serveur (brief §4).
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_document (
  id                uuid primary key default gen_random_uuid(),
  folder_id         uuid not null references mg2030_folder(id) on delete restrict,
  r2_object_key     text not null unique,
  r2_thumbnail_key  text,                       -- vignette servie depuis R2, jamais par Vercel
  original_filename text not null,
  size_bytes        bigint not null check (size_bytes >= 0),
  mime_type         text not null,
  description       text,
  uploaded_by       uuid not null references mg2030_app_user(id),
  uploaded_at       timestamptz not null default now(),
  -- Rattachements facultatifs, pour retrouver un document depuis un objet métier.
  contract_id       uuid references mg2030_contract(id) on delete set null,
  lot_id            uuid references mg2030_lot(id)      on delete set null,
  site_id           uuid references mg2030_site(id)     on delete set null,
  task_id           uuid references mg2030_task(id)     on delete set null,
  archived_at       timestamptz
);
create index mg2030_document_folder_idx   on mg2030_document (folder_id);
create index mg2030_document_uploaded_idx on mg2030_document (uploaded_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Tags — la lecture documentaire, gouvernée INDÉPENDAMMENT des trois dimensions
-- de droits (brief §8). 4 tags initiaux : procurement, technical_documentation,
-- piu_admin, environmental_social.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_tag (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  label      text not null,             -- libellé de référence (anglais)
  label_sq   text,                      -- albanais (locale `sq`), à valider par la PIU
  color      text,                      -- hex, palette de UI_TOKENS
  is_system  boolean not null default false,   -- vrai pour les 4 tags initiaux
  created_at timestamptz not null default now()
);

create table mg2030_document_tag (
  document_id uuid not null references mg2030_document(id) on delete cascade,
  tag_id      uuid not null references mg2030_tag(id)      on delete cascade,
  primary key (document_id, tag_id)
);
create index mg2030_document_tag_tag_idx on mg2030_document_tag (tag_id);

-- Autorisation de LECTURE par tag, accordée soit à un rôle, soit à un
-- utilisateur nommé — jamais aux deux sur la même ligne.
create table mg2030_tag_access (
  id                 uuid primary key default gen_random_uuid(),
  tag_id             uuid not null references mg2030_tag(id) on delete cascade,
  functional_role_id uuid references mg2030_functional_role(id) on delete cascade,
  user_id            uuid references mg2030_app_user(id)        on delete cascade,
  created_at         timestamptz not null default now(),
  constraint mg2030_tag_access_one_grantee check (
    (functional_role_id is not null) <> (user_id is not null)
  )
);
create unique index mg2030_tag_access_role_uniq on mg2030_tag_access (tag_id, functional_role_id)
  where functional_role_id is not null;
create unique index mg2030_tag_access_user_uniq on mg2030_tag_access (tag_id, user_id)
  where user_id is not null;

comment on table mg2030_tag_access is
  'Un document SANS tag est visible de tous les utilisateurs MG2030 actifs '
  '(brief §7). Document MULTI-TAGS : regle de l''UNION — un seul tag autorise '
  'suffit (decision du 19/08/2026, GAPS 33). Coherent avec le mot '
  '« autorisation », qui decrit un octroi.';
```

---

## 9. Transverse

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_notification — applicatives uniquement. Pas d'e-mail en version 1.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_notification (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references mg2030_app_user(id) on delete cascade,
  kind         mg2030_notification_kind not null,
  title        text not null,
  body         text,
  entity_table text,
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index mg2030_notification_inbox_idx on mg2030_notification (user_id, created_at desc)
  where read_at is null;

comment on table mg2030_notification is
  'Les notifications d''ÉVÉNEMENT (dépôt de document, plainte enregistrée) sont '
  'produites par trigger. Celles d''ÉTAT (franchissement de jalon, retard) '
  'supposent une évaluation périodique : sans pg_cron ni Edge Functions '
  '(brief §4), il faut une route Next appelée par Vercel Cron. >> ARBITRAGE GAPS 35.';

-- ─────────────────────────────────────────────────────────────────────────────
-- mg2030_change_log — historique applicatif SIMPLE. Sans prétention probante :
-- pas de chaîne de preuve, pas de journal immuable (brief §2).
-- Une ligne par CHAMP modifié, comme demandé au brief §7.
-- ─────────────────────────────────────────────────────────────────────────────
create table mg2030_change_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     uuid not null,
  field      text not null,
  old_value  text,
  new_value  text,
  operation  char(1) not null check (operation in ('I','U','D')),
  changed_by uuid references mg2030_app_user(id),
  changed_at timestamptz not null default now()
);
create index mg2030_change_log_row_idx  on mg2030_change_log (table_name, row_id, changed_at desc);
create index mg2030_change_log_user_idx on mg2030_change_log (changed_by, changed_at desc);

-- Trigger générique, à poser sur les tables métier.
create or replace function mg2030_private.log_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  o jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
begin
  for k in select jsonb_object_keys(o || n) loop
    continue when k in ('updated_at', 'created_at');   -- bruit technique
    if o -> k is distinct from n -> k then
      insert into public.mg2030_change_log
        (table_name, row_id, field, old_value, new_value, operation, changed_by)
      values (
        tg_table_name,
        coalesce((n ->> 'id')::uuid, (o ->> 'id')::uuid),
        k, o ->> k, n ->> k,
        left(tg_op, 1), auth.uid()
      );
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;

-- Exemple de pose (à répéter sur les 15 tables métier) :
create trigger mg2030_contract_change_log
  after insert or update or delete on mg2030_contract
  for each row execute function mg2030_private.log_changes();
```

---

## 10. Sécurité — fonctions et politiques RLS

> Mise en œuvre par RLS Postgres, **jamais par filtrage applicatif seul**
> (brief §8).

### 10.1 Le schéma privé

```sql
create schema if not exists mg2030_private;
revoke all on schema mg2030_private from public, anon, authenticated;
grant usage on schema mg2030_private to authenticated;
```

Le schéma **n'est pas exposé** dans `Settings → API → Exposed schemas` : les
fonctions ne doivent jamais être appelables depuis le client. `grant usage`
suffit pour que le planificateur les évalue dans les politiques.

### 10.2 Fonctions d'appui

Toutes en `security definer` (pour lire `mg2030_app_user` sans déclencher sa
propre RLS et créer une récursion), `stable` (évaluées une fois par requête), et
`set search_path = ''` (obligatoire sur Supabase pour les `security definer`).

```sql
-- ⚠ FONCTION FONDATRICE — voir §1. auth.users est PARTAGÉ avec PEEB Santa Fe.
-- Appartenance à l'application MG2030. AUCUNE politique ne s'en dispense.
create or replace function mg2030_private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mg2030_app_user u where u.id = (select auth.uid())
  );
$$;

-- Compte MG2030 actif et validé.
create or replace function mg2030_private.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mg2030_app_user u
     where u.id = (select auth.uid()) and u.is_active
  );
$$;

-- DIMENSION 1 — peut-il écrire ? (l'AFD est read_only sur tout)
create or replace function mg2030_private.can_write() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.mg2030_app_user     u
      join public.mg2030_organisation o on o.id = u.organisation_id
     where u.id = (select auth.uid())
       and u.is_active
       and o.access_mode = 'contributor'
  );
$$;

-- Administrateur de la plateforme (rôle ADMIN).
create or replace function mg2030_private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.mg2030_app_user        u
      join public.mg2030_functional_role r on r.id = u.functional_role_id
     where u.id = (select auth.uid()) and u.is_active and r.is_platform_admin
  );
$$;

-- DIMENSION 2 — l'action est-elle autorisée pour son rôle ?
create or replace function mg2030_private.has_perm(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select mg2030_private.is_platform_admin()
      or exists (
        select 1
          from public.mg2030_app_user        u
          join public.mg2030_role_permission rp on rp.functional_role_id = u.functional_role_id
         where u.id = (select auth.uid()) and u.is_active and rp.permission_code = p
      );
$$;

-- DIMENSION 3 — périmètre.
create or replace function mg2030_private.has_global_scope() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mg2030_app_user_scope s
     where s.user_id = (select auth.uid()) and s.kind = 'global'
  );
$$;

-- Un site est visible si : périmètre global, OU son sous-projet est au périmètre,
-- OU le site est nommément au périmètre, OU un lot du périmètre contient un
-- bâtiment de ce site.
create or replace function mg2030_private.can_see_site(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select mg2030_private.has_global_scope()
      or exists (
        select 1
          from public.mg2030_app_user_scope s
          join public.mg2030_site si on si.id = p_site
         where s.user_id = (select auth.uid())
           and (
             (s.kind = 'subproject' and s.subproject = si.subproject) or
             (s.kind = 'site'       and s.site_id    = si.id)         or
             (s.kind = 'lot' and exists (
                 select 1
                   from public.mg2030_lot_building lb
                   join public.mg2030_building     b on b.id = lb.building_id
                  where lb.lot_id = s.lot_id and b.site_id = si.id))
           )
      );
$$;

-- Un lot est visible s'il est nommément au périmètre, ou si l'un de ses
-- bâtiments est sur un site visible. Un lot sans bâtiment (assistance
-- technique, supervision) est de portée PROJET : visible de tous.
create or replace function mg2030_private.can_see_lot(p_lot uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select mg2030_private.has_global_scope()
      or exists (select 1 from public.mg2030_app_user_scope s
                  where s.user_id = (select auth.uid()) and s.kind = 'lot' and s.lot_id = p_lot)
      or exists (select 1
                   from public.mg2030_lot_building lb
                   join public.mg2030_building     b on b.id = lb.building_id
                  where lb.lot_id = p_lot and mg2030_private.can_see_site(b.site_id))
      or not exists (select 1 from public.mg2030_lot_building lb where lb.lot_id = p_lot);
$$;

-- Un marché est visible si l'un de ses lots l'est. Un marché sans lot rattaché
-- à un bâtiment est de portée projet.
create or replace function mg2030_private.can_see_contract(p_contract uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select mg2030_private.has_global_scope()
      or exists (select 1 from public.mg2030_lot l
                  where l.contract_id = p_contract and mg2030_private.can_see_lot(l.id));
$$;

-- Une tâche est visible selon son rattachement le plus fin. Une tâche sans
-- aucun rattachement est de portée projet : visible de tous les comptes actifs.
create or replace function mg2030_private.can_see_task(p_site uuid, p_lot uuid, p_contract uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select mg2030_private.has_global_scope()
      or (p_site is null and p_lot is null and p_contract is null)
      or (p_site     is not null and mg2030_private.can_see_site(p_site))
      or (p_lot      is not null and mg2030_private.can_see_lot(p_lot))
      or (p_contract is not null and mg2030_private.can_see_contract(p_contract));
$$;

-- Lecture documentaire : gouvernée par les TAGS, indépendamment des 3 dimensions.
-- Sans tag → visible de tous les comptes MG2030 actifs. Avec tags → UNION des
-- grants (voir >> ARBITRAGE GAPS 33).
create or replace function mg2030_private.can_read_document(p_doc uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select mg2030_private.is_platform_admin()
      or not exists (select 1 from public.mg2030_document_tag dt where dt.document_id = p_doc)
      or exists (
          select 1
            from public.mg2030_document_tag dt
            join public.mg2030_tag_access   ta on ta.tag_id = dt.tag_id
            join public.mg2030_app_user     u  on u.id = (select auth.uid())
           where dt.document_id = p_doc
             and (ta.user_id = u.id or ta.functional_role_id = u.functional_role_id)
      );
$$;
```

### 10.3 Politiques

Patron systématique : **une politique de lecture** portant le périmètre, **une
politique d'écriture** portant `can_write() AND has_perm(...) AND` le même
périmètre. Le rôle `anon` n'a de politique nulle part : sans session, rien.

Chaque politique de lecture commence par `is_active_user()`, qui implique
`is_member()` : un compte PEEB Santa Fe ne franchit aucune politique.

```sql
-- Activation, sur les 29 tables sans exception.
alter table mg2030_organisation                enable row level security;
alter table mg2030_functional_role             enable row level security;
alter table mg2030_org_unit                    enable row level security;
alter table mg2030_app_user                    enable row level security;
alter table mg2030_app_user_scope              enable row level security;
alter table mg2030_permission                  enable row level security;
alter table mg2030_role_permission             enable row level security;
alter table mg2030_site                        enable row level security;
alter table mg2030_building                    enable row level security;
alter table mg2030_contract                    enable row level security;
alter table mg2030_lot                         enable row level security;
alter table mg2030_lot_building                enable row level security;
alter table mg2030_schedule_scenario           enable row level security;
alter table mg2030_plan                        enable row level security;
alter table mg2030_task                        enable row level security;
alter table mg2030_task_dependency             enable row level security;
alter table mg2030_task_constraint             enable row level security;
alter table mg2030_procurement_template        enable row level security;
alter table mg2030_procurement_template_step   enable row level security;
alter table mg2030_contract_template_instance  enable row level security;
alter table mg2030_no_objection                enable row level security;
alter table mg2030_deliverable                 enable row level security;
alter table mg2030_folder                      enable row level security;
alter table mg2030_document                    enable row level security;
alter table mg2030_tag                         enable row level security;
alter table mg2030_document_tag                enable row level security;
alter table mg2030_tag_access                  enable row level security;
alter table mg2030_notification                enable row level security;
alter table mg2030_change_log                  enable row level security;

-- ── Référentiels de droits : lecture pour tout compte MG2030 actif ──────────
create policy mg2030_organisation_read_all on mg2030_organisation
  for select to authenticated using (mg2030_private.is_active_user());
create policy mg2030_organisation_write_admin on mg2030_organisation
  for all to authenticated
  using (mg2030_private.is_platform_admin()) with check (mg2030_private.is_platform_admin());
-- (idem mg2030_functional_role, mg2030_org_unit, mg2030_permission,
--       mg2030_role_permission, mg2030_tag, mg2030_tag_access)

-- ── Utilisateurs ────────────────────────────────────────────────────────────
-- Chacun lit l'annuaire MG2030 (l'organigramme est un livrable de la v1), mais
-- ne modifie que sa propre fiche ; l'ADMIN modifie tout.
create policy mg2030_app_user_read_all on mg2030_app_user
  for select to authenticated using (mg2030_private.is_active_user());
create policy mg2030_app_user_update_self on mg2030_app_user
  for update to authenticated
  using      (id = (select auth.uid()) and mg2030_private.can_write())
  with check (id = (select auth.uid()) and mg2030_private.can_write());
create policy mg2030_app_user_admin_all on mg2030_app_user
  for all to authenticated
  using (mg2030_private.is_platform_admin()) with check (mg2030_private.is_platform_admin());

create policy mg2030_app_user_scope_read_self on mg2030_app_user_scope
  for select to authenticated
  using (user_id = (select auth.uid()) or mg2030_private.is_platform_admin());
create policy mg2030_app_user_scope_admin on mg2030_app_user_scope
  for all to authenticated
  using (mg2030_private.is_platform_admin()) with check (mg2030_private.is_platform_admin());

-- ── Sites et bâtiments ──────────────────────────────────────────────────────
create policy mg2030_site_read_scoped on mg2030_site
  for select to authenticated
  using (mg2030_private.is_active_user() and mg2030_private.can_see_site(id));
create policy mg2030_site_write_scoped on mg2030_site
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('site.write')
              and mg2030_private.can_see_site(id))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('site.write')
              and mg2030_private.can_see_site(id));

create policy mg2030_building_read_scoped on mg2030_building
  for select to authenticated
  using (mg2030_private.is_active_user() and mg2030_private.can_see_site(site_id));
create policy mg2030_building_write_scoped on mg2030_building
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('building.write')
              and mg2030_private.can_see_site(site_id))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('building.write')
              and mg2030_private.can_see_site(site_id));

-- ── Marchés, lots, affectations ─────────────────────────────────────────────
create policy mg2030_contract_read_scoped on mg2030_contract
  for select to authenticated
  using (mg2030_private.is_active_user() and mg2030_private.can_see_contract(id));
create policy mg2030_contract_write_scoped on mg2030_contract
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('contract.write')
              and mg2030_private.can_see_contract(id))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('contract.write')
              and mg2030_private.can_see_contract(id));

create policy mg2030_lot_read_scoped on mg2030_lot
  for select to authenticated
  using (mg2030_private.is_active_user() and mg2030_private.can_see_lot(id));
create policy mg2030_lot_write_scoped on mg2030_lot
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('contract.write')
              and mg2030_private.can_see_lot(id))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('contract.write')
              and mg2030_private.can_see_lot(id));

create policy mg2030_lot_building_read_scoped on mg2030_lot_building
  for select to authenticated
  using (mg2030_private.is_active_user() and mg2030_private.can_see_lot(lot_id));
create policy mg2030_lot_building_write_scoped on mg2030_lot_building
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('contract.write')
              and mg2030_private.can_see_lot(lot_id))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('contract.write')
              and mg2030_private.can_see_lot(lot_id));

-- ── Planification ───────────────────────────────────────────────────────────
create policy mg2030_schedule_scenario_read_all on mg2030_schedule_scenario
  for select to authenticated using (mg2030_private.is_active_user());
create policy mg2030_schedule_scenario_write on mg2030_schedule_scenario
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('schedule.admin'))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('schedule.admin'));

create policy mg2030_plan_read_all on mg2030_plan
  for select to authenticated using (mg2030_private.is_active_user());
create policy mg2030_plan_write on mg2030_plan
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('schedule.admin'))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('schedule.admin'));

create policy mg2030_task_read_scoped on mg2030_task
  for select to authenticated
  using (mg2030_private.is_active_user()
         and mg2030_private.can_see_task(site_id, lot_id, contract_id));
create policy mg2030_task_write_scoped on mg2030_task
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('task.write')
              and mg2030_private.can_see_task(site_id, lot_id, contract_id))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('task.write')
              and mg2030_private.can_see_task(site_id, lot_id, contract_id));

-- Une dépendance n'est visible que si SES DEUX extrémités le sont : sinon on
-- laisserait fuiter l'existence d'une tâche hors périmètre.
create policy mg2030_task_dependency_read_scoped on mg2030_task_dependency
  for select to authenticated using (
    mg2030_private.is_active_user()
    and exists (select 1 from mg2030_task t where t.id = predecessor_id
                 and mg2030_private.can_see_task(t.site_id, t.lot_id, t.contract_id))
    and exists (select 1 from mg2030_task t where t.id = successor_id
                 and mg2030_private.can_see_task(t.site_id, t.lot_id, t.contract_id))
  );
create policy mg2030_task_dependency_write on mg2030_task_dependency
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('task.write'))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('task.write'));

create policy mg2030_task_constraint_read_scoped on mg2030_task_constraint
  for select to authenticated using (
    mg2030_private.is_active_user()
    and exists (select 1 from mg2030_task t where t.id = task_id
                 and mg2030_private.can_see_task(t.site_id, t.lot_id, t.contract_id))
  );
create policy mg2030_task_constraint_write on mg2030_task_constraint
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('task.write'))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('task.write'));

-- ── Gabarits de passation et NoN ────────────────────────────────────────────
create policy mg2030_procurement_template_read_all on mg2030_procurement_template
  for select to authenticated using (mg2030_private.is_active_user());
create policy mg2030_procurement_template_write on mg2030_procurement_template
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('procurement.admin'))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('procurement.admin'));
-- (idem mg2030_procurement_template_step, mg2030_contract_template_instance)

create policy mg2030_no_objection_read_scoped on mg2030_no_objection
  for select to authenticated using (
    mg2030_private.is_active_user()
    and (contract_id is null or mg2030_private.can_see_contract(contract_id))
    and (lot_id      is null or mg2030_private.can_see_lot(lot_id))
  );
create policy mg2030_no_objection_write on mg2030_no_objection
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('no_objection.write'))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('no_objection.write'));

-- ── Livrables ───────────────────────────────────────────────────────────────
create policy mg2030_deliverable_read_scoped on mg2030_deliverable
  for select to authenticated using (
    mg2030_private.is_active_user()
    and (contract_id is null or mg2030_private.can_see_contract(contract_id))
    and (lot_id      is null or mg2030_private.can_see_lot(lot_id))
  );
create policy mg2030_deliverable_write on mg2030_deliverable
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('deliverable.write'))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('deliverable.write'));

-- ── Documents ───────────────────────────────────────────────────────────────
-- L'arborescence est visible de tous les membres : ce sont les DOCUMENTS que
-- les tags protègent, pas les dossiers.
create policy mg2030_folder_read_all on mg2030_folder
  for select to authenticated using (mg2030_private.is_active_user());
create policy mg2030_folder_write_admin on mg2030_folder
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('folder.admin'))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('folder.admin'));

create policy mg2030_document_read_tagged on mg2030_document
  for select to authenticated
  using (mg2030_private.is_active_user() and mg2030_private.can_read_document(id));
create policy mg2030_document_insert on mg2030_document
  for insert to authenticated
  with check (mg2030_private.can_write() and mg2030_private.has_perm('document.upload')
              and uploaded_by = (select auth.uid()));
-- Un contributeur ne modifie/supprime que SES dépôts ; l'ADMIN, tous.
create policy mg2030_document_update_own on mg2030_document
  for update to authenticated
  using      (mg2030_private.can_write()
              and (uploaded_by = (select auth.uid()) or mg2030_private.is_platform_admin()))
  with check (mg2030_private.can_write()
              and (uploaded_by = (select auth.uid()) or mg2030_private.is_platform_admin()));
create policy mg2030_document_delete_own on mg2030_document
  for delete to authenticated
  using (mg2030_private.can_write()
         and (uploaded_by = (select auth.uid()) or mg2030_private.is_platform_admin()));

create policy mg2030_document_tag_read on mg2030_document_tag
  for select to authenticated
  using (mg2030_private.is_active_user() and mg2030_private.can_read_document(document_id));
create policy mg2030_document_tag_write on mg2030_document_tag
  for all to authenticated
  using      (mg2030_private.can_write() and mg2030_private.has_perm('document.upload')
              and mg2030_private.can_read_document(document_id))
  with check (mg2030_private.can_write() and mg2030_private.has_perm('document.upload')
              and mg2030_private.can_read_document(document_id));

-- ── Transverse ──────────────────────────────────────────────────────────────
create policy mg2030_notification_read_self on mg2030_notification
  for select to authenticated using (user_id = (select auth.uid()));
create policy mg2030_notification_update_self on mg2030_notification
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Aucune politique d'INSERT : les notifications sont écrites par des triggers
-- en security definer, jamais par le client.

create policy mg2030_change_log_read_admin on mg2030_change_log
  for select to authenticated using (mg2030_private.is_platform_admin());
-- Aucune politique d'INSERT / UPDATE / DELETE : seul le trigger écrit.
```

### 10.4 Jeu de tests SQL

Le brief §8 impose un jeu de tests couvrant chaque politique avec trois
utilisateurs fictifs. **Le projet partagé en impose un quatrième.**
Fichier `supabase/tests/rls.test.sql`, exécuté par pgTAP.

| Utilisateur fictif | Organisation | Rôle | Périmètre | Attendu |
|---|---|---|---|---|
| `afd.reader@test` | AFD (`read_only`) | AFD | `global` | Lit **tout**. Échoue sur **tout** `insert` / `update` / `delete`, même là où son rôle aurait la permission |
| `proc.specialist@test` | PIU (`contributor`) | PROC | `global` | Crée et modifie un marché, un lot, un NoN. **Ne peut pas** modifier une tâche s'il n'a pas `task.write` |
| `site.rep@test` | PIU (`contributor`) | SITEREP | `site` = `TV-FAIK` | Voit 1 site sur 14, ses bâtiments, les lots et marchés qui les touchent, plus les objets de portée projet. **Ne voit pas** le Student Center |
| **`peeb.outsider`** | **aucune — compte PEEB Santa Fe réel** | — | — | **Zéro ligne sur les 29 tables `mg2030_*`.** Aucune écriture nulle part. C'est le test du cloisonnement inter-applications |

Cas à couvrir explicitement :

1. `peeb.outsider` (un des 12 comptes existants) → **zéro ligne** sur les 29
   tables, et échec sur toute écriture. **Test le plus important du lot.**
2. Compte MG2030 `is_active = false` → **zéro ligne** sur les 29 tables.
3. Session `anon` → **zéro ligne** partout.
4. `afd.reader` tente un `update` sur `mg2030_contract` → 0 ligne affectée.
5. `site.rep` lit `mg2030_task` : ne voit que les tâches de son site + les
   tâches sans rattachement.
6. `mg2030_task_dependency` dont une seule extrémité est visible → **masquée**.
7. Document sans tag → visible des trois membres, **invisible** de `peeb.outsider`.
8. Document tagué `procurement` avec `tag_access` sur le rôle PROC → visible du
   seul `proc.specialist`.
9. `mg2030_notification` d'un autre utilisateur → invisible.
10. `mg2030_change_log` → invisible sauf ADMIN ; insertion directe refusée.
11. `mg2030_document.uploaded_by` falsifié à l'insertion → refusé par le
    `with check`.
12. Aucune politique n'existe sans appel à `is_active_user()` ou
    `is_platform_admin()` — vérifié par une requête sur `pg_policies` qui
    **échoue** si une politique `mg2030_*` ne mentionne ni l'une ni l'autre.

Le point 12 est un garde-fou structurel : il empêche qu'une politique future
soit écrite `using (true)` et ouvre MG2030 aux comptes de l'autre application.

---

## 11. Vues dérivées (jamais stockées)

```sql
-- Fenêtre effective d'une tâche : alimente le Gantt sans que le client refasse
-- le calcul.
create view mg2030_task_window_v
with (security_invoker = true) as
select t.id, t.wbs_code, t.plan_id, t.scenario_id, t.parent_id, t.task_type,
       t.activity, t.start_date, t.end_date, t.duration_days, t.duration_weeks,
       t.progress_pct, t.contract_id, t.lot_id, t.site_id,
       (t.end_date < current_date and coalesce(t.progress_pct, 0) < 100) as is_late,
       (t.start_date <= current_date and current_date < t.end_date)      as is_running
  from mg2030_task t
 where t.archived_at is null;

-- Santé d'un marché : « détection automatique des manquants et des retards ».
create view mg2030_contract_health_v
with (security_invoker = true) as
select c.id as contract_id, c.contract_code,
       count(d.*) filter (where d.status = 'expected'
                            and d.contractual_date < current_date)  as deliverables_late,
       count(n.*) filter (where n.status = 'sent')                  as no_objections_pending,
       min(d.contractual_date) filter (where d.status = 'expected') as next_deliverable_due
  from mg2030_contract    c
  left join mg2030_deliverable  d on d.contract_id = c.id and d.archived_at is null
  left join mg2030_no_objection n on n.contract_id = c.id
 group by c.id, c.contract_code;
```

`security_invoker = true` fait hériter les vues de la RLS des tables
sous-jacentes (Postgres 15+ ; le projet est en 17.6).

---

## 12. Chargement du seed

Ordre imposé par les dépendances de clés étrangères :

| # | Table | Source | Lignes | Remarque |
|---|---|---|---|---|
| 1 | `mg2030_organisation` | `piu_roles.csv` | 3 | PIU et TA = `contributor`, AFD = `read_only` |
| 2 | `mg2030_functional_role` | `piu_roles.csv` | 14 | `ADMIN.is_platform_admin = true` |
| 3 | `mg2030_org_unit` | `piu_roles.csv` (`reports_to`) | 14 | COORD → `reports_to_external` |
| 4 | `mg2030_permission` | vocabulaire technique | ~18 | créé ici, pas une donnée projet |
| 5 | `mg2030_role_permission` | **absent des sources** | 0 | GAPS 11 |
| 6 | `mg2030_schedule_scenario` | `contracts.csv` + README | 3 | `design_bid_build.is_schedulable = false` |
| 7 | `mg2030_plan` | `tasks.csv` (`plan_code`) | 2 | TV → base ; SC-DB → design_build |
| 8 | `mg2030_site` | `sites.csv` | 14 | adresses et GPS nuls |
| 9 | `mg2030_building` | `buildings.csv` | 36 | `zone` nulle sur les 13 salles TV |
| 10 | `mg2030_contract` | `contracts.csv` | 9 | `afd_review` à passer en minuscules |
| 11 | `mg2030_lot` | `lots.csv` | 15 | |
| 12 | `mg2030_lot_building` | `lot_buildings.csv` | **46** sur 59 | les 13 lignes sans `lot_code` ne sont pas chargées |
| 13 | `mg2030_task` | `tasks.csv` | 27 | **`TV.2.1` et `SC.2.2` chargées à 20 jours** (décision GAPS 12) |
| 14 | `mg2030_task_dependency` | `task_dependencies.csv` | 19 | toutes FS, lag 0 |
| 15 | `mg2030_task_constraint` | `task_constraints.csv` | 4 | toutes `start_no_earlier_than` |
| 16 | `mg2030_tag` | brief §7 | 4 | `is_system = true` |
| 17 | `mg2030_folder` | `folder_tree.csv` | 39 | **proposition**, pas une donnée projet |
| — | `mg2030_procurement_template*` | **absent des sources** | 0 | GAPS 10 |
| — | livrables, NoN, documents, utilisateurs | — | 0 | rien à charger |

`excluded_rows.csv` (49 lignes) **n'est pas chargé**. Il reste au dépôt comme
preuve que rien n'a été omis par erreur.

**Post-chargement (décision GAPS 44)** : le moteur recalcule l'intégralité des
dates. Avec la correction GAPS 12, le recalcul est l'**identité** — un contrôle
automatique vérifie que les 21 dates de fin sont inchangées, et **échoue** sinon.
C'est la preuve que la reprise de l'historique est sûre.

### Séquence de passation observée (proposition, non chargée)

Extraite des libellés de `tasks.csv`, cohérente avec les sections 4 et 5 des
Directives AFD de février 2024 (`docs/source/Directives PM - 2024.pdf`) :

| # | Étape | Durée observée | Correspondance Directives AFD |
|---|---|---|---|
| 1 | EOI / avis de publicité | 20–21 j | §5.1 Appel à Manifestations d'Intérêt |
| 2 | Validation TA + MYS | 14–15 j | §3.1.3 Évaluation des candidatures |
| 3 | Avis de non-objection AFD | 10 j | §1.6 Revue préalable |
| 4 | Préparation des offres / propositions | 42–84 j | §3.2.6 Délais de soumission |
| 5 | Évaluation TA + MYS | 14 j | §5.4 Évaluation des propositions |
| 6 | Négociation + NoN AFD | 28–30 j | §5.5 Négociations |
| 7 | Exécution | variable | — |

> Les libellés « TA + MYS validation » et « TA + MYS evaluation » désignent la
> même nature d'étape et sont employés indifféremment dans le fichier source.
> **À normaliser** avant d'en faire un gabarit (GAPS 24).

### Matrice rôle × permission — proposition à valider

Aucune source ne la fournit. **Matrice adoptée comme défaut le 19/08/2026**,
en l'absence de fonctionnement arrêté par la PIU.

> **Pourquoi on peut démarrer sans l'avoir figée.**
> `mg2030_role_permission` est une **donnée**, pas du schéma. La modifier ne
> demande aucune migration : c'est un écran d'administration (lot 13), et la
> RLS prend l'effet immédiatement. On part donc sur ce défaut, quitte à
> l'ajuster à l'usage.

Trois principes ont guidé le remplissage :
1. Une écriture exige toujours une permission — aucune n'est implicite.
2. L'AFD n'a **aucune** croix : son organisation est `read_only`, ce qui bloque
   l'écriture avant même la lecture de cette matrice.
3. En cas de doute, on **n'accorde pas**. Ajouter un droit manquant est une
   case à cocher ; retirer un droit accordé à tort suppose d'avoir constaté le
   dégât.

Trois choix restent arbitraires et méritent l'œil de la PIU : les droits larges
donnés à l'**AT** (elle écrit partout mais ne valide rien), le droit du
**Legal Specialist** sur les marchés, et celui du **représentant sur site** sur
les tâches.

| Permission | COORD | PROC | CONSTR | CONSTR-DEP | ADMFIN | MRE | ESHS | LEGAL | COMM | SITEREP | TA | AFD | ADMIN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `site.write` | X | | X | X | | | | | | | X | | X |
| `building.write` | X | | X | X | | | | | | | X | | X |
| `contract.write` | X | X | | | | | | X | | | X | | X |
| `contract.validate` | X | | | | | | | | | | | | X |
| `task.write` | X | X | X | X | | X | | | | X | X | | X |
| `task.validate` | X | | X | | | | | | | | | | X |
| `schedule.admin` | X | | | | | X | | | | | X | | X |
| `procurement.admin` | X | X | | | | | | | | | X | | X |
| `no_objection.write` | X | X | | | | | | | | | X | | X |
| `deliverable.write` | X | X | X | X | | X | X | | | X | X | | X |
| `document.upload` | X | X | X | X | X | X | X | X | X | X | X | | X |
| `folder.admin` | X | | | | | | | | | | | | X |
| `user.admin` | X | | | | | | | | | | | | X |

L'AFD n'a **aucune** croix : son organisation est `read_only`, ce qui bloque
l'écriture avant même la lecture de cette matrice.

---

## 13. Réservé — modules de phase 2

Le brief §7 demande de **prévoir** ces modules sans les développer. Ils ne font
donc **pas** partie de la migration initiale. Les points d'accroche existent
déjà (`mg2030_contract.id`, `mg2030_lot.id`, `mg2030_site.id`,
`mg2030_document.id`) ; aucune modification des tables de la version 1 ne sera
nécessaire.

| Module | Tables prévues | Point d'attention |
|---|---|---|
| Suivi financier | `mg2030_commitment`, `mg2030_amendment`, `mg2030_ipc`, `mg2030_payment` | Accrochage sur marché / lot. Montants HT, comme la v1 |
| E&S — sauvegarde | `mg2030_safeguard_instrument`, `mg2030_permit`, `mg2030_non_conformity`, `mg2030_incident` | Accrochage sur site / marché |
| Plaintes passation | `mg2030_procurement_complaint` | Régime AFD, Directives §3.2.11 |
| Plaintes E&S (MGP) | `mg2030_es_grievance`, `mg2030_es_grievance_party` | **Données personnelles à cloisonner** : schéma dédié `mg2030_es_private`, RLS propre, jamais joint aux tables publiques. Seule vraie contrainte structurante de la phase 2 |
| Suivi-évaluation | `mg2030_indicator`, `mg2030_indicator_value` | Périodicité mensuelle et trimestrielle |
| Rapports | `mg2030_report`, `mg2030_report_section` | Rapports mensuels et trimestriels |

---

## 14. Ce que ce schéma ne fait délibérément pas

- **Pas de versioning documentaire.** Un nouveau dépôt = un nouveau document
  (brief §2).
- **Pas de journal immuable.** `mg2030_change_log` est modifiable par un
  administrateur base ; il n'a aucune valeur probante et le document le dit.
- **Pas de chaîne de preuve** sur les livrables : `visa_by` / `visa_date` sont
  déclaratifs.
- **Pas de colonne TTC ni de TVA** (décision GAPS 42).
- **Pas de table de traduction** des contenus saisis (brief §6). Seul
  `mg2030_tag` porte un `label_sq`, sous réserve de validation PIU.
- **Pas de stockage des dates calculées comme source** : `start_date` et
  `end_date` sont un cache du moteur. Les seules entrées sont `duration_days`,
  `start_date_input`, les dépendances et les contraintes.
