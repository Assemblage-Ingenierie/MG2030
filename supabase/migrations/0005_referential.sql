-- ============================================================
-- 0005_referential — sites, bâtiments, marchés, lots.
-- ============================================================

-- ── Sites : 14 lignes ───────────────────────────────────────────────────────
create table mg2030_site (
  id                      uuid primary key default gen_random_uuid(),
  site_code               text not null unique,
  subproject              mg2030_subproject not null,
  name                    text not null,
  beneficiary_institution text,
  -- Valeurs observées : student_campus | university_sports_hall | school_sports_hall
  site_type               text,
  address                 text,                  -- VIDE sur les 14 lignes
  latitude                numeric(9,6),          -- VIDE sur les 14 lignes
  longitude               numeric(9,6),          -- VIDE sur les 14 lignes
  gross_area_sqm          numeric(10,2),
  year_of_construction    integer,
  occupancy_status        text,
  site_representative_id  uuid references mg2030_app_user(id),
  source                  text,
  archived_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint mg2030_site_lat_lon_together check ((latitude is null) = (longitude is null))
);
comment on table mg2030_site is
  'address / latitude / longitude sont VIDES sur les 14 lignes de seed : donnee '
  'reellement absente des documents sources (GAPS 1 et 2). Bloquant pour le '
  'module carte (phase 2), pas pour la version 1.';

create index mg2030_site_subproject_idx on mg2030_site (subproject);

-- ── Bâtiments : 36 lignes (23 Student Center + 13 salles) ──────────────────
-- ⚠ Une table `buildings` non prefixee (133 lignes) existe deja sur ce projet
--   partage : elle appartient a une autre application, sans aucun lien.
create table mg2030_building (
  id                   uuid primary key default gen_random_uuid(),
  building_code        text not null unique,
  site_id              uuid not null references mg2030_site(id) on delete restrict,
  name                 text not null,
  zone                 mg2030_building_zone,     -- NULL sur les 13 salles TV
  typology             text,
  intervention_type    mg2030_intervention_type not null,
  net_area_sqm         numeric(10,2),
  gross_area_sqm       numeric(10,2),
  unit_cost_eur_sqm    numeric(10,2),
  works_estimate_eur   numeric(14,2),
  year_of_construction integer,
  construction_type    text,
  source               text,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index mg2030_building_site_idx on mg2030_building (site_id);

comment on column mg2030_building.zone is
  'Contrainte volontairement ABSENTE : exiger zone NOT NULL pour un site '
  'athletes_village ferait echouer le chargement si la PIU ajoute un batiment '
  'sans zone. Regle laissee a l''applicatif.';
comment on column mg2030_building.net_area_sqm is
  'Salle Tetori : 1 987 m2 net (budget) contre 3 934 m2 brut (programme). Les '
  'deux valeurs sont conservees — ecart source non arbitre (GAPS 17).';
comment on column mg2030_building.year_of_construction is
  'VIDE sur 5 dortoirs (Konvikti 3, 4, 6, 7, 8) : les tableaux BPR 5.2.2 et 5.4 '
  'divergent, les valeurs discordantes ont ete ecartees (GAPS 16).';

-- ── Marchés : 9 lignes. Montants en EUROS HT ───────────────────────────────
create table mg2030_contract (
  id                    uuid primary key default gen_random_uuid(),
  contract_code         text not null unique,
  -- ⚠ PAS unique : le suffixe XX n'est pas attribue, 3 marches partagent
  --   « MYS/MG2030/C/2026/XX », 3 autres « .../C/2027/XX », 2 autres
  --   « .../W/2027/XX » (GAPS 19).
  contract_number       text not null,
  name                  text not null,
  contract_type         mg2030_contract_type not null,
  competition_type      mg2030_competition_type,   -- NULL pour C-SC-DD (gre a gre)
  procedure             mg2030_procedure not null,
  selection_method      mg2030_selection_method,   -- NULL pour C-SC-DD
  afd_review            mg2030_afd_review not null default 'prior',
  scenario_id           uuid not null references mg2030_schedule_scenario(id),
  estimated_amount_eur  numeric(14,2),             -- HT
  contracted_amount_eur numeric(14,2),             -- HT
  contractor            text,
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
  'Format impose au brief §7. Le suffixe litteral XX est accepte : c''est la '
  'valeur reelle du plan de passation, non encore attribuee.';
comment on column mg2030_contract.contract_type is
  'Les 3 marches de fournitures sont numerotes .../C/... alors que leur type est '
  'G (GAPS 18). La contrainte de format ne croise donc PAS contract_type et le '
  'segment du numero — volontairement.';
comment on column mg2030_contract.estimated_amount_eur is
  'EUROS HORS TAXES (GAPS 42). Aucune colonne TTC n''est prevue.';

-- ── Lots : 15 lignes ────────────────────────────────────────────────────────
-- Le brief dit « montant » au singulier ; le seed porte une FOURCHETTE. Les
-- deux bornes sont conservees (GAPS 34).
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

-- ── Affectation lot ↔ bâtiment : 46 lignes sur les 59 du CSV ───────────────
create table mg2030_lot_building (
  lot_id      uuid not null references mg2030_lot(id)      on delete cascade,
  building_id uuid not null references mg2030_building(id) on delete cascade,
  source      text,
  primary key (lot_id, building_id)
);
create index mg2030_lot_building_building_idx on mg2030_lot_building (building_id);

comment on table mg2030_lot_building is
  'Les 23 batiments du Student Center apparaissent DEUX fois : sur les lots '
  'W-SC-* (voie classique) et sur les lots DB-SC-* (Design & Build). Les deux '
  'scenarios sont mutuellement exclusifs, l''interface bascule de l''un a '
  'l''autre. 23 x 2 = 46 lignes. Les 13 salles de training venues n''ont AUCUNE '
  'ligne : leur affectation n''est pas arretee (GAPS 3), et une affectation '
  'inconnue est une ABSENCE de relation, pas une relation a lot nul.';
