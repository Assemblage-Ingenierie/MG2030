import { describe, expect, it } from "vitest";
import { buildRoadmapQuery, nextSort, parseRoadmapParams, toggle } from "../url";

describe("lecture de l'URL", () => {
  it("rend l'etat par defaut sur une URL vide", () => {
    const p = parseRoadmapParams({});
    expect(p.view).toBe("list");
    expect(p.filters.priorities).toEqual([]);
    expect(p.filters.date).toBe("all");
    expect(p.sort).toEqual({ column: null, direction: "asc" });
  });

  it("lit une multi-selection separee par des virgules", () => {
    const p = parseRoadmapParams({ priority: "urgent,high", status: "blocked" });
    expect(p.filters.priorities).toEqual(["urgent", "high"]);
    expect(p.filters.statuses).toEqual(["blocked"]);
  });

  it("ECARTE une valeur inconnue au lieu de filtrer dessus", () => {
    // Sinon un parametre bricole rendrait une liste vide sans explication.
    const p = parseRoadmapParams({ priority: "urgent,inexistant" });
    expect(p.filters.priorities).toEqual(["urgent"]);
  });

  it("accepte un assignataire LIBRE, qu'aucune liste ne contient", () => {
    const p = parseRoadmapParams({ assignee: "G8,Alban" });
    expect(p.filters.assignees).toEqual(["G8", "Alban"]);
  });

  it("ignore une colonne de tri inconnue", () => {
    expect(parseRoadmapParams({ sort: "couleur" }).sort.column).toBeNull();
  });

  it("lit le sens du tri", () => {
    expect(parseRoadmapParams({ sort: "priority", dir: "desc" }).sort).toEqual({
      column: "priority",
      direction: "desc",
    });
  });
});

describe("construction de l'URL", () => {
  const base = parseRoadmapParams({});

  it("n'ecrit RIEN quand tout vaut son defaut", () => {
    // Deux liens designant la meme vue doivent avoir la meme adresse.
    expect(buildRoadmapQuery(base)).toBe("/roadmap");
  });

  it("n'ecrit pas les valeurs par defaut explicites", () => {
    expect(buildRoadmapQuery(base, { view: "list", date: "all" })).toBe("/roadmap");
  });

  it("CONSERVE les autres filtres quand on en change un", () => {
    // Le defaut de conception a eviter : poser un filtre effacait les autres.
    const current = parseRoadmapParams({ priority: "urgent", view: "timeline" });
    const url = buildRoadmapQuery(current, { statuses: ["blocked"] });
    expect(url).toContain("priority=urgent");
    expect(url).toContain("status=blocked");
    expect(url).toContain("view=timeline");
  });

  it("efface un filtre quand on lui donne une liste vide", () => {
    const current = parseRoadmapParams({ priority: "urgent" });
    expect(buildRoadmapQuery(current, { priorities: [] })).toBe("/roadmap");
  });

  it("la liste des archives voyage dans l'URL", () => {
    const current = parseRoadmapParams({ archived: "1" });
    expect(current.archived).toBe(true);
    expect(buildRoadmapQuery(current)).toBe("/roadmap?archived=1");
    expect(buildRoadmapQuery(current, { archived: false })).toBe("/roadmap");
  });

  it("fait l'aller-retour sans rien perdre", () => {
    const current = parseRoadmapParams({
      view: "timeline",
      archived: "1",
      priority: "urgent,high",
      status: "blocked",
      assignee: "AFD",
      date: "dated",
      completed: "1",
      sort: "status",
      dir: "desc",
    });
    const url = buildRoadmapQuery(current);
    const again = parseRoadmapParams(
      Object.fromEntries(new URLSearchParams(url.split("?")[1])),
    );
    expect(again).toEqual(current);
  });
});

describe("cycle de tri d'une colonne", () => {
  it("premier clic : croissant", () => {
    expect(nextSort({ column: null, direction: "asc" }, "priority")).toEqual({
      column: "priority",
      direction: "asc",
    });
  });

  it("deuxieme clic : decroissant", () => {
    expect(nextSort({ column: "priority", direction: "asc" }, "priority")).toEqual({
      column: "priority",
      direction: "desc",
    });
  });

  it("TROISIEME clic : retour a l'ordre par defaut", () => {
    // Sans ce troisieme etat, on ne peut plus revenir a l'ordre metier une fois
    // qu'on a trie.
    expect(nextSort({ column: "priority", direction: "desc" }, "priority")).toEqual({
      column: null,
      direction: "asc",
    });
  });

  it("changer de colonne repart en croissant", () => {
    expect(nextSort({ column: "priority", direction: "desc" }, "status")).toEqual({
      column: "status",
      direction: "asc",
    });
  });
});

describe("coche d'un filtre multiple", () => {
  it("ajoute une valeur absente", () => {
    expect(toggle(["urgent"], "high")).toEqual(["urgent", "high"]);
  });

  it("retire une valeur presente", () => {
    expect(toggle(["urgent", "high"], "urgent")).toEqual(["high"]);
  });

  it("ne modifie pas le tableau d'origine", () => {
    const values = ["urgent"];
    toggle(values, "high");
    expect(values).toEqual(["urgent"]);
  });
});
