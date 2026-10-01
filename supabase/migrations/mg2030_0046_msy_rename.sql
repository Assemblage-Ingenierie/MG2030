-- ============================================================
-- 0046_msy_rename — le ministère s'appelle désormais MSY.
--
-- Ministry of Youth and Sports est devenu Ministry of Sports and Youth : le
-- sigle passe de MYS à MSY, et il traverse toute la plateforme — nom de
-- l'organisation, intitulés de tâches, numéros de marché, glossaire.
--
-- ⚠ LES NUMÉROS DE MARCHÉ SONT RENOMMÉS, MAIS LE FORMAT ACCEPTE LES DEUX.
-- Les neuf numéros existants se terminent tous par `/XX` : le brief §7 dit que
-- ce suffixe signifie « rang réel pas encore attribué », donc aucun de ces
-- numéros n'a encore été émis ni signé. Les renommer ne réécrit rien
-- d'officiel.
--
-- En revanche la VALIDATION continue d'accepter `MYS/…` (voir
-- `app/(app)/contracts/actions.ts`) : un marché réellement notifié sous
-- l'ancien sigle garde son numéro, et un format qui le refuserait rendrait sa
-- fiche immodifiable. On n'impose le nouveau sigle qu'à ce qui n'est pas
-- encore sorti.
--
-- Rejouable : chaque `replace` ne touche que ce qui porte encore l'ancien
-- sigle.
-- ============================================================

-- ── D'abord le VERROU, sinon le renommage se heurte à lui ──────────────────
--
-- Le format est aussi gravé en contrainte de base — c'est elle qui a refusé la
-- première tentative, et c'est très bien ainsi : une règle de forme ne doit
-- pas vivre seulement dans le navigateur. On l'ÉLARGIT aux deux sigles plutôt
-- que de la basculer sur le nouveau, pour la raison dite plus haut.
alter table public.mg2030_contract
  drop constraint if exists mg2030_contract_number_format;

alter table public.mg2030_contract
  add constraint mg2030_contract_number_format
  check (contract_number ~ '^(MSY|MYS)/MG2030/(C|W|G|NC|DB)/[0-9]{4}/([0-9]{2}|XX)$');

update public.mg2030_organisation
   set name = replace(name, 'MYS', 'MSY')
 where name like '%MYS%';

update public.mg2030_task
   set activity = replace(activity, 'MYS', 'MSY')
 where activity like '%MYS%';

update public.mg2030_contract
   set contract_number = replace(contract_number, 'MYS/', 'MSY/')
 where contract_number like 'MYS/%';

update public.mg2030_roadmap_action
   set title = replace(title, 'MYS', 'MSY')
 where title like '%MYS%';

update public.mg2030_roadmap_action
   set detail = replace(detail, 'MYS', 'MSY')
 where detail like '%MYS%';

update public.mg2030_roadmap_subject
   set name = replace(name, 'MYS', 'MSY')
 where name like '%MYS%';

update public.mg2030_functional_role
   set title = replace(title, 'MYS', 'MSY')
 where title like '%MYS%';
