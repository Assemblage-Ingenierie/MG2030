-- ============================================================
-- 0011_cross_cutting — notifications et historique applicatif.
-- ============================================================

-- ── Notifications applicatives ─────────────────────────────────────────────
-- Pas d'e-mail en version 1 : le fournisseur reste à choisir (brief §7).
create table mg2030_notification (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references mg2030_app_user(id) on delete cascade,
  kind         mg2030_notification_kind not null,
  title        text not null,
  body         text,
  entity_table text,
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index mg2030_notification_inbox_idx on mg2030_notification (user_id, created_at desc)
  where read_at is null;

comment on table mg2030_notification is
  'Les notifications d''EVENEMENT (depot de document, plainte enregistree) sont '
  'produites par trigger. Celles d''ETAT (franchissement de jalon, retard) '
  'supposent une evaluation periodique : sans pg_cron ni Edge Functions '
  '(brief §4), une route Next appelee par Vercel Cron s''en charge (GAPS 35).';

-- ── Historique applicatif ──────────────────────────────────────────────────
-- SIMPLE et sans prétention probante : pas de chaîne de preuve, pas de journal
-- immuable (brief §2). Une ligne par CHAMP modifié, comme demandé au brief §7.
create table mg2030_change_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     uuid not null,
  field      text not null,
  old_value  text,
  new_value  text,
  operation  char(1) not null check (operation in ('I','U','D')),
  changed_by uuid references mg2030_app_user(id),
  changed_at timestamptz not null default now()
);
create index mg2030_change_log_row_idx  on mg2030_change_log (table_name, row_id, changed_at desc);
create index mg2030_change_log_user_idx  on mg2030_change_log (changed_by, changed_at desc);

comment on table mg2030_change_log is
  'Historique applicatif simple. Modifiable par un administrateur base : AUCUNE '
  'valeur probante, et le document le dit (brief §2).';
