-- ============================================================
-- 0043_email_mirror — l'adresse de l'annuaire suit celle du compte.
--
-- `mg2030_app_user.email` est une COPIE de `auth.users.email`. Elle existe
-- parce que l'annuaire, l'organigramme et le visa de livrable la lisent sous
-- RLS, et que `auth.users` n'est pas lisible sans la clé de service.
--
-- ⚠ UNE COPIE QUI NE SE MET PAS À JOUR EST PIRE QUE PAS DE COPIE. Changer son
-- adresse passe par Supabase Auth — `updateUser({ email })`, puis confirmation
-- depuis la NOUVELLE adresse. Sans ce déclencheur, l'annuaire continuerait
-- d'afficher l'ancienne indéfiniment : on écrirait à une adresse morte en
-- croyant écrire à la bonne.
--
-- Mêmes précautions que 0041, et pour la même raison — `auth.users` est
-- partagée avec l'autre application du projet :
--   1. la mise à jour ne touche QUE les lignes qui existent dans
--      `mg2030_app_user`, donc jamais un compte de l'autre application ;
--   2. toute erreur est avalée : une synchronisation ratée doit coûter une
--      adresse périmée dans notre annuaire, jamais un changement d'adresse
--      refusé.
-- ============================================================

create or replace function mg2030_private.sync_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not distinct from old.email then
    return new;
  end if;

  begin
    update public.mg2030_app_user set email = new.email where id = new.id;
    update public.mg2030_access_request set email = new.email where auth_user_id = new.id;
  exception when others then
    null;
  end;

  return new;
end $$;

comment on function mg2030_private.sync_email() is
  'Recopie l''adresse dans mg2030_app_user quand elle change dans auth.users. '
  'Ne touche que nos lignes, et n''échoue jamais — auth.users est partagée.';

drop trigger if exists mg2030_sync_email on auth.users;
create trigger mg2030_sync_email
  after update of email on auth.users
  for each row execute function mg2030_private.sync_email();
