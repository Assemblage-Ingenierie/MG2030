-- ============================================================
-- supabase/tests/seed-invariants.sql
--
-- Contrôle du chargement. ÉCHOUE bruyamment (raise exception) plutôt que de
-- renvoyer un tableau qu'on oublie de lire.
--
-- Le contrôle central est « RECALCUL NEUTRE » : après la correction GAPS 12,
-- recalculer les dates depuis les durées et les précédences doit redonner
-- EXACTEMENT les dates du fichier Excel d'origine. C'est ce qui prouve que la
-- reprise de l'historique est sûre, et que la PIU ne verra pas ses dates bouger
-- en changeant d'outil.
--
-- Exécution : via l'outil SQL Supabase, ou `supabase db execute`.
-- ============================================================

do $$
declare
  n integer;
  m integer;
  v numeric;
  b boolean;
begin
  -- ── 1. Comptes de lignes ────────────────────────────────────────────────
  for n, m in
    select cnt, expected from (values
      ((select count(*) from mg2030_organisation),       3),
      ((select count(*) from mg2030_functional_role),   14),
      ((select count(*) from mg2030_org_unit),          14),
      ((select count(*) from mg2030_schedule_scenario),  3),
      ((select count(*) from mg2030_plan),               2),
      ((select count(*) from mg2030_site),              14),
      ((select count(*) from mg2030_building),          36),
      ((select count(*) from mg2030_contract),           9),
      ((select count(*) from mg2030_lot),               15),
      ((select count(*) from mg2030_lot_building),      46),
      ((select count(*) from mg2030_task),              27),
      ((select count(*) from mg2030_task_dependency),   19),
      ((select count(*) from mg2030_task_constraint),    4),
      ((select count(*) from mg2030_tag),                4),
      ((select count(*) from mg2030_folder),            39)
    ) as t(cnt, expected)
  loop
    if n <> m then
      raise exception 'Compte de lignes : % au lieu de %', n, m;
    end if;
  end loop;

  -- ── 2. end_date = start_date + duration_days, sur 21/21 ────────────────
  -- 19/21 seulement dans le CSV : TV.2.1 et SC.2.2 y portent 21 jours pour un
  -- ecart de 20. La correction GAPS 12 (duree ramenee a 20) porte le compte a
  -- 21/21. Si ce controle retombe a 19, c'est que la correction a saute.
  select count(*) filter (where end_date = start_date + duration_days), count(*)
    into n, m
    from mg2030_task
   where duration_days is not null and start_date is not null;
  if n <> m then
    raise exception 'Duree : % taches sur % verifient end = start + duration_days (correction GAPS 12 perdue ?)', n, m;
  end if;

  -- ── 3. duration_weeks = round(duration_days / 7, 2) ────────────────────
  -- La conversion jours = semaines x 7 du brief §7, confirmee par le nom defini
  -- `week` = 7 du fichier source. Colonne generee : elle ne peut pas deriver,
  -- mais on la verifie quand meme — c'est la convention qui fonde tout le reste.
  select count(*) filter (where duration_weeks = round(duration_days / 7.0, 2)), count(*)
    into n, m from mg2030_task where duration_days is not null;
  if n <> m then
    raise exception 'Semaines : % taches sur % verifient semaines = jours / 7', n, m;
  end if;

  -- ── 4. RECALCUL NEUTRE : start = MAX(fin des predecesseurs + decalage) ──
  -- Les convergences sont incluses : TV.2.4 et SC.2.5 ont DEUX predecesseurs.
  select count(*) filter (where s.start_date = mx.max_end), count(*) into n, m
    from mg2030_task s
    join (select d.successor_id, max(p.end_date + d.lag_days) as max_end
            from mg2030_task_dependency d
            join mg2030_task p on p.id = d.predecessor_id
           group by d.successor_id) mx on mx.successor_id = s.id;
  if n <> m then
    raise exception 'RECALCUL NON NEUTRE : % successeurs sur % demarrent a MAX(fin des predecesseurs). La reprise du planning n''est PAS sure.', n, m;
  end if;

  -- ── 5. summary agrege MIN/MAX de ses enfants ───────────────────────────
  select count(*) filter (where p.start_date = k.mn and p.end_date = k.mx), count(*)
    into n, m
    from mg2030_task p
    join (select parent_id, min(start_date) mn, max(end_date) mx
            from mg2030_task where parent_id is not null group by parent_id) k
      on k.parent_id = p.id
   where p.task_type = 'summary';
  if n <> m then
    raise exception 'Recapitulatifs : % sur % agregent MIN/MAX de leurs enfants', n, m;
  end if;

  -- ── 6. group_header n'agrege PAS ───────────────────────────────────────
  -- TV.3 est sans dates alors que ses enfants couvrent 18 mois. C'est ce qui
  -- distingue un intertitre d'un recapitulatif, et aucune bibliotheque Gantt
  -- ne connait cette distinction (docs/GANTT_ARBITRAGE.md §1).
  select count(*) into n from mg2030_task
   where task_type = 'group_header' and (start_date is not null or end_date is not null);
  if n > 0 then
    raise exception 'Intertitres : % ligne(s) group_header portent des dates', n;
  end if;

  -- ── 7. Sommes des estimations (BPR 7.7) ────────────────────────────────
  select sum(b.works_estimate_eur) into v
    from mg2030_building b join mg2030_site s on s.id = b.site_id
   where s.site_code = 'SC';
  if v <> 37218706 then
    raise exception 'Estimations Student Center : % au lieu de 37 218 706 EUR', v;
  end if;

  select sum(b.works_estimate_eur) into v
    from mg2030_building b join mg2030_site s on s.id = b.site_id
   where s.site_code <> 'SC';
  if v <> 3539416 then
    raise exception 'Estimations training venues : % au lieu de 3 539 416 EUR', v;
  end if;

  -- ── 8. GAPS 9 : design_bid_build charge SANS taches ────────────────────
  select is_schedulable into b from mg2030_schedule_scenario where code = 'design_bid_build';
  if b then
    raise exception 'design_bid_build est marque planifiable alors qu''aucun planning exploitable n''existe (GAPS 9)';
  end if;
  select count(*) into n from mg2030_task t
    join mg2030_schedule_scenario s on s.id = t.scenario_id
   where s.code = 'design_bid_build';
  if n > 0 then
    raise exception 'design_bid_build porte % tache(s) : des dates ont ete inventees', n;
  end if;

  -- ── 9. GAPS 3 : les 13 salles de training venues sont NON affectees ────
  select count(*) into n
    from mg2030_building b
    join mg2030_site s on s.id = b.site_id
   where s.subproject = 'training_venues'
     and exists (select 1 from mg2030_lot_building lb where lb.building_id = b.id);
  if n > 0 then
    raise exception '% salle(s) de training venues sont affectees a un lot : la repartition n''est pourtant pas arretee (GAPS 3)', n;
  end if;

  -- ── 10. Aucune donnee inventee la ou le seed est vide ──────────────────
  select count(*) into n from mg2030_site
   where address is not null or latitude is not null or longitude is not null;
  if n > 0 then
    raise exception '% site(s) portent une adresse ou des coordonnees : elles sont absentes des sources (GAPS 1 et 2)', n;
  end if;

  select count(*) into n from mg2030_contract where contractor is not null;
  if n > 0 then
    raise exception '% marche(s) portent un titulaire : aucun n''est attribue (GAPS 7)', n;
  end if;

  select count(*) into n from mg2030_task where owner_id is not null or validator_id is not null;
  if n > 0 then
    raise exception '% tache(s) portent un responsable : le fichier source n''en contient aucun (GAPS 8)', n;
  end if;

  raise notice 'seed-invariants : les 10 controles passent.';
end;
$$;
