# GANTT — arbitrage de la bibliothèque de restitution

> Livrable demandé au brief §10 : « Ne rien installer avant arbitrage. Comparer
> et me soumettre : les composants React existants sous licence permissive, leur
> état de maintenance, et l'option d'un rendu SVG développé en interne au-dessus
> du modèle de données. »
>
> **Recommandation : rendu SVG interne.** Justification au §4, plan de mise en
> œuvre au §6, et — c'est le point important — **ce qui ferait changer d'avis**
> au §7.
>
> ⚠ **Réserve de méthode.** L'état de maintenance des bibliothèques ci-dessous
> est donné de mémoire et **doit être revérifié en direct** avant toute
> installation (date de la dernière publication npm, dernière version publiée,
> issues ouvertes, activité des 12 derniers mois). Le §3 donne la procédure de
> vérification. Aucune de ces bibliothèques ne doit être installée sur la foi de
> ce document seul.

---

## 1. Ce qu'il faut réellement afficher

Avant de comparer, il faut mesurer le besoin. Le brief §9.4 le décrit ainsi :
« groupement par jour, semaine, mois, trimestre ; vues filtrées (projet entier,
un contrat, un site) ; édition en ligne de type tableur sur la liste des tâches ».

| Besoin | Origine | Difficulté réelle |
|---|---|---|
| 27 tâches aujourd'hui, quelques centaines à terme | `seed/tasks.csv` | **Nulle.** Aucun besoin de virtualisation |
| 4 échelles : jour, semaine, mois, trimestre | Brief §9.4 | Faible — une fonction d'échelle |
| Liens de précédence, **convergences comprises** | 19 dépendances, dont 2 à double prédécesseur | Moyenne — le routage des flèches |
| Hiérarchie de profondeur arbitraire | Brief §7 | Faible |
| **`summary` agrège, `group_header` n'agrège pas** | Vérifié sur le seed | **Aucune bibliothèque ne connaît cette distinction** |
| Jalons losanges | `MS.1`, `MS.2` | Faible |
| Marge terminale de 4 mois, échéance des Jeux | `schedule_scenario` | **Aucune bibliothèque n'a ce concept** |
| Bascule entre scénarios exclusifs | `design_build` / `design_bid_build` | **Aucune bibliothèque n'a ce concept** |
| Export SVG / PNG / PDF | Usage réel (rapports mensuels AFD) | Moyenne — **déjà résolu** dans le dépôt de charte |
| **Édition tableur de la liste des tâches** | Brief §9.4 — et §2, le critère de succès | Élevée — **aucune bibliothèque Gantt ne la fournit** |

Trois lignes marquées « aucune bibliothèque » ne sont pas anecdotiques : ce sont
des concepts du modèle de données MG2030, pas des options d'affichage.

---

## 2. Le point que le brief ne dit pas, et qui décide

> « Si la saisie est plus lente que sous Excel, la PIU retournera à Excel.
> L'ergonomie de saisie du planning primera toujours sur l'esthétique des
> restitutions. » — brief §2

**La bataille ergonomique ne se joue pas dans le Gantt, elle se joue dans la
grille.** Une bibliothèque Gantt, quelle qu'elle soit, ne résout pas le problème
que le brief désigne comme déterminant : saisir vite au clavier une liste de
tâches enchaînées.

Le Gantt est une **restitution**. Le brief le classe d'ailleurs en lot 4, après
le moteur (lot 3), et écrit noir sur blanc que l'esthétique de la restitution
passe après. Choisir une dépendance lourde pour la partie qui compte le moins,
et devoir de toute façon écrire la grille à la main, serait le pire des deux
mondes.

---

## 3. Les candidats

### Comment vérifier l'état de maintenance (à faire avant toute installation)

```bash
npm view <paquet> time.modified version dist-tags license
```

Puis, sur le dépôt GitHub : date du dernier commit sur la branche par défaut,
nombre d'issues ouvertes contre fermées sur 12 mois, présence d'une release dans
les 12 derniers mois, et compatibilité déclarée avec React 19.

**Critère de rejet** : aucune publication depuis plus de 18 mois, ou
incompatibilité React 19 non résolue.

### Tableau comparatif

| Bibliothèque | Licence | Poids approx. | Glisser-déposer | Liens de précédence | Échelles | Réserve |
|---|---|---|---|---|---|---|
| **frappe-gantt** | MIT | ~30 ko | Oui (barres) | Oui | Jour → mois | Vanilla JS ; le wrapper React est **tiers**, donc une dépendance de plus, moins suivie que la bibliothèque elle-même |
| **gantt-task-react** | MIT | ~50 ko | Oui | Oui | Heure → année | TypeScript natif, le meilleur candidat React. **Rythme de publication à vérifier** : il s'est nettement ralenti |
| **wx-react-gantt** (SVAR) | GPL v3 **ou** commercial | ~120 ko | Oui | Oui | Multiples | ⚠ **Double licence.** La version gratuite est GPL, donc copyleft : incompatible avec une livraison propriétaire. À écarter sauf achat |
| **dhtmlxGantt** | GPL v2 **ou** commercial | ~400 ko | Oui, très complet | Oui | Multiples | ⚠ Même problème de licence. Le plus complet du marché, mais **pas permissif** |
| **Bryntum Gantt** | Commerciale | lourd | Excellent | Oui | Multiples | Payante, plusieurs milliers d'euros. Hors sujet à 30 utilisateurs |
| **Syncfusion Gantt** | Commerciale (offre communautaire conditionnelle) | lourd | Oui | Oui | Multiples | Conditions de l'offre communautaire à vérifier au cas par cas. Dépendance à un écosystème entier |
| **vis-timeline** | MIT / Apache-2.0 | ~200 ko | Oui | **Non** — pas de flèches de précédence | Multiples | Frise chronologique, pas un Gantt. Disqualifié par le critère « liens de précédence » |
| **Rendu SVG interne** | — | **0 ko de dépendance** | À écrire | À écrire | À écrire | Charge de développement, mais **précédent en production** (§5) |

**Le filtre de licence élimine d'emblée les quatre bibliothèques les plus
complètes.** dhtmlxGantt et SVAR sont sous copyleft dans leur version gratuite ;
Bryntum et Syncfusion sont payantes. Le brief demande explicitement des
« licences permissives ». Il ne reste donc, en permissif, que des bibliothèques
**légères** — c'est-à-dire proches, en couverture fonctionnelle, de ce qu'on
écrirait soi-même.

---

## 4. Pourquoi le rendu interne l'emporte ici

### 4.1 Le coût caché d'une bibliothèque : l'adaptateur

Toute bibliothèque impose son modèle de tâche (`id`, `start`, `end`, `progress`,
`dependencies`, `type`). Le modèle MG2030 en diffère sur des points qui ne sont
pas cosmétiques :

- `group_header` **n'agrège pas** ses enfants — comportement vérifié sur le seed
  (`TV.3` est sans dates alors que ses enfants couvrent 18 mois). Toutes les
  bibliothèques agrègent les parents. Il faudrait donc simuler un faux type.
- Les **scénarios mutuellement exclusifs** et la **marge terminale** n'existent
  dans aucun modèle de bibliothèque.
- Les dates sont **calculées par notre moteur**, pas par la bibliothèque. Or la
  plupart recalculent les dates au glisser-déposer, avec leurs propres règles —
  il faut alors désactiver leur moteur, ce qui est rarement propre.

L'adaptateur qui traduit dans les deux sens représente à lui seul plusieurs
centaines de lignes, plus fragiles que du code de rendu : c'est une couche
d'impédance permanente, qui casse à chaque montée de version.

### 4.2 L'échelle du problème ne justifie pas l'outillage

Les bibliothèques Gantt sont conçues pour des plannings de plusieurs milliers de
tâches, avec virtualisation, défilement infini et gestion mémoire. Le projet en
compte **27**, et n'en aura jamais plus de quelques centaines. On paierait la
complexité d'un problème qu'on n'a pas.

### 4.3 La moitié du travail est déjà faite, et en production

Voir §5.

### 4.4 Ce qu'on n'aurait pas à écrire soi-même est marginal

En retirant ce que les bibliothèques permissives légères apportent réellement —
positionnement des barres, axe temporel, flèches de précédence — on parle d'un
module de l'ordre de **600 à 800 lignes**, sans dépendance, entièrement testable,
et dont on maîtrise le rendu d'export.

---

## 5. Le précédent, qui n'est pas théorique

Le dépôt de charte `peeb-cool-santafe` — **même équipe, même stack, même
bailleur** — contient un Gantt SVG développé en interne et **en production** :

| Élément | Fichier | Volume |
|---|---|---|
| Vue à l'écran | `components/cronograma/cronograma-client.tsx` | 2 975 lignes |
| Export vectoriel | `lib/cronograma/cronograma-svg.ts` | ~600 lignes |
| Téléchargement SVG / PNG / PDF | `lib/cronograma/export-download.ts` | — |
| Moteur de dates (pur, partagé) | `lib/schedule.ts` | — |

Fonctionnalités déjà couvertes : échelles semaine / mois / trimestre, barres
pleines et hachurées, jalons losanges, repère « aujourd'hui », recadrage sur une
plage choisie, colonne de libellés ou libellés en regard des barres, légende,
vue compacte, export SVG / PNG / PDF. **Zéro dépendance de rendu.**

Géométrie déjà éprouvée, réutilisable telle quelle : `ROW_H = 28`,
`LABEL_W = 300`, `CELL_W = 56` à l'écran ; `ROW_H = 22`, `PAD = 20`,
`pxPorDia = 1.5` à l'export.

> Ce n'est pas du code à copier — le modèle de données diffère. C'est la preuve
> que le chiffrage est réaliste et que l'équipe sait le faire.

---

## 6. Ce qui est recommandé, concrètement

### 6.1 Découpage en deux temps

| Temps | Contenu | Lot |
|---|---|---|
| **1 — lecture** | Axe multi-échelles, barres, jalons, liens de précédence, marge terminale, repère « aujourd'hui », filtres (projet / marché / site), export SVG + PNG | Lot 10 |
| **2 — édition** | Glisser-déposer des barres, poignées de redimensionnement, création de lien à la souris | **Différé, sur demande explicite de la PIU** |

**L'édition passe par la grille tableur du lot 8, pas par les barres.** C'est là
que se joue le critère de succès du brief §2, et c'est mesurable : saisir
10 tâches enchaînées doit prendre un temps au plus égal à la même saisie sous
Excel.

Le glisser-déposer sur les barres est agréable mais secondaire : il sert à
*ajuster*, pas à *saisir*. Le construire d'emblée, c'est prendre le risque
ergonomique le plus élevé sur la partie la moins critique.

### 6.2 Architecture

```
lib/gantt/
  geometry.ts   Conversion date → pixel, hauteur de ligne, gouttières. PUR.
  scale.ts      Graduations jour / semaine / mois / trimestre + libellés i18n. PUR.
  layout.ts     Aplatit l'arbre de tâches en lignes, calcule le tracé des
                flèches de précédence (convergences comprises). PUR.
  render-svg.ts Sérialise un SVG à partir du layout — partagé écran / export.
  export.ts     SVG → PNG (canvas) → PDF.

components/gantt/
  gantt-view.tsx    Assemblage, défilement, filtres
  gantt-axis.tsx    En-tête d'échelle collant
  gantt-row.tsx     Une ligne : barre, jalon, ou intertitre sans barre
  gantt-links.tsx   Couche des flèches
  scale-switch.tsx  Segmented control jour / semaine / mois / trimestre
```

Les quatre modules `lib/gantt/*` marqués **PUR** sont testables sans DOM, comme
le moteur de planification. C'est ce qui rend le rendu interne défendable :
la partie délicate (géométrie, routage) est du calcul, pas de l'interface.

### 6.3 Coût estimé

| Poste | Estimation |
|---|---|
| Géométrie + échelles | 1 j |
| Layout + routage des flèches | 1,5 j |
| Rendu SVG écran | 1,5 j |
| Filtres, jalons, marge terminale | 1 j |
| Export SVG / PNG / PDF | 1 j |
| Tests des modules purs | 1 j |
| **Total temps 1** | **~7 j** |

À comparer à l'intégration d'une bibliothèque légère : ~2 j d'intégration
nominale, **plus** l'adaptateur de modèle, **plus** la reprise de l'export,
**plus** le risque de maintenance. L'écart réel est faible, et il se rembourse
au premier besoin non couvert.

---

## 7. Ce qui ferait changer d'avis

Cette recommandation n'est pas idéologique. Trois faits la renverseraient :

1. **Le glisser-déposer des barres est jugé indispensable dès la version 1** par
   la PIU. C'est le seul poste où une bibliothèque apporte une vraie économie —
   le glisser-déposer bien fait (aimantation, retour visuel des contraintes,
   annulation) coûte cher à écrire.
2. **Le planning dépasse quelques milliers de tâches.** La virtualisation
   deviendrait nécessaire, et ce n'est pas ce qu'on veut écrire soi-même.
3. **Un budget de licence existe.** Si dhtmlxGantt ou Bryntum peut être acheté,
   la question se repose entièrement : ce sont des produits nettement supérieurs
   à tout ce qu'on écrirait, et le copyleft n'est plus un obstacle.

En l'absence de ces trois faits — 27 tâches, 30 utilisateurs, pas de budget de
licence, priorité affichée à la saisie — le rendu interne est le bon choix.

---

## 8. Décision

| Champ | Valeur |
|---|---|
| **Option retenue** | Rendu SVG interne, sans dépendance |
| **Dépendances installées** | **Aucune** |
| **Périmètre version 1** | Lecture : échelles, barres, jalons, liens, marge, filtres, export |
| **Différé** | Glisser-déposer des barres, sur demande explicite |
| **Réversibilité** | Le modèle de données ne présuppose aucun rendu. Basculer vers une bibliothèque resterait possible sans migration |

**À valider.** En cas d'accord, aucune installation n'a lieu et le lot 10 est
lancé sur cette base. En cas de désaccord, la vérification de maintenance du §3
doit être menée en direct sur `gantt-task-react` et `frappe-gantt` avant tout
`npm install`.
