-- ============================================================
-- mg2030_0022 — sous-projet porté par la tâche.
--
-- POURQUOI. Le brief §9.4 exige des vues filtrées « projet entier, un
-- contrat, un site ». Or le planning source est au niveau SOUS-PROJET :
-- « Training venues works » couvre les 13 halls à la fois. Renseigner
-- site_id sur cette tâche serait un mensonge — elle n'appartient à aucun
-- hall en particulier.
--
-- La dimension que le plan porte réellement est donc le sous-projet. Le
-- filtre par site s'y ramène : sélectionner un hall montre les tâches
-- explicitement rattachées à ce hall UNION celles de son sous-projet qui
-- n'en désignent aucun. La PIU pourra affiner hall par hall plus tard, en
-- renseignant site_id — la colonne existe déjà et devient éditable.
--
-- Le remplissage vient du préfixe WBS, seule source disponible : TV. et SC.
-- Les jalons transverses (MS.1 début de marge, MS.2 fin de travaux) restent
-- nuls : ils appartiennent au projet entier, pas à un sous-projet.
-- ============================================================

alter table public.mg2030_task
  add column if not exists subproject public.mg2030_subproject;

comment on column public.mg2030_task.subproject is
  'Sous-projet porte par la tache. Le planning source est a ce niveau : '
  '« Training venues works » couvre les 13 halls a la fois, donc site_id ne '
  'peut pas etre renseigne sans mentir. Rempli depuis le prefixe WBS '
  '(TV. / SC.) ; nul pour les jalons transverses (MS.).';

update public.mg2030_task
   set subproject = case
         when wbs_code like 'TV.%' then 'training_venues'::public.mg2030_subproject
         when wbs_code like 'SC.%' then 'athletes_village'::public.mg2030_subproject
         else null
       end
 where subproject is null;

create index if not exists mg2030_task_subproject_idx
  on public.mg2030_task (subproject) where archived_at is null;
