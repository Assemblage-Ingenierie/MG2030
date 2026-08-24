-- ============================================================
-- mg2030_0024 — demandes d'accès.
--
-- POURQUOI. Le brief §3 prévoyait des comptes créés par un administrateur,
-- sans inscription libre. Ouvrir une trentaine de comptes à la main s'est
-- révélé impraticable : décision du 21/08/2026 d'autoriser l'inscription.
--
-- LA SÛRETÉ NE CHANGE PAS. S'inscrire crée un compte d'AUTHENTIFICATION,
-- jamais un membre. Toute la RLS passe par `mg2030_private.is_member()`, qui
-- interroge `mg2030_app_user` : sans ligne dans cette table, le nouveau venu
-- lit zéro ligne sur les 30 tables. Il atterrit sur un écran d'attente.
--
-- POURQUOI UNE TABLE plutôt que lire `auth.users`. Lire `auth.users` exigerait
-- la clé de service, que l'on garde confinée à deux fichiers (GAPS 54). Ici le
-- demandeur écrit sa propre ligne, sous RLS, et c'est tout.
--
-- ELLE DISTINGUE AUSSI DEUX SITUATIONS QUI SE RESSEMBLENT. `auth.users` est
-- partagé avec l'autre application du projet (GAPS 52) : un compte inconnu de
-- MG2030 peut être un inscrit qui attend, ou un utilisateur de l'autre
-- application qui n'a rien à attendre. Sans cette table, on afficherait le
-- même message aux deux — et l'un attendrait indéfiniment.
-- ============================================================

create type public.mg2030_access_request_status as enum ('pending', 'approved', 'rejected');

create table public.mg2030_access_request (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text not null,
  job_title    text,
  message      text,
  status       public.mg2030_access_request_status not null default 'pending',
  handled_by   uuid references public.mg2030_app_user(id),
  handled_at   timestamptz,
  created_at   timestamptz not null default now(),
  -- Une demande traitée porte une date, une demande en attente n'en porte pas.
  constraint mg2030_access_request_handled_coherent check (
    (status = 'pending') = (handled_at is null)
  )
);

create index mg2030_access_request_status_idx
  on public.mg2030_access_request (status, created_at desc);

alter table public.mg2030_access_request enable row level security;

-- Chacun crée SA demande, et une seule : l'unicité s'en charge.
create policy mg2030_access_request_insert_own on public.mg2030_access_request
  for insert to authenticated
  with check ((select auth.uid()) = auth_user_id);

create policy mg2030_access_request_read on public.mg2030_access_request
  for select to authenticated
  using (
    (select auth.uid()) = auth_user_id
    or mg2030_private.is_platform_admin()
  );

create policy mg2030_access_request_update_admin on public.mg2030_access_request
  for update to authenticated
  using (mg2030_private.is_platform_admin())
  with check (mg2030_private.is_platform_admin());

create policy mg2030_access_request_delete_admin on public.mg2030_access_request
  for delete to authenticated
  using (mg2030_private.is_platform_admin());

grant select, insert, update, delete on public.mg2030_access_request to authenticated;
