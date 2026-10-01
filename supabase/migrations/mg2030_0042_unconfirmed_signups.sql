-- ============================================================
-- 0042_unconfirmed_signups — dire à l'administrateur ce qui bloque vraiment.
--
-- ⚠ APPROUVER NE SUFFIT PAS SI L'ADRESSE N'EST PAS CONFIRMÉE. Depuis 0041, une
-- personne inscrite apparaît en demande d'accès même sans avoir cliqué son
-- lien de confirmation. L'administrateur peut donc l'approuver — et elle ne
-- pourra toujours pas se connecter, sans que rien à l'écran l'explique. On
-- aurait remplacé une absence silencieuse par une approbation silencieusement
-- inopérante.
--
-- `auth.users` n'est pas lisible sous RLS : il faudrait la clé de service, que
-- l'on garde confinée à deux fichiers (GAPS 54). D'où cette fonction, qui ne
-- rend QU'UNE LISTE D'IDENTIFIANTS déjà connus de l'appelant — ceux des
-- demandes qu'il voit — et rien d'autre : ni adresse, ni date, ni jeton.
--
-- Réservée à l'administrateur de la plateforme, et `revoke` explicite sur
-- `anon` : une fonction `security definer` exposée à l'API doit dire elle-même
-- qui a le droit de l'appeler.
-- ============================================================

create or replace function public.mg2030_unconfirmed_signups()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
    from auth.users u
    join public.mg2030_access_request r on r.auth_user_id = u.id
   where mg2030_private.is_platform_admin()
     and r.status = 'pending'
     and u.email_confirmed_at is null;
$$;

comment on function public.mg2030_unconfirmed_signups() is
  'Identifiants des demandes en attente dont l''adresse n''est pas confirmée. '
  'Réservée à l''administrateur. Ne divulgue rien qu''il ne voie déjà.';

revoke all on function public.mg2030_unconfirmed_signups() from public, anon;
grant execute on function public.mg2030_unconfirmed_signups() to authenticated;
