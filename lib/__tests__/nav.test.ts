import { describe, expect, it } from "vitest";
import { HIDEABLE_HREFS, NAV, hiddenRouteFor, visibleNav } from "../nav";

const audience = (over: Partial<Parameters<typeof visibleNav>[0]> = {}) =>
  visibleNav({ isAdmin: false, isTa: false, hidden: new Set(), ...over });

const hrefs = (groups: ReturnType<typeof visibleNav>) =>
  groups.flatMap((g) => g.items.map((i) => i.href));

describe("menu visible", () => {
  it("montre les onglets ordinaires a un compte sans privilege", () => {
    expect(hrefs(audience())).toContain("/roadmap");
  });

  it("cache les ecrans d'administration a qui n'est pas administrateur", () => {
    expect(hrefs(audience())).not.toContain("/admin/users");
    expect(hrefs(audience({ isAdmin: true }))).toContain("/admin/users");
  });

  it("cache l'ecran interne hors assistance technique", () => {
    expect(hrefs(audience())).not.toContain("/design-system");
    expect(hrefs(audience({ isTa: true }))).toContain("/design-system");
  });

  it("retire un onglet masque", () => {
    const got = audience({ hidden: new Set(["/procurement"]) });
    expect(hrefs(got)).not.toContain("/procurement");
  });

  it("GARDE l'onglet masque pour l'administrateur, et le marque", () => {
    // Sinon il ne pourrait plus ouvrir le module qu'il est en train de finir,
    // ni revenir en arriere apres avoir masque l'ecran des onglets lui-meme.
    const got = visibleNav({
      isAdmin: true,
      isTa: false,
      hidden: new Set(["/procurement"]),
    });
    const item = got.flatMap((g) => g.items).find((i) => i.href === "/procurement");
    expect(item?.hidden).toBe(true);
  });

  it("fait disparaitre un groupe vide plutot qu'un intertitre seul", () => {
    const all = new Set(NAV.flatMap((g) => g.items).map((i) => i.href));
    const got = visibleNav({ isAdmin: false, isTa: false, hidden: all });
    expect(got.every((g) => g.items.length > 0)).toBe(true);
    // Le tableau de bord n'est pas masquable : il reste, donc un groupe reste.
    expect(hrefs(got)).toEqual(["/"]);
  });
});

describe("routes masquables", () => {
  it("n'offre JAMAIS de masquer un ecran d'administration", () => {
    // Masquer celui des onglets retirerait le seul moyen de revenir en arriere.
    expect(HIDEABLE_HREFS).not.toContain("/admin/navigation");
    expect(HIDEABLE_HREFS).not.toContain("/admin/users");
  });

  it("n'offre pas de masquer la racine", () => {
    expect(HIDEABLE_HREFS).not.toContain("/");
  });
});

describe("route courante masquee", () => {
  const hidden = new Set(["/procurement"]);

  it("reconnait l'onglet lui-meme", () => {
    expect(hiddenRouteFor("/procurement", hidden)).toBe("/procurement");
  });

  it("reconnait une page FILLE : un signet profond passerait sinon", () => {
    expect(hiddenRouteFor("/procurement/plans/3", hidden)).toBe("/procurement");
  });

  it("laisse passer une route voisine au nom proche", () => {
    expect(hiddenRouteFor("/procurement-notes", hidden)).toBeNull();
  });

  it("ne bloque rien quand rien n'est masque", () => {
    expect(hiddenRouteFor("/procurement", new Set())).toBeNull();
  });

  it("IGNORE la racine, qui prefixe tout le reste", () => {
    // Masquer « / » rendrait toute l'application inaccessible.
    expect(hiddenRouteFor("/roadmap", new Set(["/"]))).toBeNull();
  });
});
