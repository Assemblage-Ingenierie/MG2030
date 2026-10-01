-- ============================================================
-- mg2030_0034_roadmap_assignee_full_names.sql
--
-- UN SEUL LIBELLÉ PAR PERSONNE.
--
-- Le tableur écrivait les prénoms seuls — « Kushtrim », « Sami ». Le sélecteur
-- d'assignataires, lui, propose les comptes sous leur nom complet, puisque
-- c'est ainsi qu'on les désigne partout ailleurs dans la plateforme. Sans cette
-- reprise, cocher Kushtrim dans le formulaire aurait AJOUTÉ « Kushtrim
-- Krasniqi » à côté de « Kushtrim » : deux libellés, deux entrées de filtre,
-- une même personne.
--
-- Seules les lignes DÉJÀ rattachées à un compte sont touchées — le
-- rapprochement avait été vérifié à la reprise initiale. « Alban », « G8 »,
-- « TA » et « AFD » ne bougent pas : ils ne désignent aucun compte, et c'est
-- précisément pourquoi le champ reste du texte libre.
--
-- Le `not exists` évite de violer l'unicité (action, label) si les deux formes
-- coexistaient déjà sur une même action.
-- ============================================================

update public.mg2030_roadmap_assignee a
   set label = u.full_name
  from public.mg2030_app_user u
 where a.app_user_id = u.id
   and a.label <> u.full_name
   and not exists (
     select 1 from public.mg2030_roadmap_assignee b
      where b.action_id = a.action_id and b.label = u.full_name
   );
