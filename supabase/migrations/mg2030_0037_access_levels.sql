-- ============================================================
-- 0037_access_levels — TROIS niveaux d'accès, et un seul endroit qui décide.
--
-- Le modèle d'origine (brief §8) croisait trois dimensions pour répondre à une
-- seule question — « cette personne peut-elle écrire ceci ? » :
--
--   1. l'ORGANISATION portait un mode d'accès (`contributor` / `read_only`) ;
--   2. le RÔLE FONCTIONNEL portait une matrice de permissions, plus un drapeau
--      `is_platform_admin` ;
--   3. le PÉRIMÈTRE disait sur quels sites et lots.
--
-- Les deux premières se recouvraient sans jamais se contredire utilement : on
-- ne pouvait pas donner l'écriture à une personne de l'AFD sans basculer TOUTE
-- l'AFD en contributeur, ni retirer un droit à quelqu'un sans toucher à un rôle
-- partagé par ses collègues. Les droits se réglaient donc par SQL, et personne
-- ne savait dire de mémoire qui pouvait quoi.
--
-- Ils fusionnent ici en UN attribut du compte, à trois valeurs :
--
--   • `viewer`        — voit tout ce que son périmètre autorise, n'écrit rien.
--                       Il filtre, trie et exporte : lire n'est pas subir.
--   • `editor`        — écrit partout où il voit, SAUF sur les comptes.
--   • `administrator` — éditeur, plus la gestion des comptes et des onglets.
--
-- La DIMENSION 3 (périmètre) est INCHANGÉE : elle répond à une autre question,
-- « sur quoi », et reste utile.
--
-- ⚠ CE QUE CELA CHANGE POUR L'AFD. Le mode `read_only` de l'organisation ne
-- décide plus rien. Tous les comptes AFD sont donc initialisés en `viewer`,
-- ce qui reproduit EXACTEMENT leurs droits actuels ; mais un administrateur
-- peut désormais ouvrir l'écriture à une personne précise sans rien changer
-- pour les autres. La colonne `access_mode` est conservée : elle reste une
-- information de gouvernance (brief §3), elle n'est plus une règle d'accès.
-- ============================================================

-- ── Le niveau ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'mg2030_access_level') then
    create type public.mg2030_access_level as enum ('viewer', 'editor', 'administrator');
  end if;
end $$;

alter table public.mg2030_app_user
  add column if not exists access_level public.mg2030_access_level not null default 'viewer';

comment on column public.mg2030_app_user.access_level is
  'SEULE autorité des droits d''écriture depuis 0037. viewer < editor < '
  'administrator. Le périmètre (mg2030_app_user_scope) reste indépendant : il '
  'dit SUR QUOI, celui-ci dit QUOI.';

-- Reprise de l'existant, à droits constants : personne ne gagne ni ne perd
-- quoi que ce soit au passage.
--   administrateur plateforme  → administrator
--   organisation contributrice → editor
--   le reste (AFD)             → viewer
update public.mg2030_app_user u
   set access_level = case
     when (select r.is_platform_admin
             from public.mg2030_functional_role r
            where r.id = u.functional_role_id) then 'administrator'::public.mg2030_access_level
     when (select o.access_mode
             from public.mg2030_organisation o
            where o.id = u.organisation_id) = 'contributor' then 'editor'::public.mg2030_access_level
     else 'viewer'::public.mg2030_access_level
   end;

create index if not exists mg2030_app_user_access_level_idx
  on public.mg2030_app_user (access_level);

-- ── Le verrou ───────────────────────────────────────────────────────────────
--
-- ⚠ SANS CE DÉCLENCHEUR, LE NIVEAU SERAIT AUTO-ATTRIBUABLE.
--
-- La politique `mg2030_app_user_update_self` autorise chacun à modifier SA
-- PROPRE fiche (locale, intitulé de poste). Poser le niveau d'accès sur cette
-- même ligne offrirait donc à tout éditeur de s'écrire `administrator` d'une
-- requête — la RLS n'ayant aucun moyen de distinguer les colonnes.
--
-- Le défaut préexistait d'ailleurs sous l'ancien modèle, sur
-- `functional_role_id` : s'affecter un rôle `is_platform_admin` produisait le
-- même résultat. Les quatre colonnes de droits sont donc verrouillées
-- ensemble, et seul un administrateur peut les changer.
create or replace function mg2030_private.guard_access_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Pas de session : écriture de maintenance (migration, clef de service). Ce
  -- n'est pas une tentative d'auto-promotion, et la bloquer rendrait la table
  -- inadministrable en SQL. Aucune brèche pour autant : toutes les politiques
  -- de la table sont `to authenticated`, donc une requête sans session
  -- n'atteint jamais ce déclencheur par le chemin public.
  if (select auth.uid()) is null then return new; end if;

  if (new.access_level       is distinct from old.access_level)
  or (new.is_active          is distinct from old.is_active)
  or (new.organisation_id    is distinct from old.organisation_id)
  or (new.functional_role_id is distinct from old.functional_role_id)
  then
    if not mg2030_private.is_platform_admin() then
      raise exception
        'Seul un administrateur peut modifier le niveau d''accès, '
        'l''activation, l''organisation ou le rôle d''un compte.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

comment on function mg2030_private.guard_access_columns() is
  'Empêche l''auto-promotion : la politique update_self couvre toute la ligne, '
  'ce déclencheur en retire les quatre colonnes de droits.';

drop trigger if exists mg2030_app_user_guard_access on public.mg2030_app_user;
create trigger mg2030_app_user_guard_access
  before update on public.mg2030_app_user
  for each row execute function mg2030_private.guard_access_columns();

-- ── Les fonctions d'appui, redéfinies ───────────────────────────────────────
--
-- Seul leur CORPS change : les quelque cent politiques qui les appellent
-- restent telles quelles. Réécrire les politiques une à une aurait multiplié
-- les occasions d'en élargir une par inadvertance — c'est exactement ce qui
-- s'était produit avec les `FOR ALL`.

create or replace function mg2030_private.can_write() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mg2030_app_user u
     where u.id = (select auth.uid())
       and u.is_active
       and u.access_level in ('editor', 'administrator')
  );
$$;

create or replace function mg2030_private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mg2030_app_user u
     where u.id = (select auth.uid())
       and u.is_active
       and u.access_level = 'administrator'
  );
$$;

-- ⚠ `has_perm` IGNORE DÉSORMAIS LE DÉTAIL DE SON ARGUMENT, à une exception
-- près : les permissions `user.*` sont réservées à l'administrateur, puisque
-- « éditeur » se définit précisément comme « tout, sauf gérer les comptes ».
--
-- L'argument est CONSERVÉ plutôt que supprimé : il documente au point d'appel
-- ce que la politique protège, et il permettra de refaire de la granularité
-- sans retoucher une seule politique.
create or replace function mg2030_private.has_perm(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p like 'user.%' then mg2030_private.is_platform_admin()
    else mg2030_private.can_write()
  end;
$$;

comment on function mg2030_private.has_perm(text) is
  'Depuis 0037 : trois niveaux, plus de matrice. Seules les permissions '
  'user.* distinguent encore l''administrateur de l''éditeur. L''argument est '
  'conservé pour documenter le point d''appel.';

-- ── Ce qui ne décide plus rien ──────────────────────────────────────────────
--
-- Les tables sont conservées — les supprimer toucherait la liste d'audit de
-- 0012 et le seed de 0031 — mais plus AUCUNE lecture applicative ni politique
-- ne les consulte. Le commentaire est là pour que personne ne les croie
-- vivantes en les relisant dans six mois.
comment on table public.mg2030_role_permission is
  'SANS EFFET depuis 0037. Les droits viennent de mg2030_app_user.access_level. '
  'Conservée le temps d''une version, à supprimer ensuite.';

comment on column public.mg2030_functional_role.is_platform_admin is
  'SANS EFFET depuis 0037. Le rôle fonctionnel ne décrit plus qu''un POSTE '
  '(organigramme, intitulé) ; les droits sont portés par le compte.';

comment on column public.mg2030_organisation.access_mode is
  'SANS EFFET sur les droits depuis 0037 — conservé comme information de '
  'gouvernance (brief §3 : l''AFD est en lecture). Voir access_level.';
