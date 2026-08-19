// ============================================================
// scripts/check-service-key.mjs — garde-fou de la clé de service.
//
// La clé de service CONTOURNE LA RLS. Le brief §8 veut que les droits soient
// « mis en œuvre par RLS Postgres, jamais par filtrage applicatif seul ». Une
// seule route y échappe légitimement : l'évaluation périodique des retards, qui
// n'a pas de session utilisateur (voir lib/supabase/service.ts).
//
// Ce script échoue le build si un autre fichier l'importe ou lit la variable.
// Sans lui, le prochain « juste pour cette requête qui ne passe pas » ferait
// tomber la garantie de sécurité de tout le projet — et personne ne le verrait,
// parce que ça marcherait.
//
// Usage : node scripts/check-service-key.mjs
// ============================================================

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCANNED = ["app", "components", "lib", "scripts"];

/** Les seuls fichiers autorisés à toucher au rôle de service. */
const ALLOWED = new Set([
  "lib/supabase/service.ts",
  "app/api/cron/schedule-checks/route.ts",
  "scripts/check-service-key.mjs",
]);

const PATTERNS = [
  { re: /SUPABASE_SERVICE_ROLE_KEY/, what: "lecture de la clé de service" },
  { re: /createServiceClient/, what: "usage du client à rôle de service" },
  { re: /service_role/, what: "mention du rôle service_role" },
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "node_modules" && !entry.startsWith(".")) walk(full, out);
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];

for (const file of SCANNED.flatMap((d) => walk(join(ROOT, d)))) {
  const rel = relative(ROOT, file).split(sep).join("/");
  if (ALLOWED.has(rel)) continue;

  const source = readFileSync(file, "utf8");
  source.split("\n").forEach((line, index) => {
    for (const { re, what } of PATTERNS) {
      if (re.test(line)) {
        violations.push({ file: rel, line: index + 1, what, text: line.trim() });
      }
    }
  });
}

if (violations.length === 0) {
  console.log("cle de service : confinee aux 2 fichiers autorises.");
  process.exit(0);
}

console.error(`cle de service : ${violations.length} usage(s) hors perimetre.\n`);
console.error(
  "La cle de service CONTOURNE la RLS. Seule l'evaluation periodique des retards\n" +
    "y a droit, faute de session utilisateur (lib/supabase/service.ts).\n",
);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.what}]\n    ${v.text}`);
}
console.error(
  "\nSi un nouvel usage est VRAIMENT justifie, ajoutez le fichier a ALLOWED dans\n" +
    "scripts/check-service-key.mjs — et expliquez pourquoi dans docs/GAPS.md.",
);
process.exit(1);
