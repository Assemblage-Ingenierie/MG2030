-- ============================================================
-- mg2030_0032_roadmap_seed.sql — reprise de la roadmap du tableur.
--
-- 14 actions, 5 sujets, repris de « MG2030 - Roadmap.xlsx » (feuille Sheet1,
-- en-tête ligne 5). Ce fichier est GÉNÉRÉ depuis le tableur, pas recopié : à
-- 14 lignes et 7 colonnes, une transcription manuelle se trompe, et personne
-- ne s'en aperçoit avant que la PIU ne lise un libellé faux.
--
-- Idempotent : chaque action est insérée sous `not exists` sur (sujet, titre),
-- chaque assignataire sous `on conflict do nothing`. Rejouer ne duplique rien.
--
-- ── LES CINQ LIGNES DATÉES, ET CE QU'ON A DÉCIDÉ D'EN LIRE ──────────────────
--
-- Neuf actions sur quatorze n'ont AUCUNE date. C'est fidèle au tableur et ce
-- n'est pas un manque à combler.
--
-- Des cinq restantes, UNE SEULE était une vraie date Excel ; les autres étaient
-- du texte libre, orthographié de deux façons et SANS ANNÉE :
--
--   « Review and publish the RFI »          date Excel  → jour, 01/10/2026
--   « Review Procurement Plan + NOC »       Oct 5 - Week → semaine du 05/10/2026
--   « Review the SD »                       oct 12 week  → semaine du 12/10/2026
--   « Elearning AFD procurement »           Q1 2027      → trimestre, 01/01→31/03/2027
--
-- ⚠ L'ANNÉE N'A PAS ÉTÉ DEVINÉE, ELLE SE DÉDUIT. 2026 est la seule année où le
-- 5 ET le 12 octobre tombent un lundi (2025 : dimanche ; 2027 : mardi).
-- L'auteur écrivait donc des débuts de semaine ancrés au lundi, en 2026.
--
-- ⚠ LA CINQUIÈME A ÉTÉ ARBITRÉE, parce qu'elle se contredisait.
-- « Organize the AFD Mission the Week of the 12th » portait la timeline
-- « Oct 5 - Week », et son commentaire disait « Need to confirm ASAP ». Le
-- titre et la cellule ne désignaient pas la même semaine. Tranché le
-- 01/10/2026 : SEMAINE DU 12, celle que nomme le titre.
--
-- ── ASSIGNATAIRES ───────────────────────────────────────────────────────────
--
-- Le `label` est repris tel quel. `app_user_id` est renseigné quand le prénom
-- désigne un compte existant — « Kushtrim » et « Sami » en trouvent un, pas
-- « Alban », « TA », « AFD » ni « G8 ». C'est exactement pourquoi ce champ est
-- facultatif : une clé étrangère obligatoire aurait perdu quatre
-- assignataires sur six.
--
-- Le rapprochement se fait sur « <prénom> » suivi d'un espace, donc sur le
-- prénom seul : il est volontairement étroit, et un homonyme futur devra être
-- relié à la main plutôt que deviné.
-- ============================================================

begin;

insert into public.mg2030_roadmap_subject (code, name, sort_order) values

  ('PROJECT_STEERING', 'Project Steering', 0),
  ('STUDENT_CENTER', 'Student Center', 10),
  ('TRAINING_VENUES', 'Training venues', 20),
  ('TRAINING_AND_CAPACITY_BUILDING', 'Training and capacity building', 30),
  ('MONITORING_EVALUATION', 'Monitoring & Evaluation', 40)
on conflict (code) do nothing;


insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Request additional procurement specialists to AFD', 'pending', 'low', null, null, null, null, 0
  from public.mg2030_roadmap_subject s where s.code = 'PROJECT_STEERING'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Request additional procurement specialists to AFD');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Kushtrim', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Kushtrim %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Request additional procurement specialists to AFD'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Review the POM', 'not_started', 'low', null, null, null, 'The TA will send a first version', 10
  from public.mg2030_roadmap_subject s where s.code = 'PROJECT_STEERING'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Review the POM');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Kushtrim', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Kushtrim %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Review the POM'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Appoint a panel for the complaint mechanism and chose an email adress to receive the complaints', 'pending', 'high', null, null, null, null, 20
  from public.mg2030_roadmap_subject s where s.code = 'PROJECT_STEERING'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Appoint a panel for the complaint mechanism and chose an email adress to receive the complaints');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Kushtrim', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Kushtrim %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Appoint a panel for the complaint mechanism and chose an email adress to receive the complaints'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Organize the AFD Mission the Week of the 12th', 'pending', 'urgent', 'week', '2026-10-12', '2026-10-19', 'Need to confirm ASAP', 30
  from public.mg2030_roadmap_subject s where s.code = 'PROJECT_STEERING'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Organize the AFD Mission the Week of the 12th');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Kushtrim', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Kushtrim %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Organize the AFD Mission the Week of the 12th'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Review and publish the RFI', 'in_progress', 'urgent', 'day', '2026-10-01', '2026-10-02', null, 40
  from public.mg2030_roadmap_subject s where s.code = 'PROJECT_STEERING'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Review and publish the RFI');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Kushtrim', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Kushtrim %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Review and publish the RFI'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Alban', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Alban %' limit 1), 1
  from public.mg2030_roadmap_action a where a.title = 'Review and publish the RFI'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Create DG market', null, 'urgent', null, null, null, null, 50
  from public.mg2030_roadmap_subject s where s.code = 'PROJECT_STEERING'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Create DG market');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Alban', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Alban %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Create DG market'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Review Procurement Plan and send NOC to AFD', 'pending', 'urgent', 'week', '2026-10-05', '2026-10-12', null, 60
  from public.mg2030_roadmap_subject s where s.code = 'PROJECT_STEERING'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Review Procurement Plan and send NOC to AFD');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Kushtrim', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Kushtrim %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Review Procurement Plan and send NOC to AFD'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Alban', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Alban %' limit 1), 1
  from public.mg2030_roadmap_action a where a.title = 'Review Procurement Plan and send NOC to AFD'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Review of the GEP', 'not_started', 'medium', null, null, null, 'AFD to send GEP', 70
  from public.mg2030_roadmap_subject s where s.code = 'STUDENT_CENTER'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Review of the GEP');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Sami', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Sami %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Review of the GEP'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Kushtrim', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Kushtrim %' limit 1), 1
  from public.mg2030_roadmap_action a where a.title = 'Review of the GEP'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Review of the value engineering', 'not_started', 'medium', null, null, null, 'AFD to send value engineering', 80
  from public.mg2030_roadmap_subject s where s.code = 'STUDENT_CENTER'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Review of the value engineering');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Sami', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Sami %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Review of the value engineering'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Kushtrim', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Kushtrim %' limit 1), 1
  from public.mg2030_roadmap_action a where a.title = 'Review of the value engineering'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Review the SD', 'not_started', 'high', 'week', '2026-10-12', '2026-10-19', null, 90
  from public.mg2030_roadmap_subject s where s.code = 'STUDENT_CENTER'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Review the SD');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Kushtrim', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Kushtrim %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Review the SD'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Sami', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Sami %' limit 1), 1
  from public.mg2030_roadmap_action a where a.title = 'Review the SD'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'TA', (select u.id from public.mg2030_app_user u where u.full_name ilike 'TA %' limit 1), 2
  from public.mg2030_roadmap_action a where a.title = 'Review the SD'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'AFD', (select u.id from public.mg2030_app_user u where u.full_name ilike 'AFD %' limit 1), 3
  from public.mg2030_roadmap_action a where a.title = 'Review the SD'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Obtain the urban consent for the new building in SC', 'pending', 'high', null, null, null, null, 100
  from public.mg2030_roadmap_subject s where s.code = 'STUDENT_CENTER'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Obtain the urban consent for the new building in SC');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Sami', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Sami %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Obtain the urban consent for the new building in SC'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'G8', (select u.id from public.mg2030_app_user u where u.full_name ilike 'G8 %' limit 1), 1
  from public.mg2030_roadmap_action a where a.title = 'Obtain the urban consent for the new building in SC'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Review the EOI for the TV and send NOC', 'pending', 'high', null, null, null, null, 110
  from public.mg2030_roadmap_subject s where s.code = 'TRAINING_VENUES'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Review the EOI for the TV and send NOC');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Kushtrim', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Kushtrim %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Review the EOI for the TV and send NOC'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Elearning of AFD procurement guidelines', 'not_started', 'low', 'quarter', '2027-01-01', '2027-04-01', null, 120
  from public.mg2030_roadmap_subject s where s.code = 'TRAINING_AND_CAPACITY_BUILDING'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Elearning of AFD procurement guidelines');

insert into public.mg2030_roadmap_action
  (subject_id, title, status, priority, timeline_kind, timeline_start, timeline_end, comments, sort_order)
select s.id, 'Sign up for Alban and Sami', 'pending', 'medium', null, null, null, null, 130
  from public.mg2030_roadmap_subject s where s.code = 'MONITORING_EVALUATION'
 and not exists (select 1 from public.mg2030_roadmap_action a
                  where a.subject_id = s.id and a.title = 'Sign up for Alban and Sami');

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Alban', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Alban %' limit 1), 0
  from public.mg2030_roadmap_action a where a.title = 'Sign up for Alban and Sami'
 on conflict (action_id, label) do nothing;

insert into public.mg2030_roadmap_assignee (action_id, label, app_user_id, sort_order)
select a.id, 'Sami', (select u.id from public.mg2030_app_user u where u.full_name ilike 'Sami %' limit 1), 1
  from public.mg2030_roadmap_action a where a.title = 'Sign up for Alban and Sami'
 on conflict (action_id, label) do nothing;

commit;
