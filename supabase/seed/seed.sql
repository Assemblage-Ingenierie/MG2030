-- ============================================================
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

-- ── Organisations ─────────────────────────────────────────────
insert into mg2030_organisation (code, name, access_mode) values
  ('PIU','Project Implementation Unit (MYS)','contributor'),
  ('TA','Technical Assistance','contributor'),
  ('AFD','Agence Francaise de Developpement','read_only');

-- ── Roles fonctionnels (14) ───────────────────────────────────
insert into mg2030_functional_role
  (code, title, organisation_id, time_type, posts, level_of_effort, is_platform_admin, source)
select v.code, v.title, o.id, v.time_type, v.posts, v.loe, v.code = 'ADMIN', v.source
from (values
  ('COORD','Project Coordinator','PIU','full_time',1,null,'JD 3.1'),
  ('CONSTR','Construction Specialist (with energy efficiency expertise)','PIU','full_time',1,null,'JD 3.2'),
  ('CONSTR-DEP','Deputy to the Construction Specialist','PIU','full_time',1,null,'JD 3.3'),
  ('PROC','Procurement Specialist','PIU','full_time',1,null,'JD 3.4'),
  ('ADMFIN','Administrative and Financial Specialist','PIU','full_time',1,null,'JD 3.5'),
  ('ACCT','Accountant','PIU','full_time',1,null,'JD 3.6'),
  ('MRE','Monitoring, Reporting and Evaluation Specialist','PIU','full_time_or_part_time',1,null,'JD 3.7'),
  ('ESHS','Environmental, Social, Health and Safety Specialist','PIU','full_time',1,null,'JD 3.8'),
  ('LEGAL','Legal Specialist','PIU','part_time',1,null,'JD 3.9'),
  ('COMM','Communication Specialist','PIU','part_time',1,'5 days per month','JD 3.10'),
  ('SITEREP','On-site Project Owner Representative','PIU','part_time',14,null,'JD 3.11'),
  ('ADMIN','Platform administrator','PIU',null,1,null,'hors documents projet'),
  ('TA','Technical Assistance expert','TA',null,3,null,'BPR 7.3.3'),
  ('AFD','AFD task team member','AFD',null,5,null,'hypothese utilisateur')
) as v(code, title, org, time_type, posts, loe, source)
join mg2030_organisation o on o.code = v.org;

-- ── Organigramme (14 noeuds) ──────────────────────────────────
insert into mg2030_org_unit (code, functional_role_id, supervises_note, reports_to_external, sort_order)
select v.code, r.id, v.supervises, v.external, v.ord
from (values
  ('COORD','All PIU members','MYS hierarchical superior (to be specified)',0),
  ('CONSTR',null,null,1),
  ('CONSTR-DEP',null,null,2),
  ('PROC',null,null,3),
  ('ADMFIN',null,null,4),
  ('ACCT',null,null,5),
  ('MRE',null,null,6),
  ('ESHS',null,null,7),
  ('LEGAL',null,null,8),
  ('COMM',null,null,9),
  ('SITEREP',null,null,10),
  ('ADMIN',null,null,11),
  ('TA',null,null,12),
  ('AFD',null,null,13)
) as v(code, supervises, external, ord)
join mg2030_functional_role r on r.code = v.code;

update mg2030_org_unit u set parent_id = p.id
from (values
  ('CONSTR','COORD'),
  ('CONSTR-DEP','CONSTR'),
  ('PROC','COORD'),
  ('ADMFIN','COORD'),
  ('ACCT','ADMFIN'),
  ('MRE','COORD'),
  ('ESHS','COORD'),
  ('LEGAL','COORD'),
  ('COMM','COORD'),
  ('SITEREP','COORD'),
  ('ADMIN','COORD')
) as v(child, parent)
join mg2030_org_unit p on p.code = v.parent
where u.code = v.child;

-- ── Scenarios et plans ────────────────────────────────────────
insert into mg2030_schedule_scenario
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
join mg2030_schedule_scenario s on s.code = v.scenario;

-- ── Sites (14) ────────────────────────────────────────────────
-- address / latitude / longitude sont VIDES sur les 14 lignes : donnee
-- reellement absente des documents sources (GAPS 1 et 2).
insert into mg2030_site
  (site_code, subproject, name, beneficiary_institution, site_type, address,
   latitude, longitude, gross_area_sqm, year_of_construction, occupancy_status, source)
values
  ('SC','athletes_village','Student Center of the University of Pristina','University of Pristina / Student Center','student_campus',null,null,null,null,null,'occupied_year_round','BPR 2.2 / 5.2.1'),
  ('TV-FEFS','training_venues','FEFS sports hall','University of Pristina - FEFS','university_sports_hall',null,null,null,1066,1975,'occupied_academic_year','BPR 5.3.1'),
  ('TV-FAIK','training_venues','Faik Konica physical education hall','Faik Konica school','school_sports_hall',null,null,null,592,2010,'occupied_academic_year','BPR 5.3.1'),
  ('TV-NAZI','training_venues','Nazim Gafurri physical education hall','Nazim Gafurri school','school_sports_hall',null,null,null,574,2013,'occupied_academic_year','BPR 5.3.1'),
  ('TV-EMIN','training_venues','Emin Duraku physical education hall','Emin Duraku school','school_sports_hall',null,null,null,554,2014,'occupied_academic_year','BPR 5.3.1'),
  ('TV-XHEM','training_venues','Xhemail Mustafa physical education hall','Xhemail Mustafa school','school_sports_hall',null,null,null,617,2005,'occupied_academic_year','BPR 5.3.1'),
  ('TV-PAVA','training_venues','Pavaresia physical education hall','Pavaresia school','school_sports_hall',null,null,null,534,2013,'occupied_academic_year','BPR 5.3.1'),
  ('TV-ELEN','training_venues','Elena Gjika physical education hall','Elena Gjika school','school_sports_hall',null,null,null,379,1980,'occupied_academic_year','BPR 5.3.1'),
  ('TV-HASA','training_venues','Hasan Prishtina physical education hall','Hasan Prishtina school','school_sports_hall',null,null,null,710,1974,'occupied_academic_year','BPR 5.3.1'),
  ('TV-ILIR','training_venues','Iliria physical education hall','Iliria school','school_sports_hall',null,null,null,514,1986,'occupied_academic_year','BPR 5.3.1'),
  ('TV-ISMA','training_venues','Ismail Qemali physical education hall','Ismail Qemali school','school_sports_hall',null,null,null,692,1981,'occupied_academic_year','BPR 5.3.1'),
  ('TV-GJEL','training_venues','Shkolla e gjelber physical education hall','Shkolla e gjelber','school_sports_hall',null,null,null,492,2011,'occupied_academic_year','BPR 5.3.1'),
  ('TV-QAMI','training_venues','Qamil Batalli physical education hall','Qamil Batalli school','school_sports_hall',null,null,null,650,2016,'occupied_academic_year','BPR 5.3.1'),
  ('TV-DONB','training_venues','Don Bosko physical education hall','Don Bosko school','school_sports_hall',null,null,null,1180,2015,'occupied_academic_year','BPR 5.3.1');

-- ── Batiments (36) ────────────────────────────────────────────
-- zone est NULL sur les 13 salles de training venues : la zone ne concerne que
-- le Student Center. year_of_construction est NULL sur 5 dortoirs (GAPS 16).
insert into mg2030_building
  (building_code, site_id, name, zone, typology, intervention_type, net_area_sqm,
   gross_area_sqm, unit_cost_eur_sqm, works_estimate_eur, year_of_construction,
   construction_type, source)
select v.code, s.id, v.name, v.zone::mg2030_building_zone, v.typology,
       v.intervention::mg2030_intervention_type, v.net, v.gross, v.unit_cost,
       v.estimate, v.year, v.construction, v.source
from (values
  ('SC-KON1','SC','Konvikti 1 (Dormitory 1)','residential','dormitory','renovation',4385,null,369,1618721,1965,'TYPE 1 (unique)','BPR 5.2.2 / 7.7'),
  ('SC-KON2','SC','Konvikti 2 (Dormitory 2)','residential','dormitory','renovation',2855,null,406,1159058,1971,'TYPE 2','BPR 5.2.2 / 7.7'),
  ('SC-KON3','SC','Konvikti 3 (Dormitory 3)','residential','dormitory','renovation',3647,null,414,1510265,null,'TYPE 2','BPR 5.2.2 / 7.7'),
  ('SC-KON4','SC','Konvikti 4 (Dormitory 4)','residential','dormitory','renovation',2888,null,405,1169081,null,'TYPE 2','BPR 5.2.2 / 7.7'),
  ('SC-KON5','SC','Konvikti 5 (Dormitory 5)','residential','dormitory','renovation',5777,null,406,2348352,1980,'TYPE 3 (unique)','BPR 5.2.2 / 7.7'),
  ('SC-KON6','SC','Konvikti 6 (Dormitory 6)','residential','dormitory','renovation',3519,null,372,1309426,null,'TYPE 4','BPR 5.2.2 / 7.7'),
  ('SC-KON7','SC','Konvikti 7 (Dormitory 7)','residential','dormitory','renovation',3407,null,375,1278055,null,'TYPE 4','BPR 5.2.2 / 7.7'),
  ('SC-KON8','SC','Konvikti 8 (Dormitory 8)','residential','dormitory','renovation',3085,null,359,1107836,null,'TYPE 4','BPR 5.2.2 / 7.7'),
  ('SC-REST','SC','Restaurant and kitchen','services_and_sports','restaurant','renovation',1417,2500,785,1112483,1974,null,'BPR 5.2.2 / 7.7'),
  ('SC-TETO','SC','Tetori sports hall','services_and_sports','sports_hall','renovation',1987,3934,875,1738079,1975,null,'BPR 5.2.2 / 7.7'),
  ('SC-ADMO','SC','Administration building (existing)','services_and_sports','administration','demolition',null,null,null,null,null,null,'BPR 5.2.2'),
  ('SC-HEAO','SC','Health center (existing)','services_and_sports','health_centre','demolition',null,null,null,null,null,null,'BPR 5.2.2'),
  ('SC-AMPH','SC','Amphitheatre (existing)','services_and_sports','amphitheatre','demolition',null,null,null,null,null,null,'BPR 5.2.2'),
  ('SC-ND01','SC','New Dormitory 01','residential','dormitory','new_construction',5417,null,950,5146150,null,null,'BPR 5.2.2 / 7.7'),
  ('SC-ND02','SC','New Dormitory 02','residential','dormitory','new_construction',4532,null,950,4305400,null,null,'BPR 5.2.2 / 7.7'),
  ('SC-ND03','SC','New Dormitory 03','residential','dormitory','new_construction',8324,null,950,7907800,null,null,'BPR 5.2.2 / 7.7'),
  ('SC-ADMN','SC','Administration (new)','services_and_sports','administration','new_construction',410,null,950,389500,null,null,'BPR 7.7'),
  ('SC-HEAN','SC','Health Center (new)','services_and_sports','health_centre','new_construction',955,null,1150,1098250,null,null,'BPR 7.7'),
  ('SC-POOL','SC','Semi-Olympic swimming pool','services_and_sports','swimming_pool','new_construction',1300,null,2000,2600000,null,null,'BPR 7.7'),
  ('SC-MPHA','SC','Multi Purpose Hall','services_and_sports','multi_purpose_hall','new_construction',450,null,950,427500,null,null,'BPR 7.7'),
  ('SC-CAFE','SC','Cafeteria','services_and_sports','cafeteria','new_construction',160,null,950,152000,null,null,'BPR 7.7'),
  ('SC-LIBR','SC','Library and studying area','services_and_sports','library','new_construction',315,null,950,299250,null,null,'BPR 7.7'),
  ('SC-COMM','SC','Commercial areas and conference rooms','services_and_sports','commercial','new_construction',570,null,950,541500,null,null,'BPR 7.7'),
  ('TV-FEFS-H','TV-FEFS','FEFS sports hall',null,'sports_hall','renovation',870,1066,433,376840,1975,null,'BPR 5.3.1 / 7.7'),
  ('TV-ELEN-H','TV-ELEN','Elena Gjika hall',null,'sports_hall','renovation',379,379,581,220261,1980,null,'BPR 5.3.1 / 7.7'),
  ('TV-EMIN-H','TV-EMIN','Emin Duraku hall',null,'sports_hall','renovation',554,554,471,261144,2014,null,'BPR 5.3.1 / 7.7'),
  ('TV-FAIK-H','TV-FAIK','Faik Konica hall',null,'sports_hall','renovation',592,592,433,256043,2010,null,'BPR 5.3.1 / 7.7'),
  ('TV-HASA-H','TV-HASA','Hasan Prishtina hall',null,'sports_hall','renovation',710,710,480,340697,1974,null,'BPR 5.3.1 / 7.7'),
  ('TV-ILIR-H','TV-ILIR','Iliria hall',null,'sports_hall','renovation',514,514,514,264097,1986,null,'BPR 5.3.1 / 7.7'),
  ('TV-ISMA-H','TV-ISMA','Ismail Qemali hall',null,'sports_hall','renovation',692,692,548,378924,1981,null,'BPR 5.3.1 / 7.7'),
  ('TV-NAZI-H','TV-NAZI','Nazim Gafurri hall',null,'sports_hall','renovation',574,574,499,286327,2013,null,'BPR 5.3.1 / 7.7'),
  ('TV-PAVA-H','TV-PAVA','Pavaresia hall',null,'sports_hall','renovation',540,534,522,281606,2013,null,'BPR 5.3.1 / 7.7'),
  ('TV-GJEL-H','TV-GJEL','Shkolla e gjelber hall',null,'sports_hall','renovation',492,492,120,59021,2011,null,'BPR 5.3.1 / 7.7'),
  ('TV-QAMI-H','TV-QAMI','Qamil Batalli hall',null,'sports_hall','renovation',649,650,120,77934,2016,null,'BPR 5.3.1 / 7.7'),
  ('TV-XHEM-H','TV-XHEM','Xhemail Mustafa hall',null,'sports_hall','renovation',617,617,518,320034,2005,null,'BPR 5.3.1 / 7.7'),
  ('TV-DONB-H','TV-DONB','Don Bosko hall',null,'sports_hall','renovation',1180,1180,353,416488,2015,null,'BPR 5.3.1 / 7.7')
) as v(code, site, name, zone, typology, intervention, net, gross, unit_cost, estimate, year, construction, source)
join mg2030_site s on s.site_code = v.site;

-- ── Marches (9) ───────────────────────────────────────────────
-- afd_review passe en minuscules (« PRIOR » -> 'prior'). contract_number n'est
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
  ('C-TA','MYS/MG2030/C/2026/XX','Technical Assistance','C','IPC','REOI','QCBS','prior','base',null,'2026-11-15','2027-02-09','2027-03-23','2030-06-15','PS 3.3'),
  ('C-TV-DD','MYS/MG2030/C/2026/XX','Training venues - Detailed Design and works supervision','C','IPC','REOI','QCBS','prior','base',null,'2026-09-01','2026-11-13','2026-11-27','2028-10-31','PS 3.3'),
  ('C-SC-DD','MYS/MG2030/C/2026/XX','Student Center - Detailed Design','C',null,'DC',null,'prior','design_bid_build',null,null,null,'2026-10-20','2027-05-18','PS 3.3'),
  ('C-SC-SUP','MYS/MG2030/C/2027/XX','Student Center - Works supervision','C','IPC','REOI','QCBS','prior','design_bid_build',null,'2027-03-02','2027-05-14','2027-06-25','2029-09-12','PS 3.3'),
  ('W-TV','MYS/MG2030/W/2027/XX','Training venues - Works','W','NPC','IB','lowest_evaluated_compliant_bid','prior','base',null,'2027-08-05','2027-09-30','2027-11-11','2029-02-01','PS 3.3'),
  ('W-SC','MYS/MG2030/W/2027/XX','Student Center - Works','W','IPC','PQL+IB','lowest_evaluated_compliant_bid','prior','design_bid_build',null,'2027-03-27','2027-07-13','2027-08-24','2029-09-12','PS 3.3'),
  ('DB-SC','MYS/MG2030/DB/2027/XX','Student Center - Design and Build','DB','IPC','PQL+IB','QCBS','prior','design_build',44400000,'2026-09-01','2027-01-14','2027-02-27','2029-05-29','PS 3.3'),
  ('G-SC','MYS/MG2030/C/2027/XX','Student Center - Furniture and equipment','G','IPC','IB','lowest_evaluated_compliant_bid','prior','base',null,'2029-01-15','2029-03-15','2029-05-01','2030-01-31','PS 3.3'),
  ('G-SPORT','MYS/MG2030/C/2027/XX','Sport equipment - 13 training venues, FEFS hall, swimming pool','G','IPC','IB','lowest_evaluated_compliant_bid','prior','base',null,'2029-01-15','2029-03-15','2029-05-01','2030-01-31','PS 3.3')
) as v(code, number, name, ctype, competition, procedure, selection, review, scenario, amount, spn, opening, signature, completion, source)
join mg2030_schedule_scenario s on s.code = v.scenario;

-- ── Lots (15) ─────────────────────────────────────────────────
-- Le brief dit « montant » au singulier ; le seed porte une FOURCHETTE. Les
-- deux bornes sont conservees (GAPS 34).
insert into mg2030_lot
  (lot_code, contract_id, lot_number, name, amount_eur_min, amount_eur_max,
   min_turnover_eur_min, min_turnover_eur_max, contractor, source)
select v.code, c.id, v.num, v.name, v.amin, v.amax, v.tmin, v.tmax, v.contractor, v.source
from (values
  ('C-TA-L1','C-TA',1,'Technical Assistance',null,null,null,null,null,'PS 3.3'),
  ('C-TV-DD-L1','C-TV-DD',1,'Training venues - Detailed Design and works supervision',null,null,null,null,null,'PS 3.3'),
  ('C-SC-DD-L1','C-SC-DD',1,'Student Center - Detailed Design',null,null,null,null,null,'PS 3.3'),
  ('C-SC-SUP-L1','C-SC-SUP',1,'Student Center - Works supervision',null,null,null,null,null,'PS 3.3'),
  ('W-TV-L1','W-TV',1,'Training venues - Lot 1 (3 venues)',1000000,2000000,1125000,1680000,null,'PS 3.3 / BPR 7.4.7'),
  ('W-TV-L2','W-TV',2,'Training venues - Lot 2 (3 venues)',1000000,2000000,1125000,1680000,null,'PS 3.3 / BPR 7.4.7'),
  ('W-TV-L3','W-TV',3,'Training venues - Lot 3 (3 venues)',1000000,2000000,1125000,1680000,null,'PS 3.3 / BPR 7.4.7'),
  ('W-TV-L4','W-TV',4,'Training venues - Lot 4 (4 venues)',1000000,2000000,1125000,1680000,null,'PS 3.3 / BPR 7.4.7'),
  ('W-SC-L1','W-SC',1,'Student Center - Services and Sports facilities zone (incl. semi-Olympic pool)',6900000,6900000,6900000,10350000,null,'BPR 7.4.7'),
  ('W-SC-L2','W-SC',2,'Student Center - Residential zone (dormitories refurbishment and new dormitories)',39700000,39700000,39700000,59550000,null,'BPR 7.4.7'),
  ('DB-SC-L1','DB-SC',1,'Student Center - Services and Sports facilities zone (incl. semi-Olympic pool)',15700000,15700000,null,null,null,'PS 3.3'),
  ('DB-SC-L2','DB-SC',2,'Student Center - Residential zone (dormitories refurbishment and new dormitories)',28700000,28700000,null,null,null,'PS 3.3'),
  ('G-SC-L1','G-SC',1,'Student Center - Furniture and equipment - dormitories',null,null,null,null,null,'PS 3.3'),
  ('G-SC-L2','G-SC',2,'Student Center - Furniture and equipment - administration and health center',null,null,null,null,null,'PS 3.3'),
  ('G-SPORT-L1','G-SPORT',1,'Sport equipment - 13 training venues, FEFS hall and swimming pool',null,null,null,null,null,'PS 3.3')
) as v(code, contract, num, name, amin, amax, tmin, tmax, contractor, source)
join mg2030_contract c on c.contract_code = v.contract;

-- ── Affectation lot/batiment (46 sur 59) ──────────────────────
-- Les 13 lignes SANS lot_code (les 13 salles de training venues) ne sont PAS
-- chargees : leur affectation n'est pas arretee (GAPS 3), et une affectation
-- inconnue est une ABSENCE de relation, pas une relation a lot nul.
-- Les 23 batiments du Student Center apparaissent deux fois : une fois sur les
-- lots W-SC-* (voie classique), une fois sur les lots DB-SC-*. 23 x 2 = 46.
insert into mg2030_lot_building (lot_id, building_id, source)
select l.id, b.id, v.source
from (values
  ('W-SC-L2','SC-KON1','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-KON1','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L2','SC-KON2','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-KON2','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L2','SC-KON3','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-KON3','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L2','SC-KON4','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-KON4','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L2','SC-KON5','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-KON5','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L2','SC-KON6','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-KON6','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L2','SC-KON7','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-KON7','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L2','SC-KON8','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-KON8','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L2','SC-ND01','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-ND01','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L2','SC-ND02','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-ND02','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L2','SC-ND03','BPR 7.4.7 (zone residentielle)'),
  ('DB-SC-L2','SC-ND03','BPR 7.4.7 (zone residentielle)'),
  ('W-SC-L1','SC-REST','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-REST','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-TETO','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-TETO','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-ADMO','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-ADMO','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-HEAO','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-HEAO','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-AMPH','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-AMPH','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-ADMN','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-ADMN','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-HEAN','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-HEAN','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-POOL','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-POOL','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-MPHA','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-MPHA','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-CAFE','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-CAFE','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-LIBR','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-LIBR','BPR 7.4.7 (zone services et sports)'),
  ('W-SC-L1','SC-COMM','BPR 7.4.7 (zone services et sports)'),
  ('DB-SC-L1','SC-COMM','BPR 7.4.7 (zone services et sports)')
) as v(lot, building, source)
join mg2030_lot l on l.lot_code = v.lot
join mg2030_building b on b.building_code = v.building;

-- ── Taches (27) ───────────────────────────────────────────────
-- Correction GAPS 12 appliquee : TV.2.1 21j -> 20j, SC.2.2 21j -> 20j.
-- Le rattachement parent/enfant se fait apres coup : l'ordre du CSV ne garantit
-- pas que le parent precede l'enfant.
insert into mg2030_task
  (wbs_code, plan_id, scenario_id, task_type, group_label, activity, duration_days,
   start_date, end_date, contract_id, source_sheet, source_row, sort_order)
select v.wbs, p.id, s.id, v.ttype::mg2030_task_type, v.grp, v.activity, v.days,
       v.start::date, v.finish::date, c.id, v.sheet, v.row, v.ord
from (values
  ('TV.1','TV','base','task','Design','Schematic design',98,'2026-07-01','2026-10-07',null,'TV','15',0),
  ('TV.2','TV','base','summary','Design','Detail Design',null,'2026-09-01','2027-08-05','C-TV-DD','TV','22',1),
  ('TV.2.1','TV','base','task','Design','EOI',20,'2026-09-01','2026-09-21','C-TV-DD','TV','24',2),
  ('TV.2.2','TV','base','task','Design','TA + MYS validation',14,'2026-09-21','2026-10-05','C-TV-DD','TV','25',3),
  ('TV.2.3','TV','base','task','Design','AFD''s NoN',10,'2026-10-05','2026-10-15','C-TV-DD','TV','26',4),
  ('TV.2.4','TV','base','task','Design','Proposal Preparation',42,'2026-10-15','2026-11-26','C-TV-DD','TV','27',5),
  ('TV.2.5','TV','base','task','Design','TA + MYS validation',14,'2026-11-26','2026-12-10','C-TV-DD','TV','28',6),
  ('TV.2.6','TV','base','task','Design','Contracts negociation + AFD''s NoNs',28,'2026-12-10','2027-01-07','C-TV-DD','TV','29',7),
  ('TV.2.7','TV','base','task','Design','Detail Design studies',210,'2027-01-07','2027-08-05','C-TV-DD','TV','30',8),
  ('TV.3','TV','base','group_header','Works','Works',null,null,null,null,'TV','38',9),
  ('TV.3.1','TV','base','summary','Works','Training venues tender',null,'2027-08-05','2027-11-11','W-TV','TV','39',10),
  ('TV.3.1.1','TV','base','task','Works','Call for bids training venues',56,'2027-08-05','2027-09-30','W-TV','TV','40',11),
  ('TV.3.1.2','TV','base','task','Works','TA + MYS evaluation',14,'2027-09-30','2027-10-14','W-TV','TV','41',12),
  ('TV.3.1.3','TV','base','task','Works','AFD''s NoN + contracts negociation',28,'2027-10-14','2027-11-11','W-TV','TV','42',13),
  ('TV.3.2','TV','base','task','Works','Training venues works',448,'2027-11-11','2029-02-01','W-TV','TV','43',14),
  ('SC.1','SC-DB','design_build','task','DESIGN & BUILD','Schematic design',98,'2026-07-01','2026-10-07',null,'SC','15',15),
  ('SC.2','SC-DB','design_build','summary','DESIGN & BUILD','Detail Design',null,'2026-09-01','2029-05-29','DB-SC','SC','22',16),
  ('SC.2.1','SC-DB','design_build','task','DESIGN & BUILD','Schematic design adjustments',15,'2026-10-07','2026-10-22',null,'SC','23',17),
  ('SC.2.2','SC-DB','design_build','task','DESIGN & BUILD','Initial Selection',20,'2026-09-01','2026-09-21','DB-SC','SC','24',18),
  ('SC.2.3','SC-DB','design_build','task','DESIGN & BUILD','TA + MYS validation',15,'2026-09-21','2026-10-06','DB-SC','SC','25',19),
  ('SC.2.4','SC-DB','design_build','task','DESIGN & BUILD','AFD''s NoN',10,'2026-10-06','2026-10-16','DB-SC','SC','26',20),
  ('SC.2.5','SC-DB','design_build','task','DESIGN & BUILD','Proposal Preparation',84,'2026-10-22','2027-01-14','DB-SC','SC','27',21),
  ('SC.2.6','SC-DB','design_build','task','DESIGN & BUILD','TA + MYS evaluation',14,'2027-01-14','2027-01-28','DB-SC','SC','28',22),
  ('SC.2.7','SC-DB','design_build','task','DESIGN & BUILD','Contract negociation + AFD''s NoNs',30,'2027-01-28','2027-02-27','DB-SC','SC','29',23),
  ('SC.2.8','SC-DB','design_build','task','DESIGN & BUILD','Design and build',822,'2027-02-27','2029-05-29','DB-SC','SC','30',24),
  ('MS.1','TV','base','milestone',null,'MG2030 buffer start (4 months buffer)',null,'2029-09-01','2029-09-01',null,'TV','AY6',25),
  ('MS.2','TV','base','milestone',null,'End of work',null,'2030-01-01','2030-01-01',null,'TV','C5',26)
) as v(wbs, plan, scenario, ttype, grp, activity, days, start, finish, contract, sheet, row, ord)
join mg2030_plan p on p.plan_code = v.plan
join mg2030_schedule_scenario s on s.code = v.scenario
left join mg2030_contract c on c.contract_code = v.contract;

update mg2030_task c set parent_id = p.id
from (values
  ('TV.2.1','TV.2'),
  ('TV.2.2','TV.2'),
  ('TV.2.3','TV.2'),
  ('TV.2.4','TV.2'),
  ('TV.2.5','TV.2'),
  ('TV.2.6','TV.2'),
  ('TV.2.7','TV.2'),
  ('TV.3.1','TV.3'),
  ('TV.3.1.1','TV.3.1'),
  ('TV.3.1.2','TV.3.1'),
  ('TV.3.1.3','TV.3.1'),
  ('TV.3.2','TV.3'),
  ('SC.2.1','SC.2'),
  ('SC.2.2','SC.2'),
  ('SC.2.3','SC.2'),
  ('SC.2.4','SC.2'),
  ('SC.2.5','SC.2'),
  ('SC.2.6','SC.2'),
  ('SC.2.7','SC.2'),
  ('SC.2.8','SC.2')
) as v(child, parent)
join mg2030_task p on p.wbs_code = v.parent
where c.wbs_code = v.child and c.plan_id = p.plan_id;

-- ── Precedences (19) ──────────────────────────────────────────
-- Deux taches ont DEUX predecesseurs (TV.2.4 et SC.2.5, formules MAX) : le
-- moteur doit gerer les convergences, pas seulement les chaines lineaires.
insert into mg2030_task_dependency (predecessor_id, successor_id, dependency_type, lag_days, source_formula)
select p.id, s.id, v.dtype::mg2030_dependency_type, v.lag, v.formula
from (values
  ('TV.2.1','TV.2.2','FS',0,'TV!C25 = I24'),
  ('TV.2.2','TV.2.3','FS',0,'TV!C26 = I25'),
  ('TV.1','TV.2.4','FS',0,'TV!C27 = MAX(I15,I26)'),
  ('TV.2.3','TV.2.4','FS',0,'TV!C27 = MAX(I15,I26)'),
  ('TV.2.4','TV.2.5','FS',0,'TV!C28 = I27'),
  ('TV.2.5','TV.2.6','FS',0,'TV!C29 = I28'),
  ('TV.2.6','TV.2.7','FS',0,'TV!C30 = I29'),
  ('TV.2.7','TV.3.1.1','FS',0,'TV!C40 = I30'),
  ('TV.3.1.1','TV.3.1.2','FS',0,'TV!C41 = I40'),
  ('TV.3.1.2','TV.3.1.3','FS',0,'TV!C42 = I41'),
  ('TV.3.1.3','TV.3.2','FS',0,'TV!C43 = I42'),
  ('SC.1','SC.2.1','FS',0,'SC!C23 = I15'),
  ('SC.2.2','SC.2.3','FS',0,'SC!C25 = I24'),
  ('SC.2.3','SC.2.4','FS',0,'SC!C26 = I25'),
  ('SC.1','SC.2.5','FS',0,'SC!C27 = MAX(I15,I23)'),
  ('SC.2.1','SC.2.5','FS',0,'SC!C27 = MAX(I15,I23)'),
  ('SC.2.5','SC.2.6','FS',0,'SC!C28 = I27'),
  ('SC.2.6','SC.2.7','FS',0,'SC!C29 = I28'),
  ('SC.2.7','SC.2.8','FS',0,'SC!C30 = I29')
) as v(pred, succ, dtype, lag, formula)
join mg2030_task p on p.wbs_code = v.pred
join mg2030_task s on s.wbs_code = v.succ;

-- ── Contraintes de date (4) ───────────────────────────────────
-- Les 4 dates saisies en dur du fichier Excel, sans predecesseur.
insert into mg2030_task_constraint (task_id, kind, constraint_date, source)
select t.id, v.kind::mg2030_constraint_kind, v.cdate::date, v.source
from (values
  ('TV.1','start_no_earlier_than','2026-07-01','TV!C15 saisi en dur'),
  ('TV.2.1','start_no_earlier_than','2026-09-01','TV!C24 saisi en dur'),
  ('SC.1','start_no_earlier_than','2026-07-01','SC!C15 saisi en dur'),
  ('SC.2.2','start_no_earlier_than','2026-09-01','SC!C24 saisi en dur')
) as v(wbs, kind, cdate, source)
join mg2030_task t on t.wbs_code = v.wbs;

-- ── Tags (4) ──────────────────────────────────────────────────
-- Les 4 tags initiaux imposes au brief §7.
insert into mg2030_tag (code, label, color, is_system) values
  ('procurement','Procurement','#034ea2',true),
  ('technical_documentation','Technical documentation','#d0a650',true),
  ('piu_admin','PIU administration','#646b78',true),
  ('environmental_social','Environmental and social','#38761d',true);

-- ── Arborescence documentaire (39) ────────────────────────────
-- PROPOSITION, pas une donnee projet : la colonne `note` vaut « proposition »
-- sur les 39 lignes. Les administrateurs peuvent tout reorganiser.
-- Deux passes : racines puis enfants, le parent devant exister. Le chemin
-- materialise est recalcule par le trigger mg2030_folder_set_path.
insert into mg2030_folder (parent_id, name, path, default_tag_id)
select null, v.name, v.name, t.id
from (values
  ('01_Project_governance','piu_admin'),
  ('02_Procurement','procurement'),
  ('03_Design','technical_documentation'),
  ('04_Works','technical_documentation'),
  ('05_Environmental_and_social','environmental_social'),
  ('06_Monitoring_and_reporting','piu_admin'),
  ('07_Finance','piu_admin'),
  ('08_Communication',null),
  ('09_Planning',null)
) as v(name, tag)
left join mg2030_tag t on t.code = v.tag;

insert into mg2030_folder (parent_id, name, path, default_tag_id)
select p.id, v.name, v.path, t.id
from (values
  ('01_Project_governance/Steering_committee','Steering_committee','01_Project_governance','piu_admin'),
  ('01_Project_governance/Technical_committee','Technical_committee','01_Project_governance','piu_admin'),
  ('01_Project_governance/Financing_agreement','Financing_agreement','01_Project_governance','piu_admin'),
  ('01_Project_governance/Project_operational_manual','Project_operational_manual','01_Project_governance','piu_admin'),
  ('02_Procurement/Procurement_plan','Procurement_plan','02_Procurement','procurement'),
  ('02_Procurement/Tender_documents','Tender_documents','02_Procurement','procurement'),
  ('02_Procurement/Evaluation_reports','Evaluation_reports','02_Procurement','procurement'),
  ('02_Procurement/No_objection_letters','No_objection_letters','02_Procurement','procurement'),
  ('02_Procurement/Signed_contracts','Signed_contracts','02_Procurement','procurement'),
  ('02_Procurement/Claims_and_complaints','Claims_and_complaints','02_Procurement','procurement'),
  ('03_Design/Concept_and_schematic_design','Concept_and_schematic_design','03_Design','technical_documentation'),
  ('03_Design/Detailed_design_Student_Center','Detailed_design_Student_Center','03_Design','technical_documentation'),
  ('03_Design/Detailed_design_Training_venues','Detailed_design_Training_venues','03_Design','technical_documentation'),
  ('03_Design/Energy_audits','Energy_audits','03_Design','technical_documentation'),
  ('04_Works/Student_Center','Student_Center','04_Works','technical_documentation'),
  ('04_Works/Training_venues','Training_venues','04_Works','technical_documentation'),
  ('04_Works/Site_meeting_minutes','Site_meeting_minutes','04_Works','technical_documentation'),
  ('05_Environmental_and_social/ESIA','ESIA','05_Environmental_and_social','environmental_social'),
  ('05_Environmental_and_social/ESMP','ESMP','05_Environmental_and_social','environmental_social'),
  ('05_Environmental_and_social/Contractor_ESMP','Contractor_ESMP','05_Environmental_and_social','environmental_social'),
  ('05_Environmental_and_social/Permits','Permits','05_Environmental_and_social','environmental_social'),
  ('05_Environmental_and_social/Monitoring_reports','Monitoring_reports','05_Environmental_and_social','environmental_social'),
  ('05_Environmental_and_social/Grievances','Grievances','05_Environmental_and_social','environmental_social'),
  ('05_Environmental_and_social/Student_relocation','Student_relocation','05_Environmental_and_social','environmental_social'),
  ('06_Monitoring_and_reporting/Monthly_reports','Monthly_reports','06_Monitoring_and_reporting','piu_admin'),
  ('06_Monitoring_and_reporting/Quarterly_reports','Quarterly_reports','06_Monitoring_and_reporting','piu_admin'),
  ('06_Monitoring_and_reporting/Indicators','Indicators','06_Monitoring_and_reporting','piu_admin'),
  ('07_Finance/Budget','Budget','07_Finance','piu_admin'),
  ('07_Finance/Payments','Payments','07_Finance','piu_admin'),
  ('07_Finance/Audits','Audits','07_Finance','piu_admin')
) as v(path, name, parent, tag)
join mg2030_folder p on p.path = v.parent
left join mg2030_tag t on t.code = v.tag;

-- ── Historique ─────────────────────────────────────────────
truncate table mg2030_change_log restart identity;

commit;
