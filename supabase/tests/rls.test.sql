-- ============================================================
-- supabase/tests/rls.test.sql — test des politiques RLS.
--
-- ⚠ TOUT EST ANNULÉ. Le bloc se termine par `raise exception`, ce qui annule la
-- transaction : les utilisateurs fictifs et leurs périmètres ne laissent aucune
-- trace. C'est indispensable ici — la base est PARTAGÉE avec une autre
-- application en production.
--
-- Le message d'erreur EST le rapport de test. Lire son contenu, pas son statut.
--
-- Quatre utilisateurs fictifs, dont un imposé par le projet partagé :
--   [1] un compte RÉEL de l'autre application  → doit lire ZÉRO ligne
--   [2] un compte MG2030 non validé            → doit lire ZÉRO ligne
--   [3] AFD, lecture seule, périmètre global   → lit tout, n'écrit rien
--   [4] Procurement Specialist, global         → écrit selon sa matrice
--   [5] Représentant sur site, périmètre TV-FAIK → ne voit que son site
-- ============================================================

do $$
declare
  rep       text := E'\n';
  echecs    integer := 0;
  u_afd     uuid := '11111111-1111-4111-8111-111111111111';
  u_proc    uuid := '22222222-2222-4222-8222-222222222222';
  u_site    uuid := '33333333-3333-4333-8333-333333333333';
  u_inactif uuid := '44444444-4444-4444-8444-444444444444';
  u_peeb    uuid;
  n integer;
  faik uuid;

  procedure verifie(libelle text, obtenu integer, attendu integer) as $$ begin end; $$;
begin
  -- Un compte réel de l'autre application : c'est le test central du
  -- cloisonnement. auth.users est commun aux deux applications du projet.
  select id into u_peeb from auth.users order by created_at limit 1;
  if u_peeb is null then
    raise exception 'Aucun compte auth existant : le test de cloisonnement ne peut pas etre mene.';
  end if;

  -- ── Mise en place ───────────────────────────────────────────────────────
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (u_afd,    '00000000-0000-0000-0000-000000000000','authenticated','authenticated','afd.reader@test',now(),now()),
    (u_proc,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated','proc.specialist@test',now(),now()),
    (u_site,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated','site.rep@test',now(),now()),
    (u_inactif,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','inactif@test',now(),now());

  insert into mg2030_app_user (id, email, full_name, organisation_id, functional_role_id, is_active)
  select v.id, v.em, v.nom, r.organisation_id, r.id, v.actif
  from (values
    (u_afd,'afd.reader@test','AFD reader','AFD',true),
    (u_proc,'proc.specialist@test','Procurement specialist','PROC',true),
    (u_site,'site.rep@test','Site representative','SITEREP',true),
    (u_inactif,'inactif@test','Compte non valide','CONSTR',false)
  ) as v(id,em,nom,role,actif)
  join mg2030_functional_role r on r.code = v.role;

  select id into faik from mg2030_site where site_code = 'TV-FAIK';
  insert into mg2030_app_user_scope (user_id, kind, site_id) values (u_site,'site',faik);
  insert into mg2030_app_user_scope (user_id, kind)
  values (u_afd,'global'), (u_proc,'global'), (u_inactif,'global');

  -- ── Impersonation : on quitte le rôle propriétaire, la RLS s'applique ───
  set local role authenticated;

  -- [1] CLOISONNEMENT INTER-APPLICATIONS. Le test le plus important du lot :
  --     un compte de l'autre application obtient un JWT valide sur cette base.
  perform set_config('request.jwt.claims', json_build_object('sub',u_peeb,'role','authenticated')::text, true);
  select count(*) into n from mg2030_site;
  rep := rep || format('[1] autre application, sites lus ........... %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;
  select count(*) into n from mg2030_task;
  rep := rep || format('[1] autre application, taches lues ......... %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;
  select count(*) into n from mg2030_task_dependency;
  rep := rep || format('[1] autre application, precedences lues .... %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;
  select count(*) into n from mg2030_document;
  rep := rep || format('[1] autre application, documents lus ....... %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;

  -- [2] Compte MG2030 non validé.
  perform set_config('request.jwt.claims', json_build_object('sub',u_inactif,'role','authenticated')::text, true);
  select count(*) into n from mg2030_site;
  rep := rep || format('[2] compte non valide, sites lus ........... %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;

  -- [3] AFD : lit tout, n'écrit rien. L'organisation prime sur la matrice.
  perform set_config('request.jwt.claims', json_build_object('sub',u_afd,'role','authenticated')::text, true);
  select count(*) into n from mg2030_site;
  rep := rep || format('[3] AFD, sites lus ........................ %s / 14%s', n, E'\n');
  if n <> 14 then echecs := echecs + 1; end if;
  select count(*) into n from mg2030_task;
  rep := rep || format('[3] AFD, taches lues ...................... %s / 27%s', n, E'\n');
  if n <> 27 then echecs := echecs + 1; end if;
  update mg2030_site set name = name where site_code = 'SC';
  get diagnostics n = row_count;
  rep := rep || format('[3] AFD, lignes modifiees ................. %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;
  select count(*) into n from mg2030_change_log;
  rep := rep || format('[3] AFD, historique lu .................... %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;

  -- [4] Procurement Specialist : écrit ce que sa matrice autorise.
  perform set_config('request.jwt.claims', json_build_object('sub',u_proc,'role','authenticated')::text, true);
  update mg2030_contract set name = name where contract_code = 'W-TV';
  get diagnostics n = row_count;
  rep := rep || format('[4] Procurement, marches modifies ......... %s / 1%s', n, E'\n');
  if n <> 1 then echecs := echecs + 1; end if;
  -- PROC porte task.write dans la matrice par defaut : il PEUT modifier une tache.
  update mg2030_task set activity = activity where wbs_code = 'TV.2.1';
  get diagnostics n = row_count;
  rep := rep || format('[4] Procurement, taches modifiees ......... %s / 1%s', n, E'\n');
  if n <> 1 then echecs := echecs + 1; end if;
  -- ... mais PAS d'administrer l'arborescence documentaire (folder.admin absent).
  update mg2030_folder set name = name where path = '02_Procurement';
  get diagnostics n = row_count;
  rep := rep || format('[4] Procurement, dossiers modifies ........ %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;

  -- [5] Représentant sur site : périmètre TV-FAIK.
  perform set_config('request.jwt.claims', json_build_object('sub',u_site,'role','authenticated')::text, true);
  select count(*) into n from mg2030_site;
  rep := rep || format('[5] representant, sites lus ............... %s / 1%s', n, E'\n');
  if n <> 1 then echecs := echecs + 1; end if;
  select count(*) into n from mg2030_site where site_code = 'SC';
  rep := rep || format('[5] representant, Student Center visible ... %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;
  select count(*) into n from mg2030_building;
  rep := rep || format('[5] representant, batiments lus ........... %s / 1%s', n, E'\n');
  if n <> 1 then echecs := echecs + 1; end if;
  -- 27 taches moins les 8 rattachees au marche DB-SC, hors perimetre.
  select count(*) into n from mg2030_task;
  rep := rep || format('[5] representant, taches lues ............. %s / 19%s', n, E'\n');
  if n <> 19 then echecs := echecs + 1; end if;
  -- Une precedence n'est visible que si SES DEUX extremites le sont : sinon on
  -- laisserait fuiter l'existence d'une tache hors perimetre. C'est ce controle
  -- qui a revele le defaut des politiques FOR ALL (19 lues au lieu de 12).
  select count(*) into n from mg2030_task_dependency;
  rep := rep || format('[5] representant, precedences lues ........ %s / 12%s', n, E'\n');
  if n <> 12 then echecs := echecs + 1; end if;

  reset role;

  -- [6] Garde-fou structurel : aucune politique FOR ALL, aucune sans contrôle
  --     d'appartenance.
  select count(*) into n from mg2030_private.check_policy_guardrail();
  rep := rep || format('[6] garde-fou, politiques en defaut ....... %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;

  -- [7] Aucune table mg2030_* sans RLS.
  select count(*) into n from pg_tables t
   where t.schemaname = 'public' and t.tablename like 'mg2030\_%'
     and not exists (select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
                      where ns.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity);
  rep := rep || format('[7] tables sans RLS ....................... %s / 0%s', n, E'\n');
  if n <> 0 then echecs := echecs + 1; end if;

  rep := rep || format('%sVERDICT : %s echec(s) sur 20 controles.', E'\n', echecs);
  raise exception '%', rep;
end;
$$;
