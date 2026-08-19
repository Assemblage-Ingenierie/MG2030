-- ============================================================
-- 0002_org_and_users — les trois dimensions de droits (brief §8), volet 1 et 2.
--   Dimension 1 : organisation → le MODE d'accès
--   Dimension 2 : rôle fonctionnel → les ACTIONS autorisées
-- La dimension 3 (périmètre) arrive en 0006, après site et lot.
-- ============================================================

-- ── Dimension 1 : le MODE d'accès ───────────────────────────────────────────
create table mg2030_organisation (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,            -- 'PIU' | 'TA' | 'AFD'
  name        text not null,
  access_mode mg2030_access_mode not null,
  created_at  timestamptz not null default now()
);
comment on column mg2030_organisation.access_mode is
  'Brief §3 : PIU et AT contribuent, AFD est en lecture seule sur tout. Prime '
  'sur toute permission de rôle : un read_only ne peut jamais écrire.';

-- ── Dimension 2 : les ACTIONS autorisées ────────────────────────────────────
create table mg2030_functional_role (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,      -- COORD, CONSTR, PROC, SITEREP, ADMIN…
  title             text not null,
  organisation_id   uuid not null references mg2030_organisation(id),
  time_type         text,
  posts             integer not null default 1,
  level_of_effort   text,
  is_platform_admin boolean not null default false,
  source            text
);

-- ── L'organigramme ──────────────────────────────────────────────────────────
-- Un nœud par ligne de piu_roles.csv, relié à son supérieur par `parent_id`.
-- Le seed ne contient aucune unité au-delà des postes : voir docs/GAPS.md 28.
create table mg2030_org_unit (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  functional_role_id  uuid not null references mg2030_functional_role(id),
  parent_id           uuid references mg2030_org_unit(id) on delete set null,
  -- COORD reports_to = « MYS hierarchical superior (to be specified) » : hors
  -- périmètre applicatif, conservé en texte plutôt qu'en FK orpheline.
  reports_to_external text,
  supervises_note     text,
  sort_order          integer not null default 0,
  constraint mg2030_org_unit_no_self_parent check (parent_id is null or parent_id <> id)
);

-- ── L'utilisateur ───────────────────────────────────────────────────────────
-- ⚠ auth.users est PARTAGÉ avec l'autre application du projet. L'existence
-- d'une ligne ici est la SEULE preuve d'appartenance à MG2030. Voir SCHEMA §1.
create table mg2030_app_user (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null unique,
  full_name          text not null,
  job_title          text,
  organisation_id    uuid not null references mg2030_organisation(id),
  functional_role_id uuid not null references mg2030_functional_role(id),
  org_unit_id        uuid references mg2030_org_unit(id),
  locale             text not null default 'en' check (locale in ('en', 'sq')),
  is_active          boolean not null default false,
  approved_at        timestamptz,
  approved_by        uuid references mg2030_app_user(id),
  last_seen_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table mg2030_app_user is
  'PROJET PARTAGÉ : auth.users est commun avec une autre application. Une ligne '
  'ici est la SEULE preuve qu''un compte authentifié appartient à MG2030.';
comment on column mg2030_app_user.is_active is
  'Faux tant qu''un administrateur n''a pas validé le compte. Un compte inactif '
  'ne franchit AUCUNE politique RLS.';

create index mg2030_app_user_role_idx on mg2030_app_user (functional_role_id);
create index mg2030_app_user_org_idx  on mg2030_app_user (organisation_id);
