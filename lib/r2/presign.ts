import "server-only";

// ============================================================
// lib/r2/presign.ts — URL pré-signées Cloudflare R2 (API S3), sans SDK.
//
// POURQUOI PAS `@aws-sdk/client-s3` : le paquet et son signataire pèsent
// plusieurs mégaoctets pour un besoin qui tient en une signature SigV4. Le
// brief §4 proscrit « toute dépendance lourde sans validation préalable », et
// une signature HMAC-SHA256 est du code stable, spécifié une fois pour toutes.
//
// L'upload se fait EN DIRECT depuis le navigateur vers R2 (brief §4) : le
// fichier ne traverse jamais une fonction serveur, dont la charge utile est
// limitée. Le serveur ne délivre qu'une URL signée, à durée courte.
//
// Les secrets restent côté serveur : ce module est `server-only`.
// ============================================================

import { createHash, createHmac } from "node:crypto";
import { contentDisposition, encodeRfc3986 } from "./content-disposition";

export { contentDisposition };

const SERVICE = "s3";
const REGION = "auto"; // R2 n'a qu'une région logique.
const ALGORITHM = "AWS4-HMAC-SHA256";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /**
   * Juridiction du bucket, ou `null` pour le point d'entrée par défaut.
   *
   * ⚠ DISTINCTE de l'indice de localisation proposé à la création d'un
   * bucket. Un bucket créé sous une juridiction (EU, FedRAMP) vit sur un
   * point d'entrée SÉPARÉ — `<compte>.eu.r2.cloudflarestorage.com` et non
   * `<compte>.r2.cloudflarestorage.com`. Interroger le mauvais point d'entrée
   * ne renvoie pas « juridiction incorrecte » mais une erreur qui se lit
   * comme un problème de CORS ou de droits, sans rapport avec la cause
   * réelle — c'est ce qui a trompé le diagnostic la première fois.
   */
  jurisdiction: string | null;
}

/** Configuration R2, ou `null` si absente. */
export function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, jurisdiction: process.env.R2_JURISDICTION || null };
}

const sha256Hex = (data: string): string => createHash("sha256").update(data, "utf8").digest("hex");
const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac("sha256", key).update(data, "utf8").digest();

/** Chemin d'objet : chaque segment encodé, les barres obliques conservées. */
const encodeKey = (key: string): string => key.split("/").map(encodeRfc3986).join("/");

export type Method = "PUT" | "GET" | "DELETE";

/**
 * URL pré-signée pour un objet.
 *
 * @param expiresIn durée de validité, en secondes. Volontairement COURTE :
 *   une URL de téléchargement est un droit d'accès transportable, qui échappe
 *   à la RLS une fois émis. Défaut 5 minutes ; ne pas dépasser l'heure.
 * @param responseParams Paramètres de réponse S3 standard
 *   (`response-content-disposition`, `response-content-type`…). Ils font
 *   partie de la requête SIGNÉE — R2 les applique à la réponse GET sans
 *   jamais toucher aux métadonnées stockées sur l'objet. C'est ce qui permet
 *   de servir le MÊME objet en aperçu (`inline`) ou en téléchargement
 *   (`attachment`, nom nettoyé) sans le réécrire.
 */
export function presignUrl(
  config: R2Config,
  method: Method,
  objectKey: string,
  expiresIn = 300,
  extraHeaders: Record<string, string> = {},
  responseParams: Record<string, string> = {},
): string {
  if (expiresIn < 1 || expiresIn > 3600) {
    throw new Error("La duree de validite doit etre comprise entre 1 et 3600 secondes.");
  }

  const host = config.jurisdiction
    ? `${config.accountId}.${config.jurisdiction}.r2.cloudflarestorage.com`
    : `${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucket}/${encodeKey(objectKey)}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // AAAAMMJJTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  // `host` est toujours signé ; les en-têtes supplémentaires (type MIME,
  // longueur) le sont aussi pour que R2 refuse un contenu substitué.
  const headers: Record<string, string> = { host, ...extraHeaders };
  const sortedHeaderNames = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort();
  const canonicalHeaders = sortedHeaderNames
    .map((name) => {
      const value = Object.entries(headers).find(([k]) => k.toLowerCase() === name)![1];
      return `${name}:${String(value).trim()}\n`;
    })
    .join("");
  const signedHeaders = sortedHeaderNames.join(";");

  const query = new URLSearchParams({
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${config.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
    ...responseParams,
  });

  // La chaîne de requête canonique est triée par clé, en encodage RFC 3986.
  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join("&");

  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), REGION), SERVICE),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/**
 * Clé d'objet R2.
 *
 * Forme : `mg2030/<dossier>/<uuid>-<nom nettoyé>`.
 *
 * L'UUID est là pour que deux dépôts du même nom ne se remplacent pas — le cas
 * arrive tout le temps avec « rapport.pdf ». Le nom d'origine est conservé
 * derrière pour que la clé reste lisible dans la console R2, et le nom exact
 * est de toute façon stocké dans `mg2030_document.original_filename`.
 *
 * Le préfixe `mg2030/` isole l'application : le bucket peut être partagé.
 *
 * ⚠ CET UUID NE DOIT JAMAIS APPARAÎTRE À L'UTILISATEUR. La clé sert à nommer
 * l'objet dans R2, pas à nommer le fichier téléchargé — c'est le rôle de
 * `contentDisposition()`, qui renvoie `original_filename` tel que déposé.
 */
export function buildObjectKey(folderPath: string, filename: string): string {
  const safeFolder = folderPath
    .split("/")
    .map((s) => s.replace(/[^A-Za-z0-9._-]/g, "_"))
    .filter(Boolean)
    .join("/");
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return `mg2030/${safeFolder}/${crypto.randomUUID()}-${safeName}`;
}
