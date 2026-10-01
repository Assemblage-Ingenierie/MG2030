-- ============================================================
-- 0039_roadmap_detail — « comments » devient « detail ».
--
-- Le champ ne porte pas des commentaires : il porte ce qu'il faut savoir pour
-- EXÉCUTER l'action — l'interlocuteur à relancer, le document attendu, la
-- condition à lever. « Comments » invitait à y déposer un fil de discussion, ce
-- qu'il n'est pas et ne sera pas : une action a un détail, les échanges vivent
-- ailleurs.
--
-- La colonne est renommée, et pas seulement son libellé : un champ dont le nom
-- en base contredit son nom à l'écran se paie à chaque lecture de requête.
--
-- Demandé le 01/10/2026, en même temps que son édition à même le tableau.
-- ============================================================

alter table public.mg2030_roadmap_action
  rename column comments to detail;

comment on column public.mg2030_roadmap_action.detail is
  'Ce qu''il faut savoir pour exécuter l''action : interlocuteur, document '
  'attendu, condition à lever. Éditable en ligne depuis le tableau.';
