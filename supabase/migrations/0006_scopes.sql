-- ============================================================
-- 0006_scopes — DIMENSION 3 des droits : le PÉRIMÈTRE (brief §8).
-- Placée ici parce qu'elle référence site et lot, créés en 0005.
-- ============================================================

create table mg2030_app_user_scope (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references mg2030_app_user(id) on delete cascade,
  kind       mg2030_scope_kind not null,
  subproject mg2030_subproject,                                  -- ssi kind = 'subproject'
  site_id    uuid references mg2030_site(id) on delete cascade,  -- ssi kind = 'site'
  lot_id     uuid references mg2030_lot(id)  on delete cascade,  -- ssi kind = 'lot'
  created_at timestamptz not null default now(),
  -- Exactement une cible, cohérente avec le type.
  constraint mg2030_app_user_scope_target check (
    (kind = 'global'     and subproject is null     and site_id is null     and lot_id is null) or
    (kind = 'subproject' and subproject is not null and site_id is null     and lot_id is null) or
    (kind = 'site'       and subproject is null     and site_id is not null and lot_id is null) or
    (kind = 'lot'        and subproject is null     and site_id is null     and lot_id is not null)
  )
);

-- Unicité par TYPE de périmètre, en index partiels.
-- Un index fonctionnel `coalesce(subproject::text, '')` serait REFUSÉ par
-- Postgres : le cast d'un enum vers text n'est pas marqué IMMUTABLE.
create unique index mg2030_app_user_scope_global_uniq
  on mg2030_app_user_scope (user_id)             where kind = 'global';
create unique index mg2030_app_user_scope_sub_uniq
  on mg2030_app_user_scope (user_id, subproject) where kind = 'subproject';
create unique index mg2030_app_user_scope_site_uniq
  on mg2030_app_user_scope (user_id, site_id)    where kind = 'site';
create unique index mg2030_app_user_scope_lot_uniq
  on mg2030_app_user_scope (user_id, lot_id)     where kind = 'lot';

-- Index lu par CHAQUE politique RLS : il doit exister avant la première requête.
create index mg2030_app_user_scope_user_idx on mg2030_app_user_scope (user_id);

comment on table mg2030_app_user_scope is
  'Une seule ligne `global` suffit pour l''AFD, la coordination et l''AT. Un '
  'representant sur site (SITEREP) recoit une ligne `site`. L''affectation '
  'nominative des 14 representants n''est dans aucune source (GAPS 29) : la '
  'table est donc VIDE au chargement.';
