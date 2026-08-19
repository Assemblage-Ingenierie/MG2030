// ============================================================
// scripts/seed/parse-csv.mjs — lecteur CSV minimal, sans dépendance.
//
// Les fichiers de seed/ sont en UTF-8, séparateur virgule, avec des champs
// entre guillemets contenant des virgules (« Sport equipment - 13 training
// venues, FEFS hall, swimming pool »). Un `split(",")` naïf les casserait.
//
// Règle absolue : un champ VIDE devient `null`, jamais une chaîne vide ni zéro.
// Une donnée absente du seed est une donnée réellement manquante (brief §11.6).
// ============================================================

import { readFileSync } from "node:fs";

/** Découpe une ligne CSV en respectant les guillemets et les doublements («  »»  »). */
function splitLine(line) {
  const out = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      out.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  out.push(field);
  return out;
}

/**
 * Lit un CSV et renvoie un tableau d'objets.
 * Tout champ vide vaut `null`.
 */
export function readCsv(path) {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  const headers = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line, index) => {
    const cells = splitLine(line);
    if (cells.length !== headers.length) {
      throw new Error(
        `${path} ligne ${index + 2} : ${cells.length} champs pour ${headers.length} colonnes.`,
      );
    }
    const row = {};
    headers.forEach((header, i) => {
      const value = cells[i].trim();
      row[header] = value === "" ? null : value;
    });
    return row;
  });
}

// ── Conversions, toutes préservant le null ────────────────────────────────

export const num = (v) => (v === null ? null : Number(v));
export const int = (v) => (v === null ? null : parseInt(v, 10));

/** Échappement SQL d'une valeur. `null` reste `null`, jamais `''`. */
export function sql(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Valeur numérique invalide : ${value}`);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Construit un INSERT groupé. Renvoie `null` s'il n'y a rien à insérer. */
export function buildInsert(table, columns, rows) {
  if (rows.length === 0) return null;
  const values = rows
    .map((row) => `  (${columns.map((c) => sql(row[c])).join(", ")})`)
    .join(",\n");
  return `insert into ${table} (${columns.join(", ")}) values\n${values};`;
}
