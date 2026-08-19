-- ============================================================
-- 0010_deliverables_non — livrables et avis de non-objection AFD.
-- Placée après 0009 : les deux référencent mg2030_document.
-- ============================================================

-- ── Livrables ───────────────────────────────────────────────────────────────
-- Rapports des consultants ET livrables des entreprises. L'émetteur est un
-- TEXTE : ni les consultants ni les entreprises ne sont utilisateurs (brief §3).
create table mg2030_deliverable (
  id                     uuid primary key default gen_random_uuid(),
  contract_id            uuid references mg2030_contract(id) on delete cascade,
  lot_id                 uuid references mg2030_lot(id)      on delete cascade,
  title                  text not null,
  issuer                 text,
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
  constraint mg2030_deliverable_has_origin    check (contract_id is not null or lot_id is not null),
  constraint mg2030_deliverable_visa_coherent check ((visa_by is null) = (visa_date is null))
);
create index mg2030_deliverable_contract_idx on mg2030_deliverable (contract_id);
create index mg2030_deliverable_due_idx on mg2030_deliverable (contractual_date)
  where status in ('expected', 'submitted', 'under_review');

-- ── Avis de non-objection AFD ──────────────────────────────────────────────
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
  document_id   uuid references mg2030_document(id) on delete set null,
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
  -- Une réponse implique une date de réponse, et réciproquement.
  constraint mg2030_no_objection_answer_coherent check (
    (status in ('no_objection','no_objection_with_comments','rejected'))
      = (response_date is not null)
  )
);
create index mg2030_no_objection_contract_idx on mg2030_no_objection (contract_id);
create index mg2030_no_objection_open_idx     on mg2030_no_objection (status) where status = 'sent';
