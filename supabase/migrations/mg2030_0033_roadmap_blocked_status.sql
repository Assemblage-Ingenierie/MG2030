-- ============================================================
-- mg2030_0033_roadmap_blocked_status.sql — un cinquième statut : « bloqué ».
--
-- Demandé le 01/10/2026. Il manquait, et son absence coûtait cher : une action
-- qu'on ne peut pas avancer parce qu'on attend un tiers se saisissait jusqu'ici
-- en « Pending », c'est-à-dire exactement comme une action simplement pas
-- commencée. Or les deux appellent des gestes opposés — l'une se planifie,
-- l'autre se débloque, et seule la seconde demande qu'on appelle quelqu'un.
--
-- Rouge à l'affichage, le seul statut qui le soit : il réclame une action.
--
-- `add value` et non une recréation du type : recréer un enum obligerait à
-- réécrire la colonne et ses contraintes pour ajouter un libellé.
-- ============================================================

alter type mg2030_roadmap_status add value if not exists 'blocked';
