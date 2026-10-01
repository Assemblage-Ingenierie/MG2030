import { describe, expect, it } from "vitest";
import { buildXlsx, columnName, crc32, safeSheetName } from "../xlsx";

const decoder = new TextDecoder();

/**
 * Les noms d'entrées d'une archive, lus dans l'annuaire central.
 *
 * ⚠ ON DÉCOUPE DES OCTETS, PAS UNE CHAÎNE. Première version : décoder toute
 * l'archive en texte puis trancher aux index de l'annuaire. Les séquences
 * multi-octets décalent alors index de caractère et index d'octet, et les noms
 * sortaient tronqués par la gauche — un défaut du test, pas de l'écriture.
 */
function entryNames(zip: Uint8Array): string[] {
  const names: string[] = [];
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  for (let i = 0; i < zip.length - 4; i += 1) {
    if (view.getUint32(i, true) === 0x02014b50) {
      const len = view.getUint16(i + 28, true);
      names.push(decoder.decode(zip.slice(i + 46, i + 46 + len)));
    }
  }
  return names;
}

describe("noms de colonnes", () => {
  it("compte comme Excel", () => {
    expect(columnName(0)).toBe("A");
    expect(columnName(25)).toBe("Z");
    expect(columnName(26)).toBe("AA");
    expect(columnName(27)).toBe("AB");
    expect(columnName(51)).toBe("AZ");
    expect(columnName(52)).toBe("BA");
  });
});

describe("nom d'onglet", () => {
  it("retire les caracteres qu'Excel refuse", () => {
    // Un nom refuse ne donne pas un onglet mal nomme : il donne un fichier
    // qu'Excel declare corrompu.
    expect(safeSheetName("Road/map: 2026 [v2]")).toBe("Road map  2026  v2");
  });

  it("tronque a 31 caracteres", () => {
    expect(safeSheetName("x".repeat(40))).toHaveLength(31);
  });

  it("ne rend jamais une chaine vide", () => {
    expect(safeSheetName("///")).toBe("Sheet1");
  });
});

describe("CRC-32", () => {
  it("donne la valeur de reference", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("vaut zero sur une entree vide", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("classeur", () => {
  const sheet = {
    name: "Roadmap",
    columns: [
      { header: "Action", width: 40, wrap: true },
      { header: "Count", width: 10 },
    ],
    rows: [
      ["Relancer le MoF", 3],
      ["Esperluette & <balise>", null],
    ],
  };

  it("contient les six parties d'un xlsx", () => {
    const names = entryNames(buildXlsx(sheet));
    expect(names).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  it("commence par la signature ZIP", () => {
    const bytes = buildXlsx(sheet);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("ECHAPPE le XML : une esperluette ne doit pas casser le fichier", () => {
    const text = decoder.decode(buildXlsx(sheet));
    expect(text).toContain("Esperluette &amp; &lt;balise&gt;");
    expect(text).not.toContain("Esperluette & <");
  });

  it("RETIRE les caracteres de controle, qu'Excel refuse en bloc", () => {
    // Un copier-coller depuis un PDF en apporte sans qu'on le voie, et Excel
    // rejette alors le classeur entier plutot que la cellule fautive.
    const text = decoder.decode(
      buildXlsx({ ...sheet, rows: [["a\u0007b", null]] }),
    );
    expect(text).toContain(">ab<");
  });

  it("fige l'en-tete et pose un filtre automatique", () => {
    const text = decoder.decode(buildXlsx(sheet));
    expect(text).toContain('state="frozen"');
    expect(text).toContain('<autoFilter ref="A1:B3"/>');
  });

  it("ecrit les nombres en nombres, pas en texte", () => {
    const text = decoder.decode(buildXlsx(sheet));
    expect(text).toContain("<v>3</v>");
  });

  it("saute les cellules vides au lieu d'ecrire une chaine vide", () => {
    const text = decoder.decode(buildXlsx({ ...sheet, rows: [[null, null]] }));
    expect(text).toContain('<row r="2"></row>');
  });
});
