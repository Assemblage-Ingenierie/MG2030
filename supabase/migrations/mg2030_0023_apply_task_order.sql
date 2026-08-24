-- ============================================================
-- mg2030_0023 — ordre d'affichage appliqué en une seule requête.
--
-- Même parti pris que `mg2030_apply_task_dates` (mg2030_0021) : la version
-- précédente bouclait un UPDATE par ligne en aller-retour séparé, si bien que
-- déplacer une tâche dans une fratrie de huit coûtait huit allers-retours vers
-- Paris.
--
-- `security invoker` : la RLS de `mg2030_task` s'applique normalement, la
-- fonction n'accorde aucun droit supplémentaire.
-- ============================================================

create or replace function public.mg2030_apply_task_order(p_order jsonb)
returns integer language sql security invoker set search_path = '' as $fn$
  with input as (
    select (x->>'id')::uuid as id, (x->>'sortOrder')::integer as sort_order
      from jsonb_array_elements(p_order) as x
  ), updated as (
    update public.mg2030_task t
       set sort_order = i.sort_order
      from input i
     where t.id = i.id and t.sort_order is distinct from i.sort_order
    returning 1
  ) select coalesce(count(*),0)::integer from updated;
$fn$;

comment on function public.mg2030_apply_task_order(jsonb) is
  'Applique un lot de rangs d''affichage en une requete. Voir mg2030_0023.';

grant execute on function public.mg2030_apply_task_order(jsonb) to authenticated;
