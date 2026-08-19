-- ============================================================
-- 0007_procurement — gabarits de passation (brief §7).
--
-- Ces tables sont créées VIDES : aucune donnée de gabarit dans seed/
-- (docs/GAPS.md point 10). Une séquence candidate, observée dans tasks.csv et
-- recoupée avec les Directives AFD de février 2024, est proposée en
-- docs/SCHEMA.md §12 — mais non chargée.
-- ============================================================

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
  -- Recale le gabarit sur un jalon contractuel connu.
  contract_date_anchor  text check (contract_date_anchor in
                          ('spn_publication_date','bid_opening_date','signature_date','completion_date')),
  unique (template_id, step_no)
);
create index mg2030_procurement_step_template_idx on mg2030_procurement_template_step (template_id);

-- Créer un contrat applique le gabarit et génère les tâches. Le lien remonte
-- par mg2030_task.generated_from_step_id.
create table mg2030_contract_template_instance (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references mg2030_contract(id) on delete cascade,
  template_id uuid not null references mg2030_procurement_template(id) on delete restrict,
  applied_at  timestamptz not null default now(),
  applied_by  uuid references mg2030_app_user(id),
  unique (contract_id)
);
