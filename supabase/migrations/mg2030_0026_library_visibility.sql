-- ============================================================
-- mg2030_0026_library_visibility.sql
--
-- LA BIBLIOTHÈQUE ÉTAIT INUTILISABLE, ET SILENCIEUSEMENT.
--
-- Signalé le 16/09/2026 : « J'ai enregistré un document sur le serveur […]
-- j'ai rechargé la page et je n'avais plus de document visible. » Le dépôt
-- fonctionnait — trois lignes étaient bien en base, aucune archivée. C'est la
-- LECTURE qui refusait.
--
-- Enchaînement exact :
--   1. `registerDocument` applique automatiquement le tag par défaut du
--      dossier (tout dossier en a un, sauf 08 et 09) ;
--   2. `can_read_document` dit : « pas de tag → lisible ; sinon, il faut une
--      ligne dans mg2030_tag_access qui rapproche ce tag de l'utilisateur ou
--      de son rôle » ;
--   3. or `mg2030_tag_access` était VIDE — le seed ne l'a jamais peuplée.
--
-- Résultat : tout document déposé devenait invisible pour tout le monde, à la
-- seule exception des administrateurs plateforme. D'où l'asymétrie observée
-- (je voyais le fichier, son déposant ne le voyait pas).
--
-- Deux corrections, de nature différente.
--
-- ── A. Le déposant lit toujours son propre dépôt ────────────────────────────
-- Règle de bon sens et non de confidentialité : qui envoie un fichier doit
-- pouvoir le retrouver, ne serait-ce que pour corriger ou le supprimer. Sans
-- cela un document mal classé devient irrécupérable par son auteur.
--
-- ── B. Les droits par tag sont posés EXPLICITEMENT ──────────────────────────
-- On aurait pu écrire « un tag sans règle ne restreint personne ». Ce serait
-- un piège : la confidentialité deviendrait invisible dans les données, et
-- personne ne saurait, en regardant la table, qui voit quoi.
--
-- On inscrit donc la situation de départ telle qu'elle est réellement voulue
-- aujourd'hui — l'équipe projet voit l'ensemble de la bibliothèque — sous
-- forme de LIGNES, visibles et modifiables depuis /admin/tags. Le jour où la
-- PIU voudra réserver « procurement » aux seuls PROC, LEGAL, COORD et AFD, il
-- suffira de retirer les autres lignes ; la règle, elle, ne bouge pas.
--
-- ⚠ CE N'EST PAS UNE DÉCISION DE CONFIDENTIALITÉ PRISE À LA PLACE DE LA PIU.
-- C'est l'état de fait rendu explicite. La restriction se pose en enlevant des
-- lignes, ce que l'écran d'administration permet.
-- ============================================================

-- ── A ───────────────────────────────────────────────────────────────────────

create or replace function mg2030_private.can_read_document(p_doc uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- L'administrateur plateforme voit tout : c'est son rôle.
    mg2030_private.is_platform_admin()

    -- Le déposant voit son dépôt, quel qu'en soit le tag.
    or exists (
      select 1
        from public.mg2030_document d
       where d.id = p_doc
         and d.uploaded_by = (select auth.uid())
    )

    -- Document sans tag : rien ne le restreint.
    or not exists (
      select 1 from public.mg2030_document_tag dt where dt.document_id = p_doc
    )

    -- Sinon, il faut un droit sur l'un de ses tags, nominatif ou par rôle.
    or exists (
      select 1
        from public.mg2030_document_tag dt
        join public.mg2030_tag_access ta on ta.tag_id = dt.tag_id
        join public.mg2030_app_user   u  on u.id = (select auth.uid())
       where dt.document_id = p_doc
         and (ta.user_id = u.id or ta.functional_role_id = u.functional_role_id)
    );
$$;

comment on function mg2030_private.can_read_document(uuid) is
  'Lecture d''un document : administrateur, déposant, document sans tag, ou droit sur l''un de ses tags.';

-- ── B ───────────────────────────────────────────────────────────────────────
-- Produit cartésien tag × rôle fonctionnel, en ignorant ce qui existe déjà.
-- Idempotent : rejouer la migration n'ajoute rien.

insert into public.mg2030_tag_access (tag_id, functional_role_id)
select t.id, r.id
  from public.mg2030_tag t
 cross join public.mg2030_functional_role r
 where not exists (
   select 1
     from public.mg2030_tag_access a
    where a.tag_id = t.id
      and a.functional_role_id = r.id
 );
