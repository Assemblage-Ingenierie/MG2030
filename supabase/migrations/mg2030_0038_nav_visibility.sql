-- ============================================================
-- 0038_nav_visibility — l'administrateur choisit les onglets visibles.
--
-- Plusieurs modules sont en cours : ils existent dans le menu, s'ouvrent, et
-- montrent un écran à moitié fait. Jusqu'ici le seul moyen de les soustraire
-- aux autres comptes était de les retirer de `lib/nav.ts` — donc une mise en
-- production pour chaque décision d'affichage, et le code comme source d'une
-- information d'exploitation.
--
-- ⚠ CE N'EST PAS UNE PROTECTION DES DONNÉES, et il ne faut pas l'y confondre.
-- Masquer un onglet retire une ENTRÉE DE MENU et refuse l'écran à ceux qui en
-- connaîtraient l'adresse ; les données restent exactement aussi lisibles
-- qu'avant par l'API, puisque c'est la RLS qui en décide et elle seule
-- (brief §8). Pour soustraire une donnée, on change sa politique, pas son
-- onglet.
--
-- L'ABSENCE DE LIGNE VAUT « VISIBLE ». Un onglet ajouté au code apparaît donc
-- sans qu'il faille penser à l'autoriser : l'oubli penche du côté qui se voit,
-- pas du côté qui disparaît en silence.
-- ============================================================

create table if not exists public.mg2030_nav_visibility (
  -- La route, telle que `lib/nav.ts` la déclare : c'est elle que l'on masque,
  -- pas un identifiant de module qu'il faudrait tenir en double.
  href       text primary key,
  is_hidden  boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.mg2030_app_user(id) on delete set null
);

comment on table public.mg2030_nav_visibility is
  'Onglets masqués par l''administrateur. PRÉSENTATION, jamais sécurité : la '
  'RLS reste seule autorité sur les données (brief §8). Pas de ligne = visible.';

drop trigger if exists mg2030_nav_visibility_touch on public.mg2030_nav_visibility;
create trigger mg2030_nav_visibility_touch
  before update on public.mg2030_nav_visibility
  for each row execute function mg2030_private.touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Quatre politiques explicites, jamais `FOR ALL` (garde-fou de 0031).
alter table public.mg2030_nav_visibility enable row level security;

drop policy if exists mg2030_nav_visibility_read   on public.mg2030_nav_visibility;
drop policy if exists mg2030_nav_visibility_insert on public.mg2030_nav_visibility;
drop policy if exists mg2030_nav_visibility_update on public.mg2030_nav_visibility;
drop policy if exists mg2030_nav_visibility_delete on public.mg2030_nav_visibility;

-- Lecture pour TOUS les membres actifs : chaque session doit savoir quels
-- onglets dessiner. Lire la liste des onglets masqués n'apprend rien d'une
-- donnée métier.
create policy mg2030_nav_visibility_read on public.mg2030_nav_visibility
  for select to authenticated
  using (mg2030_private.is_active_user());

create policy mg2030_nav_visibility_insert on public.mg2030_nav_visibility
  for insert to authenticated
  with check (mg2030_private.is_platform_admin());

create policy mg2030_nav_visibility_update on public.mg2030_nav_visibility
  for update to authenticated
  using      (mg2030_private.is_platform_admin())
  with check (mg2030_private.is_platform_admin());

create policy mg2030_nav_visibility_delete on public.mg2030_nav_visibility
  for delete to authenticated
  using (mg2030_private.is_platform_admin());

grant select, insert, update, delete on public.mg2030_nav_visibility to authenticated;
