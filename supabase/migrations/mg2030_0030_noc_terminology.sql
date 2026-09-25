-- ============================================================
-- mg2030_0030_noc_terminology.sql
--
-- DEUX CORRECTIONS DE DONNÉES demandées le 24-25/09/2026, à appliquer une
-- fois depuis l'éditeur SQL de Supabase. Idempotent : le relancer ne change
-- rien de plus.
--
-- 1. TERMINOLOGIE : l'avis de non-objection AFD s'abrège désormais NOC, et
--    non plus NON / NoN. Seul le MOT ISOLÉ est remplacé (\m…\M = bornes de
--    mot, sensible à la casse) : « Contracts negociation + AFD's NoN » devient
--    « … AFD's NOC », un mot qui contiendrait « non » n'est pas touché.
--    Les fichiers de seed/ ne changent PAS : ils reproduisent le tableur
--    source tel qu'il était, et les tests de fidélité le vérifient.
--
-- 2. BIBLIOTHÈQUE : le dossier « Financing_agreement » est retiré. Il ne l'est
--    QUE s'il est vide — ni document, même archivé, ni sous-dossier : les
--    clés étrangères sont en `on delete restrict`, et un document déposé
--    entre-temps ne doit pas bloquer la migration ni disparaître avec elle.
-- ============================================================

begin;

update public.mg2030_task
   set activity = regexp_replace(activity, '\m(NON|NoN)\M', 'NOC', 'g')
 where activity ~ '\m(NON|NoN)\M';

update public.mg2030_no_objection
   set subject = regexp_replace(subject, '\m(NON|NoN)\M', 'NOC', 'g')
 where subject ~ '\m(NON|NoN)\M';

update public.mg2030_procurement_template_step
   set name = regexp_replace(name, '\m(NON|NoN)\M', 'NOC', 'g')
 where name ~ '\m(NON|NoN)\M';

delete from public.mg2030_folder f
 where f.path = '01_Project_governance/Financing_agreement'
   and not exists (select 1 from public.mg2030_document d where d.folder_id = f.id)
   and not exists (select 1 from public.mg2030_folder c where c.parent_id = f.id);

commit;

-- Contrôle : les deux requêtes doivent rendre 0.
-- select count(*) from public.mg2030_task where activity ~ '\m(NON|NoN)\M';
-- select count(*) from public.mg2030_folder where path = '01_Project_governance/Financing_agreement';
