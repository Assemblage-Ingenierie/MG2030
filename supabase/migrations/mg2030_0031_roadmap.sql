-- ============================================================
-- mg2030_0031_roadmap.sql — module Roadmap : suivi des actions de l'AMO.
--
-- La roadmap vivait dans une feuille Google, exportée en Excel. Ce module la
-- reprend. Le schéma est entièrement commandé par UN champ, celui qui résistait
-- au tableur : la TIMELINE.
--
-- ⚠ POURQUOI UNE PRÉCISION ET UN INTERVALLE, ET NON UNE DATE.
--
-- Sur les 14 lignes du tableur, 9 n'ont aucune date et UNE SEULE est une vraie
-- date Excel. Les autres sont du texte libre — « Oct 5 - Week », « oct 12 week »,
-- « Q1 2027 » —, orthographié de deux façons et sans année. Une colonne `date`
-- aurait forcé un choix : perdre ces lignes, ou leur inventer un jour. Les deux
-- sont faux, et le second est pire puisqu'il ne se voit pas.
--
-- On stocke donc DEUX choses :
--   • `timeline_kind`  — ce que l'auteur a VOULU DIRE : un jour, une semaine,
--     un mois, un trimestre, une plage libre. C'est lui qui commande l'écriture
--     à l'écran : « Week of 12 Oct » ne s'affichera jamais « 12/10/2026 » ;
--   • `timeline_start` / `timeline_end` — l'intervalle RÉSOLU, borne de fin
--     exclusive. C'est lui qui permet de trier, filtrer et dessiner la frise
--     sans recalculer la même arithmétique dans chaque requête.
--
-- `timeline_kind` nul = pas de date, et c'est le cas MAJORITAIRE. Ce n'est pas
-- une donnée manquante à combler : une action sans échéance est un fait, et
-- l'écran doit la montrer comme telle.
--
-- La contrainte `timeline_coherent` interdit les états intermédiaires : soit
-- les trois colonnes sont nulles, soit les trois sont renseignées avec une fin
-- strictement postérieure au début. Sans elle, une précision sans intervalle
-- serait indessinable, et un intervalle sans précision inécrivable.
--
-- ⚠ ASSIGNEES EN TEXTE LIBRE, DÉLIBÉRÉMENT (décidé le 01/10/2026).
-- Le tableur mêle des personnes qui ont un compte (Kushtrim, Sami), une
-- personne qui n'en a pas (Alban), deux organisations (TA, AFD) et un tiers
-- non identifié (G8). Aucun référentiel du projet ne les contient tous :
-- `mg2030_app_user` compte 5 lignes, `mg2030_org_unit` ne porte que des postes.
-- Une clé étrangère obligatoire aurait donc perdu quatre assignataires sur six.
-- Le `label` fait foi ; `app_user_id` n'est qu'un RATTACHEMENT FACULTATIF, pour
-- les usages à venir (« mes actions », notifications).
-- ============================================================

-- ── Types ───────────────────────────────────────────────────────────────────

do $$ begin
  create type mg2030_roadmap_timeline_kind as enum ('day', 'week', 'month', 'quarter', 'range');
exception when duplicate_object then null; end $$;

-- `done` n'existe PAS dans le tableur — ses quatre valeurs sont Pending,
-- Not Started, In Progress et vide. Il est ajouté ici parce que la vue liste
-- masque les actions terminées par défaut : sans ce statut, le filtre n'aurait
-- rien à masquer.
do $$ begin
  create type mg2030_roadmap_status as enum ('not_started', 'pending', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mg2030_roadmap_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

-- ── Sujets ──────────────────────────────────────────────────────────────────
--
-- Référentiel PROPRE, et non rabattu sur `subproject`. « Student Center » et
-- « Training venues » y correspondraient, mais « Project Steering »,
-- « Training and capacity building » et « Monitoring & Evaluation » n'ont aucun
-- équivalent : ce sont des chantiers de pilotage, pas des ouvrages.
--
-- `sort_order` parce que l'ordre du tableur porte du sens — il va du pilotage
-- général vers les ouvrages, et le lecteur le retrouve.

create table if not exists public.mg2030_roadmap_subject (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.mg2030_roadmap_subject is
  'Grands sujets de la roadmap. Ordre significatif, repris du tableur source.';

-- ── Actions ─────────────────────────────────────────────────────────────────

create table if not exists public.mg2030_roadmap_action (
  id             uuid primary key default gen_random_uuid(),
  subject_id     uuid not null references public.mg2030_roadmap_subject (id) on delete restrict,
  title          text not null,

  -- Nuls tous les deux dans le tableur source : une action dont personne n'a
  -- fixé le statut n'est pas « Not Started », c'est une action dont on ne sait
  -- rien. Même règle que l'avancement « non renseigné » du plan de charge.
  status         mg2030_roadmap_status   null,
  priority       mg2030_roadmap_priority null,

  timeline_kind  mg2030_roadmap_timeline_kind null,
  timeline_start date null,
  timeline_end   date null,

  comments       text null,
  sort_order     integer not null default 0,
  created_by     uuid null references public.mg2030_app_user (id) on delete set null,
  archived_at    timestamptz null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint mg2030_roadmap_action_timeline_coherent check (
    (timeline_kind is null and timeline_start is null and timeline_end is null)
    or (timeline_kind is not null and timeline_start is not null
        and timeline_end is not null and timeline_end > timeline_start)
  )
);

comment on column public.mg2030_roadmap_action.timeline_kind is
  'Précision VOULUE : day, week, month, quarter, range. Nul = aucune date. Commande l''affichage.';
comment on column public.mg2030_roadmap_action.timeline_end is
  'Borne EXCLUSIVE. Une semaine du lundi 12 va du 12 au 19, pas au 18.';

create index if not exists mg2030_roadmap_action_subject_idx
  on public.mg2030_roadmap_action (subject_id, sort_order);
create index if not exists mg2030_roadmap_action_timeline_idx
  on public.mg2030_roadmap_action (timeline_start, timeline_end);

drop trigger if exists mg2030_roadmap_action_touch on public.mg2030_roadmap_action;
create trigger mg2030_roadmap_action_touch
  before update on public.mg2030_roadmap_action
  for each row execute function mg2030_private.touch_updated_at();

-- ── Assignataires ───────────────────────────────────────────────────────────

create table if not exists public.mg2030_roadmap_assignee (
  id          uuid primary key default gen_random_uuid(),
  action_id   uuid not null references public.mg2030_roadmap_action (id) on delete cascade,
  label       text not null,
  app_user_id uuid null references public.mg2030_app_user (id) on delete set null,
  sort_order  integer not null default 0,
  unique (action_id, label)
);

comment on column public.mg2030_roadmap_assignee.label is
  'Fait foi. Peut désigner une personne sans compte (Alban), une organisation (TA, AFD) ou un tiers (G8).';
comment on column public.mg2030_roadmap_assignee.app_user_id is
  'Rattachement FACULTATIF à un compte, quand le nom en désigne un. Jamais exigé.';

create index if not exists mg2030_roadmap_assignee_action_idx
  on public.mg2030_roadmap_assignee (action_id);
create index if not exists mg2030_roadmap_assignee_user_idx
  on public.mg2030_roadmap_assignee (app_user_id);

-- ── Permission ──────────────────────────────────────────────────────────────
--
-- Accordée à TOUS les rôles fonctionnels (décision du 01/10/2026).
--
-- ⚠ Cela ne donne PAS l'écriture à tout le monde. La politique exige
-- `can_write() AND has_perm(...)`, et `can_write()` est fausse pour toute
-- organisation en `access_mode = 'read_only'` — c'est le cas de l'AFD. Un
-- membre AFD porte donc la permission sans pouvoir écrire, ce qui est le
-- comportement voulu : le bailleur lit, il ne tient pas la roadmap.

insert into public.mg2030_permission (code, entity, action, description)
values ('roadmap.write', 'roadmap', 'write',
        'Créer, modifier et supprimer les actions de la roadmap.')
on conflict (code) do nothing;

insert into public.mg2030_role_permission (functional_role_id, permission_code)
select r.id, 'roadmap.write' from public.mg2030_functional_role r
on conflict do nothing;

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- ⚠ QUATRE POLITIQUES EXPLICITES PAR TABLE, JAMAIS `FOR ALL`.
-- Une politique `FOR ALL` couvre aussi le SELECT et s'additionne en OU : c'est
-- ainsi que la lecture s'était élargie en silence sur quatre tables. Le
-- garde-fou `mg2030_private.check_policy_guardrail()` les refuse désormais.

alter table public.mg2030_roadmap_subject  enable row level security;
alter table public.mg2030_roadmap_action   enable row level security;
alter table public.mg2030_roadmap_assignee enable row level security;

do $$
declare t text;
begin
  foreach t in array array['mg2030_roadmap_subject',
                           'mg2030_roadmap_action',
                           'mg2030_roadmap_assignee']
  loop
    execute format('drop policy if exists %I_read   on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);

    -- Lecture : tout membre actif. La roadmap est un outil de pilotage
    -- partagé ; la cloisonner par périmètre la rendrait illisible.
    execute format($p$
      create policy %I_read on public.%I for select to authenticated
        using (mg2030_private.is_active_user())$p$, t, t);

    execute format($p$
      create policy %I_insert on public.%I for insert to authenticated
        with check (mg2030_private.can_write()
                    and mg2030_private.has_perm('roadmap.write'))$p$, t, t);

    execute format($p$
      create policy %I_update on public.%I for update to authenticated
        using      (mg2030_private.can_write()
                    and mg2030_private.has_perm('roadmap.write'))
        with check (mg2030_private.can_write()
                    and mg2030_private.has_perm('roadmap.write'))$p$, t, t);

    execute format($p$
      create policy %I_delete on public.%I for delete to authenticated
        using (mg2030_private.can_write()
               and mg2030_private.has_perm('roadmap.write'))$p$, t, t);

    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
