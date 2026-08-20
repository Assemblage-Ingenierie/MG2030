import "server-only";

// ============================================================
// lib/queries/referential.ts — lecture des sites, bâtiments, marchés et lots.
//
// Toutes les requêtes passent par le client à session utilisateur : la RLS
// filtre selon le périmètre. Ce module ne refiltre RIEN — un filtrage
// applicatif redondant donnerait l'illusion d'une sécurité qui n'est pas là.
//
// Pagination CÔTÉ SERVEUR sur toute liste pouvant dépasser 100 lignes
// (brief §4). Sites, marchés et lots restent sous ce seuil ; bâtiments et
// tâches sont paginés par principe, ils grossiront.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export const PAGE_SIZE = 50;

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
}

function toPage<T>(rows: T[], total: number, page: number): Page<T> {
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ── Sites ───────────────────────────────────────────────────────────────────

export interface SiteRow {
  id: string;
  siteCode: string;
  subproject: "athletes_village" | "training_venues";
  name: string;
  beneficiary: string | null;
  siteType: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  grossArea: number | null;
  yearOfConstruction: number | null;
  occupancyStatus: string | null;
  buildingCount: number;
  source: string | null;
}

/** Sites en options légères, pour les sélecteurs de formulaire. */
export async function listSiteOptions(): Promise<{ id: string; siteCode: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mg2030_site")
    .select("id, site_code, name")
    .is("archived_at", null)
    .order("site_code");
  if (error) throw new Error(`Lecture des sites : ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    siteCode: r.site_code as string,
    name: r.name as string,
  }));
}

export async function listSites(subproject?: string): Promise<SiteRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("mg2030_site")
    .select(
      `id, site_code, subproject, name, beneficiary_institution, site_type, address,
       latitude, longitude, gross_area_sqm, year_of_construction, occupancy_status, source,
       mg2030_building ( count )`,
    )
    .is("archived_at", null)
    .order("site_code");

  if (subproject) query = query.eq("subproject", subproject);

  const { data, error } = await query;
  if (error) throw new Error(`Lecture des sites : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown> & {
      mg2030_building: { count: number }[];
    };
    return {
      id: r.id as string,
      siteCode: r.site_code as string,
      subproject: r.subproject as SiteRow["subproject"],
      name: r.name as string,
      beneficiary: (r.beneficiary_institution as string) ?? null,
      siteType: (r.site_type as string) ?? null,
      address: (r.address as string) ?? null,
      latitude: (r.latitude as number) ?? null,
      longitude: (r.longitude as number) ?? null,
      grossArea: (r.gross_area_sqm as number) ?? null,
      yearOfConstruction: (r.year_of_construction as number) ?? null,
      occupancyStatus: (r.occupancy_status as string) ?? null,
      buildingCount: r.mg2030_building?.[0]?.count ?? 0,
      source: (r.source as string) ?? null,
    };
  });
}

// ── Bâtiments ───────────────────────────────────────────────────────────────

export interface BuildingRow {
  id: string;
  buildingCode: string;
  name: string;
  siteId: string;
  siteCode: string;
  siteName: string;
  subproject: string;
  zone: string | null;
  typology: string | null;
  interventionType: string;
  netArea: number | null;
  grossArea: number | null;
  unitCost: number | null;
  worksEstimate: number | null;
  yearOfConstruction: number | null;
  constructionType: string | null;
  source: string | null;
}

export async function listBuildings(options: {
  page?: number;
  siteCode?: string;
  intervention?: string;
} = {}): Promise<Page<BuildingRow>> {
  const supabase = await createClient();
  const page = Math.max(1, options.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("mg2030_building")
    .select(
      `id, building_code, name, zone, typology, intervention_type, net_area_sqm,
       gross_area_sqm, unit_cost_eur_sqm, works_estimate_eur, year_of_construction,
       construction_type, source,
       mg2030_site!inner ( id, site_code, name, subproject )`,
      { count: "exact" },
    )
    .is("archived_at", null)
    .order("building_code")
    .range(from, from + PAGE_SIZE - 1);

  if (options.siteCode) query = query.eq("mg2030_site.site_code", options.siteCode);
  if (options.intervention) query = query.eq("intervention_type", options.intervention);

  const { data, error, count } = await query;
  if (error) throw new Error(`Lecture des batiments : ${error.message}`);

  const rows = (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown> & {
      mg2030_site: { id: string; site_code: string; name: string; subproject: string };
    };
    return {
      id: r.id as string,
      buildingCode: r.building_code as string,
      name: r.name as string,
      siteId: r.mg2030_site.id,
      siteCode: r.mg2030_site.site_code,
      siteName: r.mg2030_site.name,
      subproject: r.mg2030_site.subproject,
      zone: (r.zone as string) ?? null,
      typology: (r.typology as string) ?? null,
      interventionType: r.intervention_type as string,
      netArea: (r.net_area_sqm as number) ?? null,
      grossArea: (r.gross_area_sqm as number) ?? null,
      unitCost: (r.unit_cost_eur_sqm as number) ?? null,
      worksEstimate: (r.works_estimate_eur as number) ?? null,
      yearOfConstruction: (r.year_of_construction as number) ?? null,
      constructionType: (r.construction_type as string) ?? null,
      source: (r.source as string) ?? null,
    };
  });

  return toPage(rows, count ?? rows.length, page);
}

// ── Marchés ─────────────────────────────────────────────────────────────────

export interface ContractRow {
  id: string;
  contractCode: string;
  contractNumber: string;
  name: string;
  contractType: string;
  competitionType: string | null;
  procedure: string;
  selectionMethod: string | null;
  afdReview: string;
  scenarioId: string;
  scenarioCode: string;
  estimatedAmount: number | null;
  contractedAmount: number | null;
  contractor: string | null;
  spnPublicationDate: string | null;
  bidOpeningDate: string | null;
  signatureDate: string | null;
  completionDate: string | null;
  lotCount: number;
  source: string | null;
}

export async function listContracts(scenarioCode?: string): Promise<ContractRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("mg2030_contract")
    .select(
      `id, contract_code, contract_number, name, contract_type, competition_type,
       procedure, selection_method, afd_review, estimated_amount_eur,
       contracted_amount_eur, contractor, spn_publication_date, bid_opening_date,
       signature_date, completion_date, source,
       mg2030_schedule_scenario!inner ( id, code ),
       mg2030_lot ( count )`,
    )
    .is("archived_at", null)
    .order("contract_code");

  if (scenarioCode) query = query.eq("mg2030_schedule_scenario.code", scenarioCode);

  const { data, error } = await query;
  if (error) throw new Error(`Lecture des marches : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown> & {
      mg2030_schedule_scenario: { id: string; code: string };
      mg2030_lot: { count: number }[];
    };
    return {
      id: r.id as string,
      contractCode: r.contract_code as string,
      contractNumber: r.contract_number as string,
      name: r.name as string,
      contractType: r.contract_type as string,
      competitionType: (r.competition_type as string) ?? null,
      procedure: r.procedure as string,
      selectionMethod: (r.selection_method as string) ?? null,
      afdReview: r.afd_review as string,
      scenarioId: r.mg2030_schedule_scenario.id,
      scenarioCode: r.mg2030_schedule_scenario.code,
      estimatedAmount: (r.estimated_amount_eur as number) ?? null,
      contractedAmount: (r.contracted_amount_eur as number) ?? null,
      contractor: (r.contractor as string) ?? null,
      spnPublicationDate: (r.spn_publication_date as string) ?? null,
      bidOpeningDate: (r.bid_opening_date as string) ?? null,
      signatureDate: (r.signature_date as string) ?? null,
      completionDate: (r.completion_date as string) ?? null,
      lotCount: r.mg2030_lot?.[0]?.count ?? 0,
      source: (r.source as string) ?? null,
    };
  });
}

// ── Lots ────────────────────────────────────────────────────────────────────

export interface LotRow {
  id: string;
  lotCode: string;
  lotNumber: number;
  name: string;
  contractId: string;
  contractCode: string;
  contractName: string;
  amountMin: number | null;
  amountMax: number | null;
  turnoverMin: number | null;
  turnoverMax: number | null;
  contractor: string | null;
  buildingCount: number;
  source: string | null;
}

export async function listLots(contractCode?: string): Promise<LotRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("mg2030_lot")
    .select(
      `id, lot_code, lot_number, name, amount_eur_min, amount_eur_max,
       min_turnover_eur_min, min_turnover_eur_max, contractor, source,
       mg2030_contract!inner ( id, contract_code, name ),
       mg2030_lot_building ( count )`,
    )
    .is("archived_at", null)
    .order("lot_code");

  if (contractCode) query = query.eq("mg2030_contract.contract_code", contractCode);

  const { data, error } = await query;
  if (error) throw new Error(`Lecture des lots : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown> & {
      mg2030_contract: { id: string; contract_code: string; name: string };
      mg2030_lot_building: { count: number }[];
    };
    return {
      id: r.id as string,
      lotCode: r.lot_code as string,
      lotNumber: r.lot_number as number,
      name: r.name as string,
      contractId: r.mg2030_contract.id,
      contractCode: r.mg2030_contract.contract_code,
      contractName: r.mg2030_contract.name,
      amountMin: (r.amount_eur_min as number) ?? null,
      amountMax: (r.amount_eur_max as number) ?? null,
      turnoverMin: (r.min_turnover_eur_min as number) ?? null,
      turnoverMax: (r.min_turnover_eur_max as number) ?? null,
      contractor: (r.contractor as string) ?? null,
      buildingCount: r.mg2030_lot_building?.[0]?.count ?? 0,
      source: (r.source as string) ?? null,
    };
  });
}
