-- ============================================================
-- 0008_planning — LE CŒUR DU SYSTÈME.
--
-- Convention de durée, vérifiée sur les 21 tâches datées du seed :
--   duration_weeks = round(duration_days / 7, 2)        → 21/21 exactes
--   end_date       = start_date + duration_days         → 21/21 après GAPS 12
--   start          = MAX(fin des prédécesseurs) + lag   → 17/17 exactes
--   summary        = MIN/MAX des enfants                → 3/3 exactes
--   group_header   → AUCUNE agrégation
--
-- Convention de bornes : `end_date` est la date à laquelle le SUCCESSEUR
-- démarre. Une tâche de 14 jours du 21/09 finit le 05/10 et son successeur
-- commence le 05/10. La durée est l'écart entre les deux dates, borne de fin
-- exclue. Confirmé par les 17 dépendances du seed.
-- ============================================================

create table mg2030_task (
  id          uuid primary key default gen_random_uuid(),
  wbs_code    text not null,                    -- TV.2.7, SC.2.8, MS.1…
  plan_id     uuid not null references mg2030_plan(id) on delete cascade,
  scenario_id uuid not null references mg2030_schedule_scenario(id) on delete restrict,
  parent_id   uuid references mg2030_task(id) on delete cascade,
  task_type   mg2030_task_type not null default 'task',
  group_label text,                             -- Design, Works, DESIGN & BUILD
  activity    text not null,

  -- ── Entrées du moteur ────────────────────────────────────────────────────
  -- duration_days est l'AUTORITÉ. duration_weeks est DÉRIVÉE : le fichier Excel
  -- source calcule lui-même jours / 7 (nom défini `week` = 7).
  duration_days  integer check (duration_days >= 0),
  duration_weeks numeric(6,2) generated always as (round(duration_days / 7.0, 2)) stored,

  -- Date de début SAISIE (ancre). Nulle si la tâche est pilotée par ses
  -- prédécesseurs. Les 4 tâches sans prédécesseur du seed portent plutôt une
  -- contrainte start_no_earlier_than.
  start_date_input date,

  -- Dates EFFECTIVES : résultat du recalcul en cascade, écrites par le moteur,
  -- jamais saisies directement.
  start_date date,
  end_date   date,

  -- ── Rattachements ────────────────────────────────────────────────────────
  contract_id uuid references mg2030_contract(id) on delete set null,
  lot_id      uuid references mg2030_lot(id)      on delete set null,
  site_id     uuid references mg2030_site(id)     on delete set null,

  -- ── Suivi ────────────────────────────────────────────────────────────────
  owner_id          uuid references mg2030_app_user(id),  -- VIDE au chargement
  validator_id      uuid references mg2030_app_user(id),  -- VIDE au chargement
  progress_pct      numeric(5,2) check (progress_pct between 0 and 100),
  actual_start_date date,
  actual_end_date   date,

  -- ── Origine ──────────────────────────────────────────────────────────────
  generated_from_step_id uuid references mg2030_procurement_template_step(id) on delete set null,
  source_sheet text,
  source_row   text,                            -- « 15 », « AY6 », « C5 » → text
  sort_order   integer not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (plan_id, wbs_code),
  constraint mg2030_task_no_self_parent check (parent_id is null or parent_id <> id),
  constraint mg2030_task_dates_ordered  check (start_date is null or end_date is null or start_date <= end_date),
  -- Un jalon n'a pas de durée et ne dure pas.
  constraint mg2030_task_milestone_zero check (
    task_type <> 'milestone'
    or (coalesce(duration_days, 0) = 0 and (start_date is null or start_date = end_date))
  ),
  -- Un intertitre ne porte ni durée ni date : il organise la liste, rien de plus.
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
  'TEXT et non INTEGER : les deux jalons du seed viennent de cellules nommees '
  '(AY6 pour le debut de la marge de 4 mois, C5 pour la fin des travaux).';
comment on column mg2030_task.duration_weeks is
  'Colonne GENEREE. La conversion jours = semaines x 7 du brief §7 est confirmee '
  'par le fichier source (nom defini `week` = 7). Toute autre convention '
  'casserait la reprise de l''historique.';

-- ── Précédences : 19 lignes, toutes FS lag 0 ───────────────────────────────
-- DEUX tâches ont deux prédécesseurs (TV.2.4 et SC.2.5, formules MAX) : le
-- moteur DOIT gérer les convergences, pas seulement les chaînes linéaires.
create table mg2030_task_dependency (
  predecessor_id  uuid not null references mg2030_task(id) on delete cascade,
  successor_id    uuid not null references mg2030_task(id) on delete cascade,
  dependency_type mg2030_dependency_type not null default 'FS',
  lag_days        integer not null default 0,
  source_formula  text,                         -- « TV!C27 = MAX(I15,I26) »
  created_at      timestamptz not null default now(),
  primary key (successor_id, predecessor_id),
  constraint mg2030_task_dependency_not_self check (predecessor_id <> successor_id)
);
create index mg2030_task_dependency_pred_idx on mg2030_task_dependency (predecessor_id);

comment on table mg2030_task_dependency is
  'Version 1 : seul FS est produit par le seed et gere par le moteur. '
  'SS / FF / SF sont declares dans l''enum pour eviter une migration ulterieure, '
  'mais le moteur doit lever une erreur explicite tant qu''ils ne sont pas '
  'implementes.';

-- ── Contraintes de date : 4 lignes, toutes start_no_earlier_than ───────────
create table mg2030_task_constraint (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references mg2030_task(id) on delete cascade,
  kind            mg2030_constraint_kind not null,
  constraint_date date not null,
  source          text,
  created_at      timestamptz not null default now(),
  unique (task_id, kind)
);
create index mg2030_task_constraint_task_idx on mg2030_task_constraint (task_id);
