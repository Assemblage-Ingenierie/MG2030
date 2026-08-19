-- ============================================================
-- 0004_scenarios — variantes de planning et regroupements de tâches.
-- Le calendrier global et le calendrier de passation sont LE MÊME OBJET
-- (brief §7) : un seul jeu de scénarios gouverne les deux.
-- ============================================================

create table mg2030_schedule_scenario (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,   -- 'base' | 'design_bid_build' | 'design_build'
  name              text not null,
  description       text,
  -- Deux scénarios partageant le même groupe sont MUTUELLEMENT EXCLUSIFS.
  -- 'sc_route' pour design_bid_build et design_build ; NULL pour base, commun
  -- aux deux voies (seed/README_SEED.md, conventions).
  exclusive_group   text,
  is_active         boolean not null default false,
  -- Marge terminale (brief §7). Portée ici ET matérialisée en jalons dans
  -- mg2030_task (MS.1 / MS.2). Voir docs/GAPS.md point 39.
  buffer_start_date date,
  buffer_months     integer,
  deadline_date     date,                   -- échéance des Jeux, non négociable
  is_schedulable    boolean not null default false,
  created_at        timestamptz not null default now()
);

-- Un seul scénario actif par groupe d'exclusion.
create unique index mg2030_schedule_scenario_one_active_per_group
  on mg2030_schedule_scenario (exclusive_group)
  where is_active and exclusive_group is not null;

comment on column mg2030_schedule_scenario.is_schedulable is
  'FAUX pour design_bid_build : le fichier Excel source calcule ce scenario A '
  'REBOURS depuis la fin du Design & Build, aboutissant a une fin de travaux au '
  '13/10/2031, soit 21 mois APRES les Jeux (README_PLANNING, anomalie 1). Aucune '
  'date n''est inventee : le scenario est charge SANS taches et l''interface doit '
  'refuser de l''afficher tant que is_schedulable est faux. C''est pourtant la '
  'voie de droit commun, le Design & Build reposant sur une derogation.';

create table mg2030_plan (
  id           uuid primary key default gen_random_uuid(),
  plan_code    text not null unique,        -- 'TV' | 'SC-DB'
  name         text not null,
  scenario_id  uuid not null references mg2030_schedule_scenario(id) on delete restrict,
  source_sheet text,
  created_at   timestamptz not null default now()
);
