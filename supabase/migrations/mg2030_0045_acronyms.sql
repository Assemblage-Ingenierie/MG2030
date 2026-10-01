-- ============================================================
-- 0045_acronyms — le glossaire du projet.
--
-- Le POM en porte une trentaine, et toute la documentation les emploie sans
-- les développer : « le NOC de l'AFD sur le REoI », « ESMP du contractant ».
-- Quiconque arrive sur le projet — et la PIU en recrute encore — doit ouvrir
-- le POM pour les déchiffrer. Demandé le 01/10/2026.
--
-- ⚠ LE SIGLE N'EST PAS UNE CLÉ PRIMAIRE. Il est unique, mais la ligne porte un
-- identifiant propre : renommer un sigle — c'est précisément ce qui arrive à
-- MYS, devenu MSY — ne doit pas casser les liens qu'on pourrait y faire un
-- jour, ni obliger à effacer puis recréer.
--
-- Tenu par les ÉDITEURS et pas seulement par l'administration : un glossaire
-- que seul l'administrateur peut compléter ne se complète pas. Le risque est
-- nul — une ligne de glossaire n'ouvre aucun accès.
-- ============================================================

create table if not exists public.mg2030_acronym (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  meaning    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.mg2030_acronym is
  'Glossaire du projet. Repris du POM, tenu dans l''application plutôt que '
  'dans un document que personne ne rouvre.';

drop trigger if exists mg2030_acronym_touch on public.mg2030_acronym;
create trigger mg2030_acronym_touch
  before update on public.mg2030_acronym
  for each row execute function mg2030_private.touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Quatre politiques explicites, jamais `FOR ALL` (garde-fou de 0017/0019).
alter table public.mg2030_acronym enable row level security;

drop policy if exists mg2030_acronym_read   on public.mg2030_acronym;
drop policy if exists mg2030_acronym_insert on public.mg2030_acronym;
drop policy if exists mg2030_acronym_update on public.mg2030_acronym;
drop policy if exists mg2030_acronym_delete on public.mg2030_acronym;

create policy mg2030_acronym_read on public.mg2030_acronym
  for select to authenticated
  using (mg2030_private.is_active_user());

create policy mg2030_acronym_insert on public.mg2030_acronym
  for insert to authenticated
  with check (mg2030_private.can_write());

create policy mg2030_acronym_update on public.mg2030_acronym
  for update to authenticated
  using      (mg2030_private.can_write())
  with check (mg2030_private.can_write());

create policy mg2030_acronym_delete on public.mg2030_acronym
  for delete to authenticated
  using (mg2030_private.can_write());

grant select, insert, update, delete on public.mg2030_acronym to authenticated;

-- ── Le glossaire du POM ─────────────────────────────────────────────────────
--
-- ⚠ MSY ET NON MYS. Le ministère a changé de nom : la liste fournie portait
-- encore l'ancien sigle, le projet emploie désormais MSY. On sème la valeur
-- juste plutôt que de semer l'ancienne pour la corriger ensuite.
insert into public.mg2030_acronym (code, meaning) values
  ('AFD',    'Agence Francaise de Developpement'),
  ('AWPB',   'Annual work plan and budget'),
  ('CFA',    'Credit Facility Agreement No. CXK 1005 03 B'),
  ('C-ESMP', 'Contractor Environmental and Social Management Plan'),
  ('EPC',    'Energy Performance Certificate'),
  ('ESIA',   'Environmental and Social Impact Assessment'),
  ('ESMP',   'Environmental and Social Management Plan'),
  ('ESS',    'Environmental and Social Standard'),
  ('E&S',    'Environmental and social'),
  ('ESHS',   'Environmental, social, health and safety'),
  ('FEFS',   'Faculty of Physical Education and Sports, University of Pristina'),
  ('IPC',    'International Procurement Competition'),
  ('KEEF',   'Kosovo Energy Efficiency Fund'),
  ('MESTI',  'Ministry of Education, Science, Technology and Innovation'),
  ('MFLT',   'Ministry of Finance, Labour and Transfers'),
  ('MG2030', 'Mediterranean Games 2030'),
  ('MoU',    'Memorandum of understanding'),
  ('MSY',    'Ministry of Sports and Youth, project owner and Contracting Authority'),
  ('NOC',    'No Objection Certificate issued by AFD'),
  ('NPC',    'National Procurement Competition'),
  ('OCMG',   'Organising Committee of the Mediterranean Games'),
  ('OHS',    'Occupational health and safety'),
  ('PESIA',  'Preliminary Environmental and Social Impact Assessment'),
  ('PIU',    'Project Implementation Unit'),
  ('POM',    'Project Operational Manual'),
  ('PPL',    'Kosovo Law on Public Procurement'),
  ('PPRC',   'Public Procurement Regulatory Commission'),
  ('PRB',    'Procurement Review Body'),
  ('QCBS',   'Quality and cost-based selection'),
  ('REoI',   'Request for Expressions of Interest'),
  ('RFP',    'Request for Proposals'),
  ('SEP',    'Stakeholder Engagement Plan'),
  ('TA',     'Technical Assistance to the MSY')
on conflict (code) do nothing;
