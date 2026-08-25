"use client";

// ============================================================
// components/map/site-map.tsx — carte des 14 sites, Leaflet + OpenStreetMap.
//
// ⚠ SEULE BIBLIOTHÈQUE EXTERNE DE L'APPLICATION. Le brief §4 proscrit toute
// dépendance lourde sans validation préalable ; le Gantt et le plan de charge
// sont du SVG fait main précisément pour cette raison. Ici, la décision
// inverse a été prise EXPRÈS (validée le 25/08/2026) : une carte sans fond
// réel — sans rues, sans repères de Pristina — perd l'essentiel de ce qui la
// rend utile. Voir docs/GAPS.md.
//
// Leaflet manipule le DOM directement (pas de rendu React déclaratif), d'où
// le montage impératif dans un effet, sur un conteneur vide. C'est le patron
// d'intégration standard de la bibliothèque — aucune enveloppe React autour
// n'apporterait rien, elle ne ferait que dupliquer ce que Leaflet fait déjà.
// ============================================================

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapSite {
  id: string;
  siteCode: string;
  name: string;
  subproject: "athletes_village" | "training_venues";
  latitude: number;
  longitude: number;
  buildingCount: number;
}

/** Repère en losange coloré, cohérent avec le losange des jalons du Gantt. */
function markerHtml(color: string): string {
  return (
    `<div style="width:16px;height:16px;background:${color};border:2px solid #fff;` +
    `border-radius:3px;transform:rotate(45deg);box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`
  );
}

export function SiteMap({
  sites,
  labels,
}: {
  sites: MapSite[];
  labels: { athletesVillage: string; trainingVenues: string; buildings: string };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || sites.length === 0) return;

    let map: LeafletMap;
    let cancelled = false;

    // Import dynamique : Leaflet touche `window` au chargement du module, ce
    // qui casse le rendu serveur si le module est importé au niveau du
    // fichier plutôt qu'à l'intérieur d'un effet côté client.
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      const bounds: [number, number][] = sites.map((s) => [s.latitude, s.longitude]);
      map = L.map(containerRef.current, { scrollWheelZoom: true }).fitBounds(bounds, {
        padding: [40, 40],
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      for (const site of sites) {
        const color =
          site.subproject === "athletes_village" ? "var(--accent-2)" : "var(--accent)";
        const icon = L.divIcon({
          html: markerHtml(color),
          className: "",
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const subprojectLabel =
          site.subproject === "athletes_village" ? labels.athletesVillage : labels.trainingVenues;

        L.marker([site.latitude, site.longitude], { icon })
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(site.siteCode)}</strong> — ${escapeHtml(site.name)}<br/>` +
              `<span style="color:#6b7280">${escapeHtml(subprojectLabel)} · ` +
              `${site.buildingCount} ${escapeHtml(labels.buildings)}</span>`,
          );
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // `sites` ne change pas après le premier rendu de cette page (chargement
    // serveur) : le montage Leaflet est fait une seule fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[70vh] w-full overflow-hidden rounded-lg border border-[var(--border)]"
      style={{ background: "var(--app-bg)" }}
    />
  );
}

/** Échappement minimal : les popups Leaflet reçoivent du HTML brut. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
