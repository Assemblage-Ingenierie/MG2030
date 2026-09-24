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

      const placed: { site: MapSite; marker: import("leaflet").Marker; side: Side }[] = [];

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

        const marker = L.marker([site.latitude, site.longitude], { icon })
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(site.siteCode)}</strong> — ${escapeHtml(site.name)}<br/>` +
              `<span style="color:#6b7280">${escapeHtml(subprojectLabel)} · ` +
              `${site.buildingCount} ${escapeHtml(labels.buildings)}</span>`,
          );
        bindLabel(marker, site, "right");
        placed.push({ site, marker, side: "right" });
      }

      // Nom du site affiché EN PERMANENCE à côté du repère : sans lui, il
      // fallait cliquer chaque losange pour savoir de quel site il s'agit.
      //
      // ÉVITEMENT DES CHEVAUCHEMENTS. Les salles du centre de Pristina sont à
      // quelques centaines de mètres les unes des autres : toutes les
      // étiquettes à droite se recouvraient. Chaque étiquette essaie donc, dans
      // l'ordre, droite, gauche, dessus, dessous, et prend la première place
      // libre — étiquettes déjà posées ET repères compris. Recalculé à chaque
      // zoom, puisque les distances à l'écran changent avec lui.
      const layout = () => {
        const taken: Box[] = placed.map(({ marker }) => {
          const p = map.latLngToContainerPoint(marker.getLatLng());
          return { x: p.x - 9, y: p.y - 9, w: 18, h: 18 };
        });
        // De l'ouest vers l'est : les sites du bord gauche gardent la droite,
        // ceux qu'ils gênent basculent à gauche.
        const order = [...placed].sort(
          (a, b) => a.site.longitude - b.site.longitude || b.site.latitude - a.site.latitude,
        );
        for (const entry of order) {
          const p = map.latLngToContainerPoint(entry.marker.getLatLng());
          const el = entry.marker.getTooltip()?.getElement();
          const w = el?.offsetWidth || entry.site.name.length * 6.5 + 14;
          const h = el?.offsetHeight || 22;
          const candidates = SIDES.map((side) => ({ side, box: labelBox(side, p, w, h) }));
          const scored = candidates.map((c) => ({
            ...c,
            overlap: taken.reduce((sum, t) => sum + overlapArea(c.box, t), 0),
          }));
          const best = scored.find((c) => c.overlap === 0) ?? scored.sort((a, b) => a.overlap - b.overlap)[0];
          taken.push(best.box);
          if (best.side !== entry.side) {
            entry.marker.unbindTooltip();
            bindLabel(entry.marker, entry.site, best.side);
            entry.side = best.side;
          }
        }
      };
      layout();
      map.on("zoomend", layout);
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

type Side = "right" | "left" | "top" | "bottom";
const SIDES: Side[] = ["right", "left", "top", "bottom"];
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Décalage de l'étiquette par rapport au repère, selon le côté. */
const OFFSET: Record<Side, [number, number]> = {
  right: [10, 0],
  left: [-10, 0],
  top: [0, -10],
  bottom: [0, 10],
};

function bindLabel(marker: import("leaflet").Marker, site: MapSite, side: Side) {
  marker.bindTooltip(escapeHtml(site.name), {
    permanent: true,
    direction: side,
    offset: OFFSET[side],
  });
}

/** Rectangle qu'occuperait l'étiquette, en pixels d'écran. */
function labelBox(side: Side, p: { x: number; y: number }, w: number, h: number): Box {
  switch (side) {
    case "right":
      return { x: p.x + 10, y: p.y - h / 2, w, h };
    case "left":
      return { x: p.x - 10 - w, y: p.y - h / 2, w, h };
    case "top":
      return { x: p.x - w / 2, y: p.y - 10 - h, w, h };
    case "bottom":
      return { x: p.x - w / 2, y: p.y + 10, w, h };
  }
}

function overlapArea(a: Box, b: Box): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

/** Échappement minimal : les popups Leaflet reçoivent du HTML brut. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
