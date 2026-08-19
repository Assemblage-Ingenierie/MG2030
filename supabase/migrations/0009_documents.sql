-- ============================================================
-- 0009_documents — arborescence, fichiers R2, tags.
--
-- Les TAGS gouvernent la lecture documentaire INDÉPENDAMMENT des trois
-- dimensions de droits (brief §8). Règle multi-tags : UNION — un seul tag
-- autorisé suffit (décision du 19/08/2026, docs/GAPS.md point 33).
-- ============================================================

create table mg2030_tag (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  label      text not null,               -- libellé de référence (anglais)
  label_sq   text,                        -- albanais, à valider par la PIU
  color      text,
  is_system  boolean not null default false,
  created_at timestamptz not null default now()
);

-- Arborescence auto-référencée, modifiable par les administrateurs.
-- 39 lignes au chargement — c'est une PROPOSITION, pas une donnée projet :
-- la colonne `note` de folder_tree.csv vaut « proposition » sur toutes.
create table mg2030_folder (
  id             uuid primary key default gen_random_uuid(),
  parent_id      uuid references mg2030_folder(id) on delete restrict,
  name           text not null,
  -- Chemin matérialisé, maintenu par trigger : évite un CTE récursif à chaque
  -- affichage de l'arborescence.
  path           text not null unique,
  default_tag_id uuid references mg2030_tag(id) on delete set null,
  sort_order     integer not null default 0,
  created_by     uuid references mg2030_app_user(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (parent_id, name),
  constraint mg2030_folder_no_self_parent check (parent_id is null or parent_id <> id)
);
create index mg2030_folder_parent_idx on mg2030_folder (parent_id);

-- Métadonnées. Le fichier vit dans Cloudflare R2 ; l'upload se fait en direct
-- par URL pré-signée, jamais via une fonction serveur (brief §4).
create table mg2030_document (
  id                uuid primary key default gen_random_uuid(),
  folder_id         uuid not null references mg2030_folder(id) on delete restrict,
  r2_object_key     text not null unique,
  r2_thumbnail_key  text,                 -- vignette servie depuis R2, jamais par Vercel
  original_filename text not null,
  size_bytes        bigint not null check (size_bytes >= 0),
  mime_type         text not null,
  description       text,
  uploaded_by       uuid not null references mg2030_app_user(id),
  uploaded_at       timestamptz not null default now(),
  -- Rattachements facultatifs, pour retrouver un document depuis un objet métier.
  contract_id       uuid references mg2030_contract(id) on delete set null,
  lot_id            uuid references mg2030_lot(id)      on delete set null,
  site_id           uuid references mg2030_site(id)     on delete set null,
  task_id           uuid references mg2030_task(id)     on delete set null,
  archived_at       timestamptz
);
create index mg2030_document_folder_idx   on mg2030_document (folder_id);
create index mg2030_document_uploaded_idx on mg2030_document (uploaded_at desc);

create table mg2030_document_tag (
  document_id uuid not null references mg2030_document(id) on delete cascade,
  tag_id      uuid not null references mg2030_tag(id)      on delete cascade,
  primary key (document_id, tag_id)
);
create index mg2030_document_tag_tag_idx on mg2030_document_tag (tag_id);

-- Autorisation de LECTURE par tag, accordée soit à un rôle, soit à un
-- utilisateur nommé — jamais aux deux sur la même ligne.
create table mg2030_tag_access (
  id                 uuid primary key default gen_random_uuid(),
  tag_id             uuid not null references mg2030_tag(id) on delete cascade,
  functional_role_id uuid references mg2030_functional_role(id) on delete cascade,
  user_id            uuid references mg2030_app_user(id)        on delete cascade,
  created_at         timestamptz not null default now(),
  constraint mg2030_tag_access_one_grantee check (
    (functional_role_id is not null) <> (user_id is not null)
  )
);
create unique index mg2030_tag_access_role_uniq on mg2030_tag_access (tag_id, functional_role_id)
  where functional_role_id is not null;
create unique index mg2030_tag_access_user_uniq on mg2030_tag_access (tag_id, user_id)
  where user_id is not null;

comment on table mg2030_tag_access is
  'Un document SANS tag est visible de tous les utilisateurs MG2030 actifs '
  '(brief §7). Document MULTI-TAGS : regle de l''UNION — un seul tag autorise '
  'suffit (decision du 19/08/2026, GAPS 33). Coherent avec le mot '
  '« autorisation », qui decrit un octroi.';
