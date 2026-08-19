// ============================================================
// scripts/seed/build-seed.mjs — génère le SQL de chargement depuis seed/*.csv.
//
// Sortie : supabase/seed/seed.sql, idempotent (truncate puis insert).
//
// FORME DU SQL — `insert … select … from (values …) join` plutôt qu'une
// sous-requête par ligne : la résolution des codes fonctionnels vers les UUID
// se fait par JOINTURE, une fois par table. Le fichier est trois fois plus
// court, et une jointure manquante devient une ligne perdue visible au
// contrôle, là où une sous-requête muette aurait inséré NULL.
//
// RÈGLES, toutes traçables au brief ou aux README du seed :
//   • Aucune donnée inventée. Un champ vide reste `null` (brief §11.6).
//   • `afd_review` est normalisé en minuscules (« PRIOR » → 'prior').
//   • Les 13 lignes de lot_buildings.csv SANS lot_code ne sont PAS chargées :
//     une affectation inconnue est une ABSENCE de relation (GAPS 3).
//   • `TV.2.1` et `SC.2.2` sont chargées à 20 jours, pas 21 (décision GAPS 12).
//   • excluded_rows.csv n'est jamais chargé : c'est une preuve, pas une donnée.
//
// Usage : node scripts/seed/build-seed.mjs
// ============================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { readCsv, num, int, sql } from "./parse-csv.mjs";

const ROOT = process.cwd();
const SEED = join(ROOT, "seed");
const OUT_DIR = join(ROOT, "supabase", "seed");

const chunks = [];
const add = (title, body) =>
  chunks.push(`-- ── ${title} ${"─".repeat(Math.max(2, 58 - title.length))}\n${body}`);

/** Table de valeurs littérales, une ligne par enregistrement. */
const values = (rows, cols) =>
  rows.map((r) => `(${cols.map((c) => sql(typeof c === "function" ? c(r) : r[c])).join(",")})`).join(",\n  ");

// ============================================================
// CORRECTION GAPS 12 — la seule modification apportée aux données du seed.
//
// `TV.2.1` (EOI) et `SC.2.2` (Initial Selection) portent duration_days = 21
// dans tasks.csv, mais couvrent 2026-09-01 → 2026-09-21, soit 20 jours. Les 19
// autres tâches datées respectent end = start + duration_days.
//
// Retenir 21 ferait glisser toute la chaîne des training venues d'un jour au
// premier recalcul : la publication de l'avis travaux passerait du 05/08/2027
// au 06/08/2027, rompant la concordance au jour près avec le plan de passation.
//
// Décision du 19/08/2026 : 20 jours. Seule valeur qui préserve les dates aval.
// ============================================================
const DURATION_FIX = new Map([
  ["TV.2.1", 20],
  ["SC.2.2", 20],
]);

const counts = {};

// ── Organisations ───────────────────────────────────────────────────────────
// Déduites de la colonne `organisation` de piu_roles.csv. PIU et TA
// contribuent, l'AFD est en lecture seule sur tout (brief §3).
counts.organisations = 3;
add(
  "Organisations",
  `insert into mg2030_organisation (code, name, access_mode) values
  ('PIU','Project Implementation Unit (MYS)','contributor'),
  ('TA','Technical Assistance','contributor'),
  ('AFD','Agence Francaise de Developpement','read_only');`,
);

// ── Rôles fonctionnels ──────────────────────────────────────────────────────
const roles = readCsv(join(SEED, "piu_roles.csv"));
counts.roles = roles.length;
add(
  `Roles fonctionnels (${roles.length})`,
  `insert into mg2030_functional_role
  (code, title, organisation_id, time_type, posts, level_of_effort, is_platform_admin, source)
select v.code, v.title, o.id, v.time_type, v.posts, v.loe, v.code = 'ADMIN', v.source
from (values
  ${values(roles, [
    "role_code",
    "title",
    "organisation",
    "time_type",
    (r) => int(r.posts) ?? 1,
    "level_of_effort",
    "source",
  ])}
) as v(code, title, org, time_type, posts, loe, source)
join mg2030_organisation o on o.code = v.org;`,
);

// ── Organigramme ────────────────────────────────────────────────────────────
// Un nœud par poste. COORD reporte à « MYS hierarchical superior (to be
// specified) » : hors périmètre applicatif, conservé en texte plutôt qu'en FK
// orpheline. Le rattachement se fait après coup, le parent devant exister.
const roleCodes = new Set(roles.map((r) => r.role_code));
counts.orgUnits = roles.length;
add(
  `Organigramme (${roles.length} noeuds)`,
  `insert into mg2030_org_unit (code, functional_role_id, supervises_note, reports_to_external, sort_order)
select v.code, r.id, v.supervises, v.external, v.ord
from (values
  ${values(
    roles.map((r, i) => ({ ...r, i })),
    [
      "role_code",
      "supervises",
      (r) => (r.reports_to && !roleCodes.has(r.reports_to) ? r.reports_to : null),
      (r) => r.i,
    ],
  )}
) as v(code, supervises, external, ord)
join mg2030_functional_role r on r.code = v.code;

update mg2030_org_unit u set parent_id = p.id
from (values
  ${values(
    roles.filter((r) => r.reports_to && roleCodes.has(r.reports_to)),
    ["role_code", "reports_to"],
  )}
) as v(child, parent)
join mg2030_org_unit p on p.code = v.parent
where u.code = v.child;`,
);

// ── Scénarios et plans ──────────────────────────────────────────────────────
// La marge terminale vient des jalons MS.1 / MS.2 de tasks.csv : 4 mois à
// partir du 01/09/2029, fin des travaux au 01/01/2030.
counts.scenarios = 3;
counts.plans = 2;
add(
  "Scenarios et plans",
  `insert into mg2030_schedule_scenario
  (code, name, description, exclusive_group, is_active, buffer_start_date, buffer_months, deadline_date, is_schedulable)
values
  ('base','Base','Marches communs aux deux voies.',null,true,'2029-09-01',4,'2030-01-01',true),
  ('design_bid_build','Design-Bid-Build','Voie de droit commun : conception detaillee puis appel d''offres travaux. AUCUN planning exploitable dans le fichier source (GAPS 9) : charge SANS taches.','sc_route',false,'2029-09-01',4,'2030-01-01',false),
  ('design_build','Design & Build','Conception-realisation du Student Center. Autorise par les lignes directrices AFD mais interdit par la loi kosovare sur les marches publics, la derogation reposant sur l''article 3 de la loi de base.','sc_route',true,'2029-09-01',4,'2030-01-01',true);

insert into mg2030_plan (plan_code, name, scenario_id, source_sheet)
select v.code, v.name, s.id, v.sheet
from (values
  ('TV','Training venues','base','TV'),
  ('SC-DB','Student Center - Design & Build','design_build','SC')
) as v(code, name, scenario, sheet)
join mg2030_schedule_scenario s on s.code = v.scenario;`,
);

// ── Sites ───────────────────────────────────────────────────────────────────
const sites = readCsv(join(SEED, "sites.csv"));
counts.sites = sites.length;
add(
  `Sites (${sites.length})`,
  `-- address / latitude / longitude sont VIDES sur les 14 lignes : donnee
-- reellement absente des documents sources (GAPS 1 et 2).
insert into mg2030_site
  (site_code, subproject, name, beneficiary_institution, site_type, address,
   latitude, longitude, gross_area_sqm, year_of_construction, occupancy_status, source)
values
  ${values(sites, [
    "site_code",
    "subproject",
    "name",
    "beneficiary_institution",
    "site_type",
    "address",
    (r) => num(r.latitude),
    (r) => num(r.longitude),
    (r) => num(r.gross_area_sqm),
    (r) => int(r.year_of_construction),
    "occupancy_status",
    "source",
  ])};`,
);

// ── Bâtiments ───────────────────────────────────────────────────────────────
const buildings = readCsv(join(SEED, "buildings.csv"));
counts.buildings = buildings.length;
add(
  `Batiments (${buildings.length})`,
  `-- zone est NULL sur les 13 salles de training venues : la zone ne concerne que
-- le Student Center. year_of_construction est NULL sur 5 dortoirs (GAPS 16).
insert into mg2030_building
  (building_code, site_id, name, zone, typology, intervention_type, net_area_sqm,
   gross_area_sqm, unit_cost_eur_sqm, works_estimate_eur, year_of_construction,
   construction_type, source)
select v.code, s.id, v.name, v.zone::mg2030_building_zone, v.typology,
       v.intervention::mg2030_intervention_type, v.net, v.gross, v.unit_cost,
       v.estimate, v.year, v.construction, v.source
from (values
  ${values(buildings, [
    "building_code",
    "site_code",
    "name",
    "zone",
    "typology",
    "intervention_type",
    (r) => num(r.net_area_sqm),
    (r) => num(r.gross_area_sqm),
    (r) => num(r.unit_cost_eur_sqm),
    (r) => num(r.works_estimate_eur),
    (r) => int(r.year_of_construction),
    "construction_type",
    "source",
  ])}
) as v(code, site, name, zone, typology, intervention, net, gross, unit_cost, estimate, year, construction, source)
join mg2030_site s on s.site_code = v.site;`,
);

// ── Marchés ─────────────────────────────────────────────────────────────────
const contracts = readCsv(join(SEED, "contracts.csv"));
counts.contracts = contracts.length;
add(
  `Marches (${contracts.length})`,
  `-- afd_review passe en minuscules (« PRIOR » -> 'prior'). contract_number n'est
-- PAS unique : le suffixe XX n'est pas attribue (GAPS 19).
insert into mg2030_contract
  (contract_code, contract_number, name, contract_type, competition_type, procedure,
   selection_method, afd_review, scenario_id, estimated_amount_eur,
   spn_publication_date, bid_opening_date, signature_date, completion_date, source)
select v.code, v.number, v.name, v.ctype::mg2030_contract_type,
       v.competition::mg2030_competition_type, v.procedure::mg2030_procedure,
       v.selection::mg2030_selection_method, v.review::mg2030_afd_review, s.id,
       v.amount, v.spn, v.opening, v.signature, v.completion, v.source
from (values
  ${values(contracts, [
    "contract_code",
    "contract_number",
    "name",
    "contract_type",
    "competition_type",
    "procedure",
    "selection_method",
    (r) => r.afd_review.toLowerCase(),
    "scenario",
    (r) => num(r.estimated_amount_eur),
    "spn_publication_date",
    "bid_opening_date",
    "signature_date",
    "completion_date",
    "source",
  ])}
) as v(code, number, name, ctype, competition, procedure, selection, review, scenario, amount, spn, opening, signature, completion, source)
join mg2030_schedule_scenario s on s.code = v.scenario;`,
);

// ── Lots ────────────────────────────────────────────────────────────────────
const lots = readCsv(join(SEED, "lots.csv"));
counts.lots = lots.length;
add(
  `Lots (${lots.length})`,
  `-- Le brief dit « montant » au singulier ; le seed porte une FOURCHETTE. Les
-- deux bornes sont conservees (GAPS 34).
insert into mg2030_lot
  (lot_code, contract_id, lot_number, name, amount_eur_min, amount_eur_max,
   min_turnover_eur_min, min_turnover_eur_max, contractor, source)
select v.code, c.id, v.num, v.name, v.amin, v.amax, v.tmin, v.tmax, v.contractor, v.source
from (values
  ${values(lots, [
    "lot_code",
    "contract_code",
    (r) => int(r.lot_number),
    "name",
    (r) => num(r.amount_eur_min),
    (r) => num(r.amount_eur_max),
    (r) => num(r.min_turnover_eur_min),
    (r) => num(r.min_turnover_eur_max),
    "contractor",
    "source",
  ])}
) as v(code, contract, num, name, amin, amax, tmin, tmax, contractor, source)
join mg2030_contract c on c.contract_code = v.contract;`,
);

// ── Affectation lot ↔ bâtiment ─────────────────────────────────────────────
const lotBuildingsAll = readCsv(join(SEED, "lot_buildings.csv"));
const lotBuildings = lotBuildingsAll.filter((r) => r.lot_code !== null);
const unassigned = lotBuildingsAll.length - lotBuildings.length;
counts.lotBuildings = lotBuildings.length;
add(
  `Affectation lot/batiment (${lotBuildings.length} sur ${lotBuildingsAll.length})`,
  `-- Les ${unassigned} lignes SANS lot_code (les ${unassigned} salles de training venues) ne sont PAS
-- chargees : leur affectation n'est pas arretee (GAPS 3), et une affectation
-- inconnue est une ABSENCE de relation, pas une relation a lot nul.
-- Les 23 batiments du Student Center apparaissent deux fois : une fois sur les
-- lots W-SC-* (voie classique), une fois sur les lots DB-SC-*. 23 x 2 = 46.
insert into mg2030_lot_building (lot_id, building_id, source)
select l.id, b.id, v.source
from (values
  ${values(lotBuildings, ["lot_code", "building_code", "source"])}
) as v(lot, building, source)
join mg2030_lot l on l.lot_code = v.lot
join mg2030_building b on b.building_code = v.building;`,
);

// ── Tâches ──────────────────────────────────────────────────────────────────
const tasks = readCsv(join(SEED, "tasks.csv"));
const fixed = [];
const taskRows = tasks.map((t, i) => {
  let days = int(t.duration_days);
  if (DURATION_FIX.has(t.wbs_code)) {
    fixed.push(`${t.wbs_code} ${days}j -> ${DURATION_FIX.get(t.wbs_code)}j`);
    days = DURATION_FIX.get(t.wbs_code);
  }
  return { ...t, days, ord: i };
});
counts.tasks = taskRows.length;
add(
  `Taches (${taskRows.length})`,
  `-- Correction GAPS 12 appliquee : ${fixed.join(", ")}.
-- Le rattachement parent/enfant se fait apres coup : l'ordre du CSV ne garantit
-- pas que le parent precede l'enfant.
insert into mg2030_task
  (wbs_code, plan_id, scenario_id, task_type, group_label, activity, duration_days,
   start_date, end_date, contract_id, source_sheet, source_row, sort_order)
select v.wbs, p.id, s.id, v.ttype::mg2030_task_type, v.grp, v.activity, v.days,
       v.start::date, v.finish::date, c.id, v.sheet, v.row, v.ord
from (values
  ${values(taskRows, [
    "wbs_code",
    "plan_code",
    "scenario",
    "task_type",
    "group",
    "activity",
    "days",
    "start_date",
    "end_date",
    "contract_code",
    "source_sheet",
    "source_row",
    "ord",
  ])}
) as v(wbs, plan, scenario, ttype, grp, activity, days, start, finish, contract, sheet, row, ord)
join mg2030_plan p on p.plan_code = v.plan
join mg2030_schedule_scenario s on s.code = v.scenario
left join mg2030_contract c on c.contract_code = v.contract;

update mg2030_task c set parent_id = p.id
from (values
  ${values(
    taskRows.filter((t) => t.parent_wbs),
    ["wbs_code", "parent_wbs"],
  )}
) as v(child, parent)
join mg2030_task p on p.wbs_code = v.parent
where c.wbs_code = v.child and c.plan_id = p.plan_id;`,
);

// ── Précédences ─────────────────────────────────────────────────────────────
const deps = readCsv(join(SEED, "task_dependencies.csv"));
counts.dependencies = deps.length;
add(
  `Precedences (${deps.length})`,
  `-- Deux taches ont DEUX predecesseurs (TV.2.4 et SC.2.5, formules MAX) : le
-- moteur doit gerer les convergences, pas seulement les chaines lineaires.
insert into mg2030_task_dependency (predecessor_id, successor_id, dependency_type, lag_days, source_formula)
select p.id, s.id, v.dtype::mg2030_dependency_type, v.lag, v.formula
from (values
  ${values(deps, [
    "predecessor_wbs",
    "successor_wbs",
    "dependency_type",
    (r) => int(r.lag_days),
    "source_formula",
  ])}
) as v(pred, succ, dtype, lag, formula)
join mg2030_task p on p.wbs_code = v.pred
join mg2030_task s on s.wbs_code = v.succ;`,
);

// ── Contraintes de date ─────────────────────────────────────────────────────
const constraints = readCsv(join(SEED, "task_constraints.csv"));
counts.constraints = constraints.length;
add(
  `Contraintes de date (${constraints.length})`,
  `-- Les 4 dates saisies en dur du fichier Excel, sans predecesseur.
insert into mg2030_task_constraint (task_id, kind, constraint_date, source)
select t.id, v.kind::mg2030_constraint_kind, v.cdate::date, v.source
from (values
  ${values(constraints, ["wbs_code", "constraint_type", "constraint_date", "source"])}
) as v(wbs, kind, cdate, source)
join mg2030_task t on t.wbs_code = v.wbs;`,
);

// ── Tags ────────────────────────────────────────────────────────────────────
counts.tags = 4;
add(
  "Tags (4)",
  `-- Les 4 tags initiaux imposes au brief §7.
insert into mg2030_tag (code, label, color, is_system) values
  ('procurement','Procurement','#034ea2',true),
  ('technical_documentation','Technical documentation','#d0a650',true),
  ('piu_admin','PIU administration','#646b78',true),
  ('environmental_social','Environmental and social','#38761d',true);`,
);

// ── Arborescence documentaire ───────────────────────────────────────────────
const folders = readCsv(join(SEED, "folder_tree.csv"));
counts.folders = folders.length;
const roots = folders.filter((f) => !f.parent_path);
const children = folders.filter((f) => f.parent_path);
add(
  `Arborescence documentaire (${folders.length})`,
  `-- PROPOSITION, pas une donnee projet : la colonne \`note\` vaut « proposition »
-- sur les ${folders.length} lignes. Les administrateurs peuvent tout reorganiser.
-- Deux passes : racines puis enfants, le parent devant exister. Le chemin
-- materialise est recalcule par le trigger mg2030_folder_set_path.
insert into mg2030_folder (parent_id, name, path, default_tag_id)
select null, v.name, v.name, t.id
from (values
  ${values(roots, ["path", "default_tag"])}
) as v(name, tag)
left join mg2030_tag t on t.code = v.tag;

insert into mg2030_folder (parent_id, name, path, default_tag_id)
select p.id, v.name, v.path, t.id
from (values
  ${values(children, [
    "path",
    (r) => r.path.split("/").pop(),
    "parent_path",
    "default_tag",
  ])}
) as v(path, name, parent, tag)
join mg2030_folder p on p.path = v.parent
left join mg2030_tag t on t.code = v.tag;`,
);

// ── Assemblage ──────────────────────────────────────────────────────────────
const header = `-- ============================================================
-- supabase/seed/seed.sql — GENERE par scripts/seed/build-seed.mjs.
-- NE PAS MODIFIER A LA MAIN : editez les CSV de seed/ puis regenerez.
--
-- Source unique : les fichiers de seed/. Aucune donnee n'est extraite des PDF
-- de docs/source/, qui ne servent que de contexte (seed/README_SEED.md).
--
-- Une seule modification est appliquee aux donnees : la correction GAPS 12
-- (duree de TV.2.1 et SC.2.2 portee de 21 a 20 jours), documentee sur place.
--
-- excluded_rows.csv n'est PAS charge : c'est la preuve que rien n'a ete omis
-- par erreur, pas une donnee.
-- ============================================================

begin;

-- Rechargement complet. L'ordre inverse les dependances de cles etrangeres.
truncate table
  mg2030_task_constraint, mg2030_task_dependency, mg2030_task,
  mg2030_lot_building, mg2030_lot, mg2030_contract,
  mg2030_building, mg2030_site,
  mg2030_plan, mg2030_schedule_scenario,
  mg2030_document_tag, mg2030_folder, mg2030_tag,
  mg2030_org_unit, mg2030_functional_role, mg2030_organisation
  restart identity cascade;
`;

mkdirSync(OUT_DIR, { recursive: true });
// L'historique est vidé EN DERNIER, après les inserts : le chargement initial
// n'est pas une modification. Le laisser noierait la première écriture réelle
// sous ~2 000 lignes, et rendrait l'écran d'historique inutile dès le premier
// jour.
const footer = `-- ── Historique ─────────────────────────────────────────────
truncate table mg2030_change_log restart identity;`;

const out = `${header}\n${chunks.join("\n\n")}\n\n${footer}\n\ncommit;\n`;
writeFileSync(join(OUT_DIR, "seed.sql"), out, "utf8");

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`supabase/seed/seed.sql — ${(out.length / 1024).toFixed(1)} ko, ${total} lignes de donnees\n`);
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k.padEnd(16, ".")} ${String(v).padStart(4)}`);
}
console.log(`\n  lot_building : ${unassigned} lignes non chargees (salles non affectees, GAPS 3)`);
console.log(`  correction GAPS 12 : ${fixed.join(", ")}`);
