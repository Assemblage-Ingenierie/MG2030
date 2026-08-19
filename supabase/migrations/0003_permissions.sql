-- ============================================================
-- 0003_permissions — vocabulaire des actions et matrice rôle × permission.
--
-- `mg2030_permission` est un vocabulaire TECHNIQUE (créé ici).
-- `mg2030_role_permission` est une DONNÉE : la modifier ne demande aucune
-- migration, c'est un écran d'administration. La matrice par défaut est
-- chargée en 0016 (docs/GAPS.md point 11).
-- ============================================================

create table mg2030_permission (
  code        text primary key,
  entity      text not null,
  action      text not null,
  description text not null
);

create table mg2030_role_permission (
  functional_role_id uuid not null references mg2030_functional_role(id) on delete cascade,
  permission_code    text not null references mg2030_permission(code)    on delete cascade,
  primary key (functional_role_id, permission_code)
);

create index mg2030_role_permission_perm_idx on mg2030_role_permission (permission_code);
