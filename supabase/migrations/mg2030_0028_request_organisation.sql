-- ============================================================
-- mg2030_0028_request_organisation.sql
--
-- L'ENTITÉ D'APPARTENANCE EST DÉCLARÉE À L'INSCRIPTION.
--
-- Demandé le 16/09/2026 : colorer les barres du Gantt selon l'entité
-- responsable (TA, AFD, PIU), « l'entité étant renseignée à l'inscription de
-- l'utilisateur ».
--
-- ⚠ AUCUNE COLONNE NOUVELLE SUR mg2030_app_user, ET AUCUN ENUM.
-- L'entité existe déjà, et depuis le début : `mg2030_organisation` porte
-- exactement les trois codes attendus — TA (assistance technique), AFD, PIU
-- (unité d'exécution du MJS) — et `mg2030_app_user.organisation_id` y renvoie.
-- Créer un second axe « entité » à côté aurait garanti la divergence des deux
-- le jour où une quatrième organisation apparaîtra.
--
-- Ce qui manquait est ailleurs : la DEMANDE d'accès ne recueillait pas
-- l'organisation. L'administrateur devait donc la deviner au moment d'approuver
-- — à partir du seul nom de domaine de l'adresse, ce qui est faux dès qu'un
-- expert de l'assistance technique écrit depuis sa propre société.
--
-- Le choix du demandeur reste une DÉCLARATION, pas une décision : l'écran
-- d'approbation la présente et l'administrateur tranche.
--
-- La lecture de la table des organisations est ouverte à tout compte
-- authentifié, et non plus aux seuls membres actifs : sans cela le formulaire
-- d'inscription ne peut pas proposer la liste dans laquelle il demande de
-- choisir. Ces trois lignes — le nom des partenaires du projet — ne sont pas
-- confidentielles ; elles figurent sur la page de connexion.
-- ============================================================

alter table public.mg2030_access_request
  add column if not exists organisation_id uuid
    references public.mg2030_organisation (id) on delete set null;

comment on column public.mg2030_access_request.organisation_id is
  'Entité déclarée par le demandeur. Indicative : l''administrateur tranche à l''approbation.';

drop policy if exists mg2030_organisation_read on public.mg2030_organisation;

create policy mg2030_organisation_read
  on public.mg2030_organisation
  for select
  using ((select auth.uid()) is not null);
