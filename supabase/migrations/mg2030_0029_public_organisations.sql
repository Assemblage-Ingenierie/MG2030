-- ============================================================
-- mg2030_0029_public_organisations.sql
--
-- LA LISTE DES ENTITÉS, POUR LE FORMULAIRE D'INSCRIPTION.
--
-- La page /signup est ANONYME : la personne n'a pas encore de compte. Elle ne
-- peut donc pas lire `mg2030_organisation`, dont la politique exige un compte
-- authentifié — et c'est très bien ainsi. Mais il faut bien lui proposer la
-- liste dans laquelle on lui demande de choisir son entité.
--
-- Deux façons de s'en sortir, une seule qui tienne.
--
--   ✗ Ouvrir la table en lecture aux anonymes. Elle porte `access_mode`,
--     c'est-à-dire un fragment du modèle d'autorisation. Rien d'exploitable —
--     la RLS décide seule — mais c'est de la mécanique interne, et on n'expose
--     pas de la mécanique interne pour remplir une liste déroulante.
--
--   ✓ Une fonction qui rend TROIS COLONNES et rien d'autre : identifiant, code,
--     nom. Le nom des trois partenaires figure déjà sur la page de connexion ;
--     `access_mode` reste derrière la RLS.
--
-- ⚠ `security definer` s'impose ici précisément parce que l'appelant n'a aucun
-- droit sur la table. La fonction est donc écrite pour ne RIEN faire d'autre
-- que ce select : pas de paramètre, donc pas d'injection possible, et
-- `search_path` vide comme partout ailleurs.
-- ============================================================

create or replace function public.mg2030_signup_organisations()
returns table (id uuid, code text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.code, o.name
    from public.mg2030_organisation o
   order by o.code;
$$;

comment on function public.mg2030_signup_organisations() is
  'Entités du projet (id, code, nom) pour le formulaire d''inscription anonyme. N''expose pas access_mode.';

revoke all on function public.mg2030_signup_organisations() from public;
grant execute on function public.mg2030_signup_organisations() to anon, authenticated;
