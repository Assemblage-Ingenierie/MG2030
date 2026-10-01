-- ============================================================
-- mg2030_0036_user_name_parts.sql — prénom et nom, séparés.
--
-- `full_name` portait les deux d'un bloc. On ne pouvait donc ni trier par nom
-- de famille, ni écrire « Bonjour Kushtrim » dans un courriel, ni corriger une
-- casse sans retaper l'ensemble.
--
-- ⚠ `full_name` EST CONSERVÉ, ET RESTE LA VALEUR D'AFFICHAGE.
-- Il est lu partout — annuaire, organigramme, visa de livrable, assignataires
-- de la roadmap, écran d'administration. Le remplacer aurait demandé de
-- réécrire une vingtaine de requêtes pour un gain nul : il devient une valeur
-- DÉRIVÉE, tenue à jour par déclencheur dès que l'une des deux parties est
-- renseignée. Le code existant qui n'écrit que `full_name` continue de marcher
-- à l'identique.
--
-- ⚠ LA COUPURE SE FAIT À LA PREMIÈRE ESPACE, pas à la dernière.
-- « Prénom Nom » est la forme de tous les comptes existants. Au-delà, c'est le
-- NOM qui se compose le plus souvent en français — « Da Silva », « Le Goff » —
-- tandis qu'un prénom composé porte presque toujours un trait d'union, donc
-- reste d'un seul tenant. Couper à la dernière espace aurait rendu « Da » comme
-- prénom. Les cas que cette règle manquera se corrigent à la main, et se
-- voient.
-- ============================================================

alter table public.mg2030_app_user
  add column if not exists first_name text,
  add column if not exists last_name  text;

alter table public.mg2030_access_request
  add column if not exists first_name text,
  add column if not exists last_name  text;

comment on column public.mg2030_app_user.first_name is
  'Prénom. `full_name` en est dérivé par déclencheur.';
comment on column public.mg2030_app_user.last_name is
  'Nom de famille, parties composées comprises.';

-- ── Reprise ─────────────────────────────────────────────────────────────────

update public.mg2030_app_user
   set first_name = split_part(trim(full_name), ' ', 1),
       last_name  = nullif(trim(substr(trim(full_name),
                                       length(split_part(trim(full_name), ' ', 1)) + 1)), '')
 where first_name is null
   and full_name is not null;

update public.mg2030_access_request
   set first_name = split_part(trim(full_name), ' ', 1),
       last_name  = nullif(trim(substr(trim(full_name),
                                       length(split_part(trim(full_name), ' ', 1)) + 1)), '')
 where first_name is null
   and full_name is not null;

-- ── Cohérence ───────────────────────────────────────────────────────────────
--
-- Le déclencheur ne touche `full_name` QUE si l'une des deux parties est
-- fournie. Sans cette condition, une écriture qui ne renseigne que `full_name`
-- — l'approbation d'une demande d'accès, par exemple — l'effacerait.

create or replace function mg2030_private.compose_full_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.first_name is not null or new.last_name is not null then
    new.full_name := nullif(
      btrim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')), '');
  end if;
  return new;
end;
$$;

drop trigger if exists mg2030_app_user_compose_name on public.mg2030_app_user;
create trigger mg2030_app_user_compose_name
  before insert or update on public.mg2030_app_user
  for each row execute function mg2030_private.compose_full_name();

drop trigger if exists mg2030_access_request_compose_name on public.mg2030_access_request;
create trigger mg2030_access_request_compose_name
  before insert or update on public.mg2030_access_request
  for each row execute function mg2030_private.compose_full_name();
