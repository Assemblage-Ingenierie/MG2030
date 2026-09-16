-- ============================================================
-- mg2030_0027_no_objection_target_optional.sql
--
-- LE RATTACHEMENT D'UN AVIS DEVIENT FACULTATIF.
--
-- `mg2030_no_objection_has_target` exigeait qu'un avis vise au moins un
-- marché, un lot ou une tâche. L'intention était bonne — un avis flottant ne
-- se rattache à rien de suivi — mais elle est fausse dans le cas le plus
-- ordinaire du projet : LE PLAN DE PASSATION LUI-MÊME passe en non-objection,
-- et il n'appartient à aucun marché, par définition, puisqu'il les précède
-- tous. Même chose pour le manuel d'exécution ou un avenant au cadre E&S.
--
-- Demandé le 16/09/2026 : « rend le contrat optionnel ». On retire donc la
-- contrainte plutôt que d'obliger la PIU à inventer un marché fictif pour
-- accrocher un avis qui n'en a pas.
--
-- Ce qu'on NE retire PAS : `answer_coherent`, qui lie une réponse à sa date.
-- Celle-là protège un calcul — le délai d'instruction de l'AFD — et non une
-- convention de saisie.
-- ============================================================

alter table public.mg2030_no_objection
  drop constraint if exists mg2030_no_objection_has_target;
