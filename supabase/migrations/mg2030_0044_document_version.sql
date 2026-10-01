-- ============================================================
-- 0044_document_version — la version d'un document.
--
-- Un livrable circule en « V1.0 », « Rev B », « Final_signed ». La version se
-- lisait donc dans le NOM DU FICHIER, ce qui oblige à la lire caractère par
-- caractère au milieu d'un intitulé de soixante signes, interdit de trier
-- dessus, et se perd dès que quelqu'un renomme proprement. Demandé le
-- 01/10/2026.
--
-- ⚠ TEXTE LIBRE, ET PAS UN COMPTEUR. Les versions d'un projet AFD ne se
-- suivent pas : « V1 », « V1.1 », « V2 draft », « Rev A après NOC ». Imposer un
-- entier obligerait à traduire la convention du projet dans la nôtre, et la
-- traduction serait fausse le jour où un consultant livre un « V2 bis ».
-- La plateforme ne gère PAS un historique de versions — un document remplacé
-- est un nouveau dépôt. Ce champ dit ce qu'on tient en main, rien de plus.
-- ============================================================

alter table public.mg2030_document
  add column if not exists version text;

comment on column public.mg2030_document.version is
  'Version telle que le projet l''écrit : V1.0, Rev B, Final. Texte libre, '
  'jamais un compteur — ce n''est pas un historique de versions.';
