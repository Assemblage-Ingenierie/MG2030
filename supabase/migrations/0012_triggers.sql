-- ============================================================
-- 0012_triggers — schéma privé, refus des cycles, horodatage, historique.
--
-- `mg2030_private` calque la convention maison du projet partagé
-- (`peebcoolsf_private` existe déjà). Il n'est PAS exposé à l'API PostgREST.
-- ============================================================

create schema if not exists mg2030_private;
revoke all on schema mg2030_private from public, anon, authenticated;
grant usage on schema mg2030_private to authenticated;

-- ── updated_at ─────────────────────────────────────────────────────────────
create or replace function mg2030_private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Refus des cycles de précédence ─────────────────────────────────────────
-- Un cycle rendrait le tri topologique du moteur impossible. On le refuse à
-- l'écriture plutôt que de le détecter au calcul : l'erreur est ainsi attachée
-- au geste qui l'a causée.
create or replace function mg2030_private.task_dependency_no_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    with recursive reachable(id) as (
      select new.successor_id
      union
      select d.successor_id
        from public.mg2030_task_dependency d
        join reachable r on d.predecessor_id = r.id
    )
    select 1 from reachable where id = new.predecessor_id
  ) then
    raise exception
      'Cycle de precedence refuse : la tache % ne peut pas preceder % (un chemin inverse existe deja)',
      new.predecessor_id, new.successor_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger mg2030_task_dependency_no_cycle
  before insert or update on mg2030_task_dependency
  for each row execute function mg2030_private.task_dependency_no_cycle();

-- ── Refus des cycles de hiérarchie ─────────────────────────────────────────
create or replace function mg2030_private.task_parent_no_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then return new; end if;
  if exists (
    with recursive ancestors(id) as (
      select new.parent_id
      union
      select t.parent_id
        from public.mg2030_task t
        join ancestors a on t.id = a.id
       where t.parent_id is not null
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'Cycle de hierarchie refuse sur la tache %', new.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger mg2030_task_parent_no_cycle
  before insert or update of parent_id on mg2030_task
  for each row execute function mg2030_private.task_parent_no_cycle();

-- ── Chemin matérialisé des dossiers ────────────────────────────────────────
create or replace function mg2030_private.folder_set_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_path text;
begin
  if new.parent_id is null then
    new.path := new.name;
  else
    select f.path into parent_path from public.mg2030_folder f where f.id = new.parent_id;
    if parent_path is null then
      raise exception 'Dossier parent introuvable : %', new.parent_id;
    end if;
    new.path := parent_path || '/' || new.name;
  end if;
  return new;
end;
$$;

create trigger mg2030_folder_set_path
  before insert or update of name, parent_id on mg2030_folder
  for each row execute function mg2030_private.folder_set_path();

-- ── Historique applicatif ──────────────────────────────────────────────────
-- Une ligne par CHAMP modifié (brief §7).
create or replace function mg2030_private.log_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  o jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
begin
  for k in select jsonb_object_keys(o || n) loop
    -- Le bruit technique n'est pas historisé.
    continue when k in ('updated_at', 'created_at');
    if o -> k is distinct from n -> k then
      insert into public.mg2030_change_log
        (table_name, row_id, field, old_value, new_value, operation, changed_by)
      values (
        tg_table_name,
        coalesce((n ->> 'id')::uuid, (o ->> 'id')::uuid),
        k, o ->> k, n ->> k,
        left(tg_op, 1),
        auth.uid()
      );
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;

-- ── Pose des triggers sur les tables métier ────────────────────────────────
do $$
declare
  tbl text;
  audited text[] := array[
    'mg2030_site', 'mg2030_building', 'mg2030_contract', 'mg2030_lot',
    'mg2030_lot_building', 'mg2030_task', 'mg2030_task_dependency',
    'mg2030_task_constraint', 'mg2030_schedule_scenario', 'mg2030_deliverable',
    'mg2030_no_objection', 'mg2030_document', 'mg2030_app_user',
    'mg2030_app_user_scope', 'mg2030_role_permission', 'mg2030_tag_access'
  ];
  touched text[] := array[
    'mg2030_site', 'mg2030_building', 'mg2030_contract', 'mg2030_lot',
    'mg2030_task', 'mg2030_deliverable', 'mg2030_no_objection',
    'mg2030_folder', 'mg2030_app_user', 'mg2030_procurement_template'
  ];
begin
  foreach tbl in array audited loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function mg2030_private.log_changes()',
      tbl || '_change_log', tbl);
  end loop;

  foreach tbl in array touched loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function mg2030_private.touch_updated_at()',
      tbl || '_touch', tbl);
  end loop;
end;
$$;
