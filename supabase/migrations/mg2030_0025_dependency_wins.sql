-- ============================================================
-- mg2030_0025 — la dépendance l'emporte sur la date épinglée.
--
-- LE DÉFAUT. L'ancre saisie (`start_date_input`) primait sur tout dans le
-- moteur, y compris sur les précédences. Trois tâches liées portaient donc une
-- ancre qui contredisait leur prédécesseur :
--
--   TV.2.3  « AFD's NoN »            épinglée au 07/10, prédécesseur finissant
--                                    le 30/10 → 23 jours d'avance impossible
--   TV.2.7  « Detail Design studies » épinglée au 08/01, prédécesseur finissant
--                                    le 23/01 → 15 jours d'avance
--   TV.3.1.1 « Call for bids »        épinglée au 06/08, coïncidant par hasard
--
-- La flèche était dessinée, la dépendance existait, et le calcul l'ignorait
-- sans le dire. Pire : LA CASCADE MOURAIT LÀ. Modifier une date en amont
-- déplaçait une ou deux lignes, puis plus rien — tout l'aval repartait de la
-- date figée. C'est ce qui a été signalé.
--
-- LA RÈGLE. Une dépendance fin-début est une affirmation sur le déroulement du
-- projet ; une date saisie ne peut pas la contredire en silence. Le moteur
-- n'applique donc plus l'ancre qu'aux tâches SANS prédécesseur
-- (lib/schedule/engine.ts). Pour figer une date malgré un lien, on pose une
-- contrainte « pas avant » : elle repousse sans jamais avancer, donc elle se
-- combine avec la précédence au lieu de l'effacer.
--
-- CE QUE CETTE MIGRATION FAIT. Elle redresse l'existant : elle retire l'ancre
-- des tâches qui ont un prédécesseur, puis recalcule et persiste les dates.
-- Le recalcul est reproduit ici en SQL parce qu'il devait s'appliquer une fois
-- aux données déjà en place ; l'autorité reste le moteur TypeScript, et les
-- deux ont été recoupés après coup (zéro violation, chaîne continue).
--
-- EFFET MESURÉ sur le scénario « base » : la fin des travaux passe du
-- 02/02/2029 au 12/03/2029, soit 38 jours. La marge terminale ne commence
-- qu'au 01/09/2029 : elle absorbe le décalage sans être entamée.
--
-- Les 9 tests de fidélité au chargement passent inchangés : le fichier source
-- était cohérent, les trois contradictions sont nées de l'édition.
-- ============================================================

-- 1. Une tâche qui a un prédécesseur ne porte plus d'ancre : son début est un
--    résultat.
update public.mg2030_task t
   set start_date_input = null
 where t.archived_at is null
   and t.start_date_input is not null
   and exists (
     select 1 from public.mg2030_task_dependency d where d.successor_id = t.id
   );

-- 2. Recalcul et persistance, jusqu'au point fixe.
do $$
declare
  v_scenario record;
  v_start date;
  i integer;
begin
  for v_scenario in select id from public.mg2030_schedule_scenario loop
    -- Début de projet : la plus ancienne contrainte, à défaut la plus ancienne
    -- date stockée. Même règle que lib/queries/schedule.ts.
    select least(
      (select min(c.constraint_date) from public.mg2030_task_constraint c
         join public.mg2030_task t on t.id = c.task_id
        where t.scenario_id = v_scenario.id and t.archived_at is null),
      (select min(t.start_date) from public.mg2030_task t
        where t.scenario_id = v_scenario.id and t.archived_at is null)
    ) into v_start;
    if v_start is null then continue; end if;

    -- Le graphe est un DAG peu profond ; 12 passes couvrent très largement la
    -- plus longue chaîne du plan.
    for i in 1..12 loop
      update public.mg2030_task t
         set start_date = calc.s,
             end_date   = calc.s + (case when t.task_type = 'milestone'
                                         then 0 else coalesce(t.duration_days, 0) end)
        from (
          select t2.id,
                 coalesce(
                   -- L'ancre, mais SEULEMENT sans prédécesseur.
                   case when p.max_end is null then t2.start_date_input end,
                   -- Sinon : le plus tardif entre prédécesseurs et contrainte.
                   greatest(p.max_end, c.floor),
                   p.max_end,
                   c.floor,
                   t2.start_date_input,
                   v_start
                 ) as s
            from public.mg2030_task t2
            left join lateral (
              select max(pt.end_date) as max_end
                from public.mg2030_task_dependency d
                join public.mg2030_task pt on pt.id = d.predecessor_id
               where d.successor_id = t2.id and pt.archived_at is null
            ) p on true
            left join lateral (
              select max(cc.constraint_date) as floor
                from public.mg2030_task_constraint cc
               where cc.task_id = t2.id and cc.kind = 'start_no_earlier_than'
            ) c on true
           where t2.scenario_id = v_scenario.id
             and t2.archived_at is null
             and t2.task_type in ('task','milestone')
        ) calc
       where calc.id = t.id;

      -- Un récapitulatif encadre ses enfants.
      update public.mg2030_task t
         set start_date = agg.s, end_date = agg.e
        from (
          select parent.id, min(child.start_date) as s, max(child.end_date) as e
            from public.mg2030_task parent
            join public.mg2030_task child on child.parent_id = parent.id
           where parent.scenario_id = v_scenario.id
             and parent.archived_at is null
             and parent.task_type = 'summary'
             and child.archived_at is null
           group by parent.id
        ) agg
       where agg.id = t.id;
    end loop;

    -- Un intertitre ne porte JAMAIS de date (docs/SCHEMA.md §5.2).
    update public.mg2030_task
       set start_date = null, end_date = null
     where scenario_id = v_scenario.id and task_type = 'group_header';
  end loop;
end $$;
