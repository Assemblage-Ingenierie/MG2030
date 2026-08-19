-- ============================================================
-- 0001_types — types énumérés MG2030.
--
-- PROJET PARTAGÉ (EXTERNAL) : tout objet est préfixé `mg2030_`.
-- Voir docs/SCHEMA.md §0 et §1.
-- ============================================================

create extension if not exists btree_gist;

-- ── Référentiel ─────────────────────────────────────────────────────────────
create type mg2030_subproject as enum ('athletes_village', 'training_venues');

-- Zone du Student Center (BPR 7.4.7). NULLABLE : les 13 salles des training
-- venues n'ont pas de zone dans buildings.csv.
create type mg2030_building_zone as enum ('residential', 'services_and_sports');

create type mg2030_intervention_type as enum (
  'renovation', 'demolition', 'extension', 'new_construction'
);

-- ── Passation ───────────────────────────────────────────────────────────────
-- C = consulting, W = works, G = goods, NC = non-consulting, DB = design & build.
create type mg2030_contract_type as enum ('C', 'W', 'G', 'NC', 'DB');

-- NPC = national, IPC = international. NULLABLE : C-SC-DD est en gré à gré.
create type mg2030_competition_type as enum ('NPC', 'IPC');

create type mg2030_procedure as enum ('REOI', 'IB', 'PQL+IB', 'RQ', 'DC');

create type mg2030_selection_method as enum (
  'QCBS', 'QBS', 'FBS', 'LCS', 'lowest_evaluated_compliant_bid'
);

-- Le seed écrit « PRIOR » : normalisé en minuscules au chargement.
create type mg2030_afd_review as enum ('prior', 'post');

create type mg2030_no_objection_status as enum (
  'draft', 'sent', 'no_objection', 'no_objection_with_comments', 'rejected', 'cancelled'
);

-- ── Planification ───────────────────────────────────────────────────────────
create type mg2030_task_type as enum (
  'task',          -- feuille : porte durée et dates
  'summary',       -- récapitulatif : dates AGRÉGÉES depuis les enfants
  'milestone',     -- jalon : durée 0, start = end
  'group_header'   -- intertitre : AUCUNE date, aucune agrégation
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
