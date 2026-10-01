-- ============================================================
-- mg2030_0035_roadmap_assignee_relink.sql
--
-- LA MÊME PERSONNE SOUS TROIS LIBELLÉS.
--
-- Constaté à l'écran le 01/10/2026 : « kushtrim », « Kushtrim » et
-- « kushtrim krasniqi » coexistaient, et 5 des 8 lignes avaient perdu leur
-- rattachement au compte. Le filtre par assignataire proposait donc trois
-- entrées pour une seule personne, dont aucune ne retrouvait toutes ses
-- actions.
--
-- CAUSE, dans le code et non dans les données : `replaceAssignees` écrivait
-- `app_user_id: null` à chaque enregistrement, par excès de prudence — il ne
-- fallait pas « deviner » un compte. Mais le sélecteur insère le nom complet
-- TEL QUE LE PORTE LE COMPTE : une égalité stricte n'est pas une devinette.
-- Chaque édition défaisait donc le travail de la reprise `0034`.
--
-- Le code est corrigé (rattachement par égalité exacte, et seulement si UN
-- SEUL compte actif porte ce nom). Cette migration répare l'existant.
--
-- Trois temps, et l'ordre compte :
--   1. rattacher par nom complet exact ;
--   2. rattacher les PRÉNOMS SEULS hérités du tableur, quand le prénom ne
--      désigne qu'un compte ;
--   3. ramener tout libellé rattaché au nom canonique — en supprimant d'abord
--      les doublons que la fusion créerait sur une même action, sans quoi la
--      contrainte d'unicité (action, label) ferait échouer la mise à jour.
-- ============================================================

update public.mg2030_roadmap_assignee a
   set app_user_id = u.id
  from public.mg2030_app_user u
 where a.app_user_id is null
   and u.is_active
   and lower(u.full_name) = lower(a.label)
   and (select count(*) from public.mg2030_app_user x
         where x.is_active and lower(x.full_name) = lower(a.label)) = 1;

update public.mg2030_roadmap_assignee a
   set app_user_id = u.id
  from public.mg2030_app_user u
 where a.app_user_id is null
   and u.is_active
   and lower(u.full_name) like lower(a.label) || ' %'
   and (select count(*) from public.mg2030_app_user x
         where x.is_active and lower(x.full_name) like lower(a.label) || ' %') = 1;

delete from public.mg2030_roadmap_assignee a
 using public.mg2030_app_user u, public.mg2030_roadmap_assignee b
 where a.app_user_id = u.id
   and a.label <> u.full_name
   and b.action_id = a.action_id
   and b.label = u.full_name;

update public.mg2030_roadmap_assignee a
   set label = u.full_name
  from public.mg2030_app_user u
 where a.app_user_id = u.id
   and a.label <> u.full_name;
