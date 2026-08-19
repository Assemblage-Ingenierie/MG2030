# UI_TOKENS — charte extraite de `peeb-cool-santafe`

> Source : dépôt local `C:\Users\cleme\github\peeb-cool-santafe` (Next 16 / React 19 /
> Tailwind v4). Extraction faite sur `lib/constants.ts` (source unique déclarée des
> couleurs), `app/globals.css`, `app/layout.tsx` et l'inventaire des classes
> utilitaires réellement employées dans `components/` et `app/`.
>
> **Ce document consigne les tokens et le style, pas les dépendances.** La
> compatibilité avec la stack MG2030 est traitée au §9.

---

## 1. Principe d'architecture, repris tel quel

Le dépôt de charte n'utilise **aucune bibliothèque de composants**. La charte tient
en trois mécanismes, à reprendre à l'identique :

1. **Un fichier TypeScript unique** (`lib/constants.ts`) porte toutes les couleurs.
   Commentaire en tête : « SOURCE UNIQUE des couleurs et libellés. Aucune couleur de
   marque ne doit être écrite en dur ailleurs. »
2. **Des variables CSS posées en `style` sur `<body>`** depuis ce fichier
   (`themeVars`, `app/layout.tsx`). Pas de `:root` en CSS : le TypeScript reste la
   source, le CSS n'en est que le miroir.
3. **Les composants ne consomment que `var(--token)`** via les classes arbitraires
   Tailwind : `bg-[var(--surface)]`, `text-[var(--text-muted)]`,
   `border-[var(--border)]`. Une couleur littérale dans un composant est une
   anomalie ; les rares exceptions du dépôt source sont commentées comme telles.

À reprendre pour MG2030 : `lib/tokens.ts` → `themeVars` → `<body style={themeVars}>`.

---

## 2. Couleurs de surface (UI neutre)

Reprises **inchangées**. Ce sont les tokens structurels, indépendants de tout projet.

| Token CSS | Valeur | Rôle |
|---|---|---|
| `--app-bg` | `#f3f4f6` | Fond d'application (gris clair) ; fond des champs de saisie |
| `--surface` | `#ffffff` | Cartes, tableaux, en-têtes collants, popovers, modales |
| `--border` | `#e4e6eb` | Toutes les bordures et séparateurs 1 px |
| `--text` | `#272a33` | Texte principal |
| `--text-muted` | `#646b78` | Texte secondaire, en-têtes, placeholders |
| `--focus` | `#3c78d8` | Anneau et bordure de focus clavier |
| `--accent` | **`#034ea2`** | Marque / élément actif — bleu institutionnel kosovar (remplace le `#E30513` d'Assemblage) |
| `--accent-2` | **`#d0a650`** | Or institutionnel — soulignés, jalons du Gantt, mise en valeur secondaire |
| `--danger` | **`#c0392b`** | Erreur, action destructrice. Distinct de l'accent, qui n'est plus rouge |
| `--ok` | `#38761d` | Action positive (accorder, valider) |

### Sidebar (palette sombre dédiée)

| Token CSS | Valeur | Rôle |
|---|---|---|
| `--sidebar-bg` | `#30323e` | Fond de la navigation latérale |
| `--sidebar-text` | `#e8e9ed` | Texte de l'item actif |
| `--sidebar-text-muted` | `#9aa1ad` | Texte des items inactifs |
| `--sidebar-active` | `rgba(255,255,255,0.10)` | Fond de l'item actif |
| `--sidebar-hover` | `rgba(255,255,255,0.05)` | Survol |
| `--sidebar-border` | `rgba(255,255,255,0.08)` | Séparateurs internes |

### Palette institutionnelle MG2030 — ✅ tranchée le 19/08/2026

Extraite **du fichier vectoriel officiel** de l'emblème de la République du Kosovo
(`assets/logos/kosovo-emblem.svg`), pas d'une capture. Ces valeurs sont exactes :

| Rôle dans l'emblème | Valeur | Emploi proposé dans l'interface |
|---|---|---|
| Champ et contour | **`#034ea2`** | **`--accent`** — marque et élément actif |
| Bordure et carte du Kosovo | **`#d0a650`** | **`--accent-2`** — soulignés, jalons du Gantt, mise en valeur secondaire |
| Six étoiles | `#ffffff` | Texte sur accent |

Le logo *XXI Mediterranean Games Prishtina 2030* reprend la même famille (bleu
institutionnel + or), ce qui rend la substitution cohérente. Son vectoriel
n'étant pas disponible, le header porte un bloc de marque typographique (§8).

> **Ce que cela change par rapport à la charte source.** Sur PEEB Santa Fe,
> `--accent` vaut `#E30513`, le rouge **Assemblage** (le prestataire). Le
> transposer tel quel à MG2030 ferait porter l'identité visuelle du prestataire
> à une plateforme du ministère kosovar. Le bleu `#034ea2` déplace l'accent sur
> le **maître d'ouvrage**, ce qui est l'usage attendu — Assemblage restant
> présent par son logo en sidebar, comme sur le projet source.
>
> **Conséquence obligatoire** : l'accent n'étant plus rouge, l'erreur ne peut
> plus le réutiliser. Un token `--danger` distinct devient **nécessaire**, pas
> seulement souhaitable (§10.2).

### Palette d'état (pastels)

Reprise pour le **sens**, pas pour les codes métier (les composantes PEEB n'existent
pas dans MG2030). Ces quatre teintes forment la famille d'états à réutiliser :

| Sens | Fond | Texte dessus |
|---|---|---|
| En cours | `#ffd966` | `#272a33` |
| Terminé | `#b6d7a8` | `#272a33` |
| En retard | `#ea9999` | `#272a33` |
| Non commencé (rail) | `#e6e8ec` | — |

Règle explicite du dépôt source : le rouge « en retard » est un **rouge pastel clair**
(`#ea9999`), volontairement peu agressif, et **distinct** du rouge de marque.

### Palette du Gantt (`lib/cronograma/cronograma-svg.ts`)

| Rôle | Valeur |
|---|---|
| Bande de section | `#eceef2` |
| Grille fine | `#e6e8ec` |
| Grille forte (mois / trimestre) | `#d5d9df` |
| Texte du Gantt | `#1f2733` |
| Texte secondaire | `#6b7280` |
| Dates atténuées | `#a3a8b2` |
| Repère « aujourd'hui » | `#d4351f` |
| Barre neutre (gestion de projet) | `#808080` |

---

## 3. Typographie

**Aucune police téléchargée.** Pile système déclarée dans `@theme` de `globals.css` :

```css
--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, "Noto Sans", sans-serif;
```

Le `<body>` applique `-webkit-font-smoothing: antialiased` et
`text-rendering: optimizeLegibility`.

> Conséquence pour MG2030 : cette pile couvre les diacritiques albanais (`ë`, `ç`)
> sur Windows et macOS sans rien ajouter ; `Noto Sans` couvre Linux en repli.
> **Ne pas introduire de webfont.**

### Échelle observée (fréquence réelle dans le dépôt)

| Taille | Occurrences | Usage constaté |
|---|---|---|
| `text-sm` — 14 px | 213 | **Taille de base de l'interface** : champs, boutons, cellules, libellés |
| `text-xs` — 12 px | 110 | En-têtes de tableau, légendes, métadonnées, badges |
| `text-[11px]` | 35 | En-têtes de colonne compactes, tableau dense |
| `text-[10px]` | 26 | Étiquettes du Gantt |
| `text-base` — 16 px | 22 | Corps de texte long |
| `text-xl` — 20 px | 11 | Titres de page |
| `text-[13px]` | 10 | Panneaux latéraux denses (fiches du cronograma) |
| `text-lg` — 18 px | 9 | Titre de carte de connexion |
| `text-2xl` — 24 px | 1 | Exceptionnel |

**Échelle à figer pour MG2030** (les valeurs anecdotiques sont retirées) :

| Token | px | Emploi |
|---|---|---|
| `--fs-2xs` | 10 | Étiquettes du Gantt uniquement |
| `--fs-xs` | 11 | Tableaux denses, en-têtes de colonne |
| `--fs-sm` | 12 | Légendes, métadonnées, badges |
| `--fs-md` | 14 | **Défaut de l'interface** |
| `--fs-lg` | 16 | Corps de texte, intitulés de section |
| `--fs-xl` | 18 | Titres de carte / modale |
| `--fs-2xl` | 20 | Titre de page |

### Graisses

`400` normal (rare : 6 occurrences) · `500` medium (108) · `600` semibold (111) ·
`700` bold (15, réservé aux badges-lettres). Rien au-delà de 700.

Règle observée : un item de navigation **inactif** est `font-medium`, **actif** est
`font-semibold`. Un en-tête de tableau est `font-semibold` (groupe de colonnes) ou
`font-medium` (colonne). `tracking-tight` sur les titres ;
`uppercase tracking-wide` sur les en-têtes de tableau clairs.

---

## 4. Rayons, ombres, bordures

### Rayons

| Classe | Valeur | Occurrences | Usage |
|---|---|---|---|
| `rounded-md` | 6 px | 122 | **Défaut** : boutons, champs, items de nav, popovers |
| `rounded-lg` | 8 px | 36 | Conteneurs : tableau encadré, panneau flottant |
| `rounded-full` | ∞ | 22 | Pastilles, interrupteurs, barres de progression |
| `rounded-sm` | 2 px | 15 | Cellule en cours d'édition dans un tableau |
| `rounded-xl` | 12 px | 7 | Cartes de page pleine (connexion) et modales |

Tokens à figer : `--radius-xs: 2px`, `--radius-sm: 4px`, `--radius-md: 6px`,
`--radius-lg: 8px`, `--radius-xl: 12px`, `--radius-full: 9999px`.

### Ombres

Usage volontairement pauvre : l'élévation passe par la bordure, pas par l'ombre.

| Classe | Occurrences | Usage |
|---|---|---|
| `shadow-sm` | 12 | Carte de page, onglet actif d'un segmented control |
| `shadow-lg` | 5 | Menus déroulants, popovers rendus en portail |
| `shadow-xl` | 7 | Modales, tiroir mobile, fiches flottantes du Gantt |
| `shadow-md` | 1 | Anecdotique |

Règle : **une surface posée dans le flux n'a pas d'ombre**, seulement
`border border-[var(--border)]`. L'ombre est réservée à ce qui flotte au-dessus.

### Bordures

Toujours 1 px, toujours `var(--border)`. Les tableaux denses utilisent
`border-collapse` avec une bordure sur chaque cellule ; les tableaux de liste
utilisent une seule `border-b` par ligne.

---

## 5. Espacement

Base 4 px (échelle Tailwind par défaut, non modifiée).

| Classe | Occurrences | Usage |
|---|---|---|
| `gap-2` (8 px) | 60 | **Défaut** entre éléments d'une ligne |
| `gap-3` (12 px) | 35 | Groupes de champs, logos |
| `gap-1.5` (6 px) | 32 | Éléments serrés (badges) |
| `gap-4` (16 px) | 17 | Grilles de formulaire |
| `px-3` / `py-2` | 102 / 97 | **Rembourrage de contrôle standard** (champ, bouton, cellule) |
| `px-2` / `py-1.5` | 57 / 65 | Contrôle compact, cellule de tableau dense |
| `px-4` | 63 | Bouton large |
| `p-8` | — | Carte de page pleine (connexion) |

---

## 6. Composants — spécifications reprises littéralement

### Bouton primaire

```
rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white
transition-opacity hover:opacity-90 disabled:opacity-60
```

### Bouton secondaire

```
rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium
text-[var(--text)] transition-colors hover:bg-[var(--app-bg)]
```

### Bouton discret (barre d'outils)

```
inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium
text-[var(--text-muted)] transition-colors hover:bg-[var(--app-bg)] hover:text-[var(--text)]
```

### Bouton icône

```
inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)]
transition-colors hover:bg-[var(--app-bg)] hover:text-[var(--text)]
```

### Champ de saisie

```
w-full rounded-md border border-[var(--border)] bg-[var(--app-bg)] px-3 py-2
text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--focus)]
```

Deux variantes de focus coexistent dans le dépôt source :
`focus:ring-2 focus:ring-[var(--focus)]` (formulaires) et
`focus:border-[var(--focus)]` (tableaux éditables, où l'anneau déborderait sur la
cellule voisine). **Conserver les deux**, avec la règle : anneau en formulaire,
bordure en cellule.

### Étiquette de champ

```
block text-sm font-medium text-[var(--text)]
```

Une mention « (optionnel) » est en `font-normal text-[var(--text-muted)]`.

### Carte / conteneur

```
rounded-lg border border-[var(--border)] bg-[var(--surface)]
```

Carte de page pleine (connexion, écran d'attente) :
`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm`.

### Popover / menu déroulant

```
rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg
```

Rendu **en portail** (`createPortal`) pour échapper aux `overflow` des conteneurs.
Item de menu : `rounded px-2 py-1.5 text-sm hover:bg-[var(--app-bg)]`.

### Modale

Fond : `fixed inset-0 z-40 bg-black/40`.
Panneau : `w-full max-w-md overflow-hidden rounded-xl bg-[var(--surface)] shadow-xl`.

### Tableau de liste (en-tête clair)

```
Conteneur    : overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]
Barre outils : flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-2
En-tête      : border-b border-[var(--border)] bg-[var(--app-bg)] text-left text-xs
               font-semibold uppercase tracking-wide text-[var(--text-muted)]
th           : px-3 py-2
td           : px-3 py-1.5 align-middle
Vide         : px-3 py-10 text-center text-[var(--text-muted)]
Pied         : border-t border-[var(--border)] p-2  (bouton « ajouter »)
```

### Tableau de synthèse (en-tête sombre)

Employé pour les tableaux larges à groupes de colonnes :

```
Conteneur : resize-y overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]
thead     : sticky top-0 z-10
th groupe : whitespace-nowrap border px-2 py-1.5 text-center text-xs font-semibold
            fond #272a33 (var(--text)), texte var(--sidebar-text)
th colonne: border px-2 py-1.5 text-xs font-medium align-bottom
            fond #30323e (var(--sidebar-bg)), texte var(--sidebar-text-muted)
td        : whitespace-nowrap border border-[var(--border)] px-2 py-1.5
tr:hover  : bg-[var(--app-bg)]
```

Le tri se fait au clic sur l'en-tête, avec `aria-sort` renseigné.

### Cellule éditable (style tableur)

Lecture : `block w-full cursor-text px-3 py-2 text-left text-sm transition-colors
hover:bg-[var(--app-bg)]` — c'est un `<button>`, pas un `<input>`.
Édition : `block w-full rounded-sm border border-[var(--focus)] bg-[var(--surface)]
px-3 py-2 text-sm outline-none`.
Valeur vide : `—` en `text-[var(--text-muted)]`.
Champ non applicable : `text-[var(--text-muted)]` + `title` explicatif, non cliquable.

**C'est le patron à reprendre pour l'édition en ligne de la liste des tâches
(brief §9.4).** Il est déjà éprouvé sur des tableaux de plusieurs dizaines de
colonnes et n'a coûté aucune dépendance.

### Badge / pastille

```
inline-block rounded px-2 py-0.5 text-xs font-medium
```

avec `backgroundColor` et `color` passés en `style` depuis la palette d'état.

### Interrupteur

Piste : `relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
transition-colors`. Curseur : `inline-block h-4 w-4 rounded-full bg-white shadow
transition-transform`.

### Message d'erreur / de succès

```
mt-4 rounded-md px-3 py-2 text-sm
succès : bg-green-600/10 text-green-700
erreur : bg-[var(--accent)]/10 text-[var(--accent)]
```

> À revoir pour MG2030 : si l'accent change (§10), l'erreur doit rester rouge.
> Prévoir un token `--danger` distinct de `--accent`.

---

## 7. États

| État | Traitement |
|---|---|
| **Survol** | `hover:bg-[var(--app-bg)]` sur fond clair ; `hover:bg-[var(--sidebar-hover)]` sur fond sombre. Toujours avec `transition-colors` |
| **Focus clavier** | Global dans `globals.css` : `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 3px }` et `:focus:not(:focus-visible) { outline: none }`. Les contrôles ajoutent `focus:ring-2 focus:ring-[var(--focus)]` |
| **Actif (navigation)** | `bg-[var(--sidebar-active)]` + `font-semibold` + **liseré vertical `w-[3px]` en `var(--accent)`** collé au bord gauche + icône teintée en accent |
| **Actif (segmented control)** | `bg-[var(--surface)] text-[var(--text)] shadow-sm`, parfois `ring-1 ring-[var(--border)]` |
| **Désactivé** | `disabled:opacity-50` (majoritaire) ou `disabled:opacity-60` (boutons de formulaire) + `disabled:cursor-not-allowed`. Variante champ : `disabled:bg-[var(--app-bg)] disabled:text-[var(--text-muted)]` |
| **Erreur** | Aucun style de *champ* en erreur dans le dépôt source : l'erreur est un bandeau sous le formulaire. **À compléter pour MG2030** (bordure `--danger` + texte d'aide sous le champ) |
| **Chargement** | Le libellé du bouton est remplacé (« Ingresando… ») et le bouton passe `disabled`. Pas de spinner |
| **Vide** | `px-3 py-10 text-center text-[var(--text-muted)]` |
| **Mouvement réduit** | `@media (prefers-reduced-motion: reduce)` neutralise animations et transitions dans `globals.css`. **À reprendre tel quel** |

---

## 8. Mise en page applicative

```
Grille        : lg:grid lg:grid-cols-[248px_minmax(0,1fr)]
Sidebar       : 248 px en colonne de grille ; 264 px en tiroir mobile
                (fixed inset-y-0 left-0 z-50 ; -translate-x-full → translate-x-0 ;
                 transition-transform duration-200 ease-out ; shadow-xl)
Backdrop      : fixed inset-0 z-40 bg-black/40 lg:hidden
Bloc logo     : h-[72px] shrink-0, border-b, px-5 — aligné sur la hauteur du header
Header        : sticky top-0 z-20 min-h-[72px] border-b bg-[var(--surface)] px-4 py-2
                flex flex-wrap items-center gap-x-4 gap-y-2
Contenu       : main min-w-0 flex-1 px-4 py-6 sm:px-6
```

`min-w-0` sur la colonne de contenu est indispensable : sans lui, les tableaux larges
et le Gantt débordent sur la sidebar en fenêtre réduite. Le dépôt source le commente
explicitement.

### Logos

Le header porte les logos institutionnels à gauche (bailleur, puis maître d'ouvrage),
séparés par `<span class="h-9 w-px bg-[var(--border)]">`, hauteurs `h-[40px]` →
`sm:h-[44px]`. La sidebar porte le logo du prestataire en haut et un filigrane
décoratif en bas (`opacity-[0.06]`, `pointer-events-none`, `alt=""`).

Composition retenue pour MG2030 :

| Emplacement | Logo | Fichier | Statut |
|---|---|---|---|
| Header, à gauche | **AFD** (bailleur) | `public/logos/afd.png` | Repris du dépôt de charte |
| Header, après le séparateur | **République du Kosovo** (maître d'ouvrage, MYS) | `assets/logos/kosovo-emblem.svg` | **Fourni**, vectoriel, dans le dépôt |
| Header, à droite | **XXI Mediterranean Games Prishtina 2030** | `components/shell/brand-mark.tsx` | ⚠ Vectoriel indisponible → **bloc typographique**, remplaçable en un fichier |
| Sidebar, en haut | **Assemblage ingénierie** | `public/logos/assemblage.png` | Repris du dépôt de charte |
| Sidebar, filigrane bas | Sigle `.A` | `public/logos/assemblage-a.png` | Repris du dépôt de charte |

L'emblème du Kosovo étant en SVG, il se colore et se met à l'échelle sans perte —
préférable au PNG pour le filigrane comme pour le header.

---

## 9. Compatibilité avec la stack MG2030 — rien à signaler côté dépendances

Le brief (§5) demande de signaler toute bibliothèque de composants incompatible.
**Il n'y en a aucune.** Le dépôt de charte est déjà sur la stack imposée :

| | Dépôt de charte | Brief MG2030 | Verdict |
|---|---|---|---|
| Framework | Next 16.2.9 (App Router) | Next.js App Router | OK |
| React | 19.2.4 | — | OK |
| CSS | Tailwind v4 (`@tailwindcss/postcss`) | Tailwind | OK |
| Base / auth | `@supabase/ssr` + `supabase-js` | Supabase | OK |
| Bibliothèque UI | **aucune** | — | OK |
| Icônes | SVG inline (`components/icons.tsx`) | — | OK |

Deux dépendances du dépôt source ne sont **pas** à reprendre en version 1 :
`leaflet` / `react-leaflet` (carte, hors périmètre) et `exceljs` (export tableur, non
demandé). `server-only` (0 ko) est à reprendre.

### Ce que la charte apporte au-delà des couleurs

Deux briques du dépôt source répondent directement à des exigences du brief et
méritent d'être reprises comme **patrons** (pas copiées telles quelles — le modèle de
données diffère) :

- **`lib/schedule.ts`** — moteur de planification **pur**, sans dépendance DB ni
  React, partagé par deux vues pour qu'elles ne puissent pas diverger. Il ne stocke
  que les entrées (durée, ancre, liaisons) et calcule les dates à l'affichage.
  C'est exactement l'architecture attendue au brief §7.
- **`lib/cronograma/cronograma-svg.ts` + `components/cronograma/cronograma-client.tsx`**
  — **Gantt rendu en interne, en SVG, sans aucune bibliothèque** : échelles semaine /
  mois / trimestre, barres, jalons losanges, repère « aujourd'hui », export
  SVG / PNG / PDF. 2 975 lignes pour la vue écran, ~600 pour l'export.

  Géométrie à l'écran : `LABEL_W = 300`, `ROW_H = 28`, `CELL_W = 56`.
  Géométrie d'export : `ROW_H = 22`, `PAD = 20`, `pxPorDia = 1.5`.

  **C'est un précédent direct pour l'arbitrage du brief §10** : l'option « rendu SVG
  interne » n'est pas théorique, elle a déjà été livrée sur un projet comparable.
  Le comparatif formel reste à produire (cf. `PLAN.md`, lot 0).

---

## 10. Écarts à trancher avant de coder

1. ✅ **TRANCHÉ (19/08/2026) — couleur d'accent.** `--accent: #034ea2` et
   `--accent-2: #d0a650`, valeurs **exactes** relevées sur l'emblème officiel du
   Kosovo (§2). Le rouge Assemblage `#E30513` n'est pas repris : c'est celui du
   prestataire, pas du maître d'ouvrage.
2. **`--danger` devient nécessaire** (et non plus seulement souhaitable) :
   l'accent n'étant plus rouge, l'erreur ne peut plus le réutiliser. Valeur
   proposée `#c0392b`, distincte du rouge Assemblage et du pastel « en retard »
   `#ea9999`.
3. **Pas de mode sombre**, pas de `prefers-color-scheme`. Le brief ne le demande
   pas : on ne l'ajoute pas.
4. **Pas d'échelle typographique formalisée** dans le dépôt source ; elle est
   reconstituée au §3 à partir des fréquences d'emploi. À valider.
5. **Aucune internationalisation** dans le dépôt de charte : tous les libellés sont
   en espagnol, en dur dans les composants. Le brief §6 impose l'inverse dès le
   premier composant. La charte fournit donc les *styles*, jamais les *chaînes*.
6. ✅ **TRANCHÉ (19/08/2026) — logos.** L'emblème du Kosovo est fourni et
   versionné (`assets/logos/kosovo-emblem.svg`) ; AFD et Assemblage viennent du
   dépôt source. Le logo *XXI Mediterranean Games Prishtina 2030* **n'est pas
   disponible** : on code sans lui. Le header porte un **bloc de marque
   typographique** (« MG2030 » + sous-titre), isolé dans un composant
   `<BrandMark/>` unique — le jour où le vectoriel arrive, la substitution est
   un changement d'un seul fichier.
7. **Langue de l'interface** : `en` par défaut, `sq` pour l'albanais (décision
   validée). Les libellés officiels en albanais des sites, bâtiments et rôles
   restent à valider par la PIU.
