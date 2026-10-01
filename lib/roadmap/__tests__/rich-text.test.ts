import { describe, expect, it } from "vitest";
import { applyMark, isSafeHref, parseRichText, richTextToPlain } from "../rich-text";

describe("lecture du texte enrichi", () => {
  it("rend un paragraphe simple", () => {
    expect(parseRichText("Relancer le MoF")).toEqual([
      { kind: "paragraph", spans: [{ kind: "text", text: "Relancer le MoF" }] },
    ]);
  });

  it("reconnait le gras AVANT l'italique", () => {
    // Sans la priorite, `**gras**` se fait mordre par la regle de l'italique
    // sur ses asterisques interieurs.
    const [block] = parseRichText("avant **le 12** svp");
    expect(block).toEqual({
      kind: "paragraph",
      spans: [
        { kind: "text", text: "avant " },
        { kind: "bold", text: "le 12" },
        { kind: "text", text: " svp" },
      ],
    });
  });

  it("reconnait l'italique et le code", () => {
    const [block] = parseRichText("*note* et `GEP`");
    expect(block).toEqual({
      kind: "paragraph",
      spans: [
        { kind: "italic", text: "note" },
        { kind: "text", text: " et " },
        { kind: "code", text: "GEP" },
      ],
    });
  });

  it("groupe les puces en une liste", () => {
    expect(parseRichText("- GEP\n- budget")).toEqual([
      {
        kind: "list",
        items: [[{ kind: "text", text: "GEP" }], [{ kind: "text", text: "budget" }]],
      },
    ]);
  });

  it("separe un paragraphe de la liste qui le suit", () => {
    const blocks = parseRichText("Relancer sur :\n- GEP\n- budget");
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "list"]);
  });

  it("garde le saut de ligne simple DANS un paragraphe", () => {
    // On ecrit une note, pas du Markdown canonique : doubler la ligne vide
    // pour obtenir un retour serait une regle de plus a connaitre.
    const [block] = parseRichText("ligne un\nligne deux");
    expect(block).toEqual({
      kind: "paragraph",
      spans: [{ kind: "text", text: "ligne un\nligne deux" }],
    });
  });
});

describe("liens", () => {
  it("accepte http et https", () => {
    const [block] = parseRichText("voir [le GEP](https://example.org/gep)");
    expect(block).toEqual({
      kind: "paragraph",
      spans: [
        { kind: "text", text: "voir " },
        { kind: "link", text: "le GEP", href: "https://example.org/gep" },
      ],
    });
  });

  it("REFUSE javascript: et le laisse en texte", () => {
    // C'est la faille que le stockage en texte evitait : on ne la reintroduit
    // pas au rendu. Et l'adresse refusee reste visible plutot que de
    // disparaitre sans explication.
    //
    // On verifie les deux PROPRIETES, pas le decoupage : la parenthese de
    // `alert(1)` coupe le jeton en deux morceaux de texte, ce qui ne change
    // rien a l'affichage et tout a la lisibilite d'une egalite stricte.
    const [block] = parseRichText("[clic](javascript:alert(1))");
    const spans = block.kind === "paragraph" ? block.spans : [];
    expect(spans.some((s) => s.kind === "link")).toBe(false);
    expect(spans.map((s) => s.text).join("")).toBe("[clic](javascript:alert(1))");
  });

  it("refuse aussi les schemas deguises", () => {
    expect(isSafeHref("  JavaScript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>")).toBe(false);
    expect(isSafeHref("HTTPS://example.org")).toBe(true);
  });

  it("n'emet AUCUN noeud hors du vocabulaire connu", () => {
    // Tout ce qui ressemble a du HTML reste du texte : c'est ce qui rend le
    // rendu sur par construction, sans desinfection a chaque lecture.
    const kinds = new Set(
      parseRichText("<script>alert(1)</script> <b>x</b>")
        .flatMap((b) => (b.kind === "paragraph" ? b.spans : b.items.flat()))
        .map((s) => s.kind),
    );
    expect([...kinds]).toEqual(["text"]);
  });
});

describe("texte nu", () => {
  it("retire les marques", () => {
    expect(richTextToPlain("avant **le 12** svp")).toBe("avant le 12 svp");
  });

  it("ecrit les puces avec un rond", () => {
    expect(richTextToPlain("- GEP\n- budget")).toBe("• GEP\n• budget");
  });
});

describe("boutons de mise en forme", () => {
  it("entoure la selection", () => {
    expect(applyMark("relancer le MoF", 9, 15, "bold")).toEqual({
      value: "relancer **le MoF**",
      start: 11,
      end: 17,
    });
  });

  it("BASCULE : re-cliquer retire la marque", () => {
    expect(applyMark("relancer **le MoF**", 9, 19, "bold")).toEqual({
      value: "relancer le MoF",
      start: 9,
      end: 15,
    });
  });

  it("place le curseur entre les marques quand rien n'est selectionne", () => {
    expect(applyMark("ab", 1, 1, "italic")).toEqual({ value: "a**b", start: 2, end: 2 });
  });

  it("la puce s'applique a la LIGNE entiere, pas au mot selectionne", () => {
    expect(applyMark("GEP\nbudget", 5, 7, "bullet").value).toBe("GEP\n- budget");
  });

  it("re-cliquer la puce la retire", () => {
    expect(applyMark("- GEP\n- budget", 0, 14, "bullet").value).toBe("GEP\nbudget");
  });
});
