-- ============================================================
-- 0041_signup_visible — une inscription se voit DÈS L'INSCRIPTION.
--
-- ⚠ LE DÉFAUT. La demande d'accès ne s'écrivait qu'une fois la session
-- ouverte, parce que sa politique d'insertion exige `auth.uid() =
-- auth_user_id`. Or la session n'existe qu'après confirmation de l'adresse.
-- Quiconque s'inscrit et ne reçoit pas — ou ne clique pas — l'e-mail de
-- confirmation n'existe donc NULLE PART pour l'administrateur : ni membre, ni
-- demande en attente. Il attend, l'administrateur ne sait pas qu'il attend.
--
-- Constaté deux fois : Kushtrim Krasniqi le 29/09/2026 (lien de confirmation
-- partant vers l'autre application, corrigé depuis), puis Barbara Petri le
-- 01/10/2026, inscrite à 12 h 50, adresse jamais confirmée, invisible de
-- l'écran des comptes.
--
-- Corriger l'e-mail ne suffit pas : un e-mail peut toujours se perdre. C'est
-- la TRACE qui doit exister sans lui.
--
-- ⚠ UN DÉCLENCHEUR SUR `auth.users`, QUI EST UNE TABLE PARTAGÉE avec l'autre
-- application du projet (SCHEMA §1). Deux précautions, et elles ne sont pas
-- facultatives :
--
--   1. IL NE FAIT RIEN hors MG2030. Le formulaire d'inscription pose déjà
--      `app: "mg2030"` dans les métadonnées — c'est ce qui aiguille le modèle
--      d'e-mail. On s'en sert comme garde : toute autre inscription ressort
--      immédiatement.
--   2. IL NE PEUT PAS FAIRE ÉCHOUER UNE INSCRIPTION. Le corps est enveloppé
--      dans un bloc qui avale toute erreur. Une contrainte violée ici doit
--      coûter une ligne manquante dans notre écran d'administration, jamais un
--      compte non créé — a fortiori pour l'autre application.
-- ============================================================

create or replace function mg2030_private.record_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_user_meta_data->>'app', '') <> 'mg2030' then
    return new;
  end if;

  begin
    insert into public.mg2030_access_request (auth_user_id, email, full_name)
    values (
      new.id,
      coalesce(new.email, ''),
      -- `full_name` est NOT NULL. À défaut de métadonnée, l'adresse fait un
      -- libellé honnête : l'administrateur verra qui attend, et le nom se
      -- complétera quand la personne finira son inscription.
      coalesce(nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''), new.email, '?')
    )
    on conflict (auth_user_id) do nothing;
  exception when others then
    -- Volontairement muet : voir la précaution 2 ci-dessus.
    null;
  end;

  return new;
end $$;

comment on function mg2030_private.record_signup() is
  'Dépose une demande d''accès EN ATTENTE dès l''inscription, avant même la '
  'confirmation d''adresse. Garde-fou : ne fait rien hors app=mg2030, et '
  'n''échoue jamais — auth.users est partagé.';

drop trigger if exists mg2030_record_signup on auth.users;
create trigger mg2030_record_signup
  after insert on auth.users
  for each row execute function mg2030_private.record_signup();

-- ── Le demandeur complète SA demande ────────────────────────────────────────
--
-- La ligne existe désormais avant lui : son `upsert` de fin d'inscription
-- tombe donc sur un conflit, et fait un UPDATE. Sans cette politique, seule
-- l'administration pouvait mettre à jour — et la personne ne pouvait plus
-- renseigner son nom, son poste ni son organisation.
--
-- `pending` dans les deux sens : une demande traitée ne se rouvre pas en
-- modifiant sa propre ligne.
drop policy if exists mg2030_access_request_update_own on public.mg2030_access_request;
create policy mg2030_access_request_update_own on public.mg2030_access_request
  for update to authenticated
  using      ((select auth.uid()) = auth_user_id and status = 'pending')
  with check ((select auth.uid()) = auth_user_id and status = 'pending');
