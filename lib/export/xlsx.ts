// ============================================================
// lib/export/xlsx.ts — écrire un vrai classeur Excel, sans bibliothèque.
//
// ⚠ POURQUOI PAS UNE DÉPENDANCE. Le dépôt n'en prend aucune pour le rendu :
// le Gantt, les icônes et le calendrier sont écrits ici. Un classeur de
// quarante lignes avec des en-têtes en gras et des colonnes à la bonne largeur
// ne justifie pas une bibliothèque de plusieurs mégaoctets, son rythme de
// mises à jour et sa surface de sécurité.
//
// ⚠ POURQUOI PAS UN CSV. « Correctement mis en forme » était la demande. Un
// CSV n'a ni largeur de colonne, ni en-tête figé, ni filtre, ni retour à la
// ligne dans une cellule — et Excel y mange les accents et transforme
// « 01/10 » en date selon l'humeur du poste.
//
// ⚠ POURQUOI PAS DU SpreadsheetML 2003. Il se met en forme, mais Excel
// affiche un avertissement « le format ne correspond pas à l'extension » à
// chaque ouverture. Un fichier que l'AFD ouvre en lisant un avertissement est
// un fichier raté.
//
// Un `.xlsx` est donc une archive ZIP de quelques fichiers XML. Les entrées
// sont écrites SANS COMPRESSION (méthode « stored ») : il ne reste alors qu'un
// CRC-32 à calculer, et le poids d'une roadmap est négligeable. Tout est pur,
// donc testé — y compris contre un vrai décompresseur.
// ============================================================

export interface SheetColumn {
  header: string;
  /** Largeur en « caractères », l'unité d'Excel. ~7 px par caractère. */
  width: number;
  /** Les textes longs se replient au lieu de déborder sur la colonne voisine. */
  wrap?: boolean;
}

export interface SheetData {
  name: string;
  columns: SheetColumn[];
  /** Une ligne = une cellule par colonne. `null` laisse la cellule vide. */
  rows: (string | number | null)[][];
}

// ── XML ──────────────────────────────────────────────────────────────────────

/**
 * Échappe pour XML ET retire ce qu'XML 1.0 interdit.
 *
 * Les caractères de contrôle sous 0x20 — hors tabulation, saut de ligne et
 * retour chariot — rendent le fichier ILLISIBLE pour Excel, qui refuse alors
 * le classeur entier plutôt que la cellule fautive. Un copier-coller depuis un
 * PDF en apporte sans qu'on le voie.
 */
function xml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Colonne 0 → « A », 26 → « AA ». */
export function columnName(index: number): string {
  let name = "";
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

/**
 * Le nom d'onglet accepté par Excel.
 *
 * 31 caractères au plus, et sept caractères interdits. Un nom refusé ne donne
 * pas un onglet mal nommé : il donne un fichier qu'Excel déclare corrompu.
 */
export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim();
  return (cleaned === "" ? "Sheet1" : cleaned).slice(0, 31);
}

function sheetXml(sheet: SheetData): string {
  const lastColumn = columnName(Math.max(0, sheet.columns.length - 1));
  const lastRow = sheet.rows.length + 1;

  const cols = sheet.columns
    .map(
      (c, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`,
    )
    .join("");

  const header = sheet.columns
    .map((c, i) => `<c r="${columnName(i)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${xml(c.header)}</t></is></c>`)
    .join("");

  const body = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((value, i) => {
          if (value === null || value === "") return "";
          const ref = `${columnName(i)}${r + 2}`;
          // Le style 2 replie le texte ; le 3 ne le replie pas. Un nombre n'a
          // pas de style propre — Excel l'aligne à droite tout seul.
          const style = sheet.columns[i]?.wrap ? "2" : "3";
          if (typeof value === "number") {
            return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
          }
          return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 2}">${cells}</row>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><outlinePr summaryBelow="0"/></sheetPr>` +
    // La première ligne reste visible au défilement : sur quarante lignes, on
    // ne sait plus quelle colonne on lit à partir de la vingtième.
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData><row r="1" ht="22" customHeight="1">${header}</row>${body}</sheetData>` +
    // Le filtre automatique sur l'en-tête : c'est le premier geste de qui
    // reçoit un tableau.
    `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` +
    `</worksheet>`
  );
}

/**
 * Quatre styles, et pas un de plus :
 *   0 — normal
 *   1 — en-tête : blanc sur bleu nuit, comme les tableaux de l'application
 *   2 — texte replié, aligné en haut
 *   3 — texte simple, aligné en haut
 */
const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="3">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF1B2A41"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>` +
  `</cellXfs>` +
  `</styleSheet>`;

// ── ZIP ─────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface Entry {
  path: string;
  bytes: Uint8Array;
}

/**
 * Archive ZIP, entrées NON COMPRESSÉES.
 *
 * La méthode « stored » est parfaitement légale et comprise de tous les
 * décompresseurs — elle évite d'implémenter deflate, soit quelques centaines de
 * lignes de plus pour gagner quelques dizaines de kilo-octets sur un fichier
 * qu'on ouvre et qu'on jette.
 */
function zip(entries: Entry[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.length;

    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true); // version nécessaire
    view.setUint16(6, 0x0800, true); // noms en UTF-8
    view.setUint16(8, 0, true); // méthode : stored
    view.setUint16(10, 0, true); // heure
    view.setUint16(12, 0, true); // date
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true);
    local.set(name, 30);

    chunks.push(local, entry.bytes);

    const dir = new Uint8Array(46 + name.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, size, true);
    dv.setUint32(24, size, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true);
    dir.set(name, 46);
    central.push(dir);

    offset += local.length + size;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total =
    chunks.reduce((n, c) => n + c.length, 0) + centralSize + end.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of [...chunks, ...central, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Le classeur complet, prêt à être servi. */
export function buildXlsx(sheet: SheetData): Uint8Array {
  const encoder = new TextEncoder();
  const name = safeSheetName(sheet.name);

  const files: Entry[] = [
    {
      path: "[Content_Types].xml",
      bytes: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          `</Types>`,
      ),
    },
    {
      path: "_rels/.rels",
      bytes: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      path: "xl/workbook.xml",
      bytes: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${xml(name)}" sheetId="1" r:id="rId1"/></sheets>` +
          `</workbook>`,
      ),
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      bytes: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
          `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`,
      ),
    },
    { path: "xl/styles.xml", bytes: encoder.encode(STYLES_XML) },
    { path: "xl/worksheets/sheet1.xml", bytes: encoder.encode(sheetXml(sheet)) },
  ];

  return zip(files);
}
