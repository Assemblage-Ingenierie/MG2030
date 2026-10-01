-- ============================================================
-- 0040_roadmap_orphan_actions — une action survit à son sujet.
--
-- ⚠ SUPPRIMER UN SUJET NE DOIT PAS SUPPRIMER CE QU'IL CONTENAIT.
--
-- `on delete restrict` rendait un sujet indestructible dès qu'il portait une
-- action : un sujet créé par erreur restait à l'écran pour toujours, et le
-- seul contournement — déplacer les actions ailleurs — inventait un classement
-- faux. `on delete cascade` aurait été pire : un clic emportait le travail.
--
-- Une action ORPHELINE est donc un état légitime du modèle. Elle garde son
-- intitulé, sa date, son statut et ses assignataires ; elle perd seulement son
-- rangement, et l'écran la regroupe sous « sans sujet » pour qu'on la reclasse.
-- Demandé le 01/10/2026 : « quand une action n'a plus de sujet il ne faut pas
-- qu'elle disparaisse ».
-- ============================================================

alter table public.mg2030_roadmap_action
  alter column subject_id drop not null;

alter table public.mg2030_roadmap_action
  drop constraint mg2030_roadmap_action_subject_id_fkey;

alter table public.mg2030_roadmap_action
  add constraint mg2030_roadmap_action_subject_id_fkey
  foreign key (subject_id) references public.mg2030_roadmap_subject (id)
  on delete set null;

comment on column public.mg2030_roadmap_action.subject_id is
  'NUL = action orpheline, affichée sous « sans sujet ». Supprimer un sujet '
  'délie ses actions au lieu de les emporter (0040).';
