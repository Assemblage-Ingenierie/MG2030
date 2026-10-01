# ADMIN — ouverture des comptes

> Procédure d'amorçage et d'exploitation courante. À exécuter par un
> administrateur humain : **l'application ne crée aucun compte et ne manipule
> aucun mot de passe.**

---

## 0. Ce que la plateforme ne fait pas

Le brief §3 impose des comptes « sur invitation, sans inscription libre ».
Conséquence : il n'existe ni écran d'inscription, ni bouton « créer un compte »,
ni réinitialisation de mot de passe en libre-service.

La création d'identifiants passe par **Supabase Auth**, hors de l'application.
L'écran `/admin/users` ne fait que trois choses : activer, désactiver, affecter
un périmètre.

---

## 1. ⚠ Avant tout : le pool d'authentification est partagé

Le projet Supabase **EXTERNAL** (`grnkbnldfzdzrgleorra`) héberge une seconde
application. `auth.users` leur est **commun**.

Trois conséquences pratiques :

1. **Une adresse déjà inscrite pour l'autre application ne peut pas être
   recréée.** Il faut la rattacher : créer la ligne `mg2030_app_user` sur l'`id`
   auth existant, sans toucher au compte d'authentification.
2. **Un utilisateur de l'autre application qui ouvre MG2030 se connectera sans
   erreur**, puis verra « ce compte n'a pas accès à MG2030 ». C'est le
   comportement voulu — pas une panne.
3. **Supprimer un compte dans Supabase Auth le supprime pour les DEUX
   applications.** Pour retirer l'accès MG2030 seul, désactiver
   (`is_active = false`) ou supprimer la ligne `mg2030_app_user`. **Jamais** le
   compte auth.

---

## 2. Créer le premier administrateur

Aucun compte n'existe au départ, et `/admin/users` exige d'être administrateur :
il faut donc amorcer par la base.

### Étape 1 — créer l'identité (interface Supabase)

Tableau de bord Supabase → **Authentication → Users → Add user**.

- Renseigner l'adresse professionnelle.
- Cocher **Auto Confirm User** (aucun e-mail n'est envoyé : voir §4).
- Choisir un mot de passe fort, et le transmettre **hors ligne** à l'intéressé,
  qui le changera à la première connexion.

### Étape 2 — créer la ligne MG2030 (SQL Editor)

C'est cette ligne, et elle seule, qui donne accès à MG2030.

**Ne remplacez rien à la main.** La requête retrouve le compte par son
**adresse e-mail** — celle saisie à l'étape 1, copiée telle quelle à la place
des deux `'prenom.nom@exemple.org'` ci-dessous. Aucun UID à relever ni à coller :
c'est justement la manipulation qui échoue silencieusement si l'un des deux
copier-coller diverge, ou bruyamment (`invalid input syntax for type uuid`) si
le texte d'exemple est laissé en place par erreur.

```sql
insert into mg2030_app_user
  (id, email, full_name, job_title, organisation_id, functional_role_id, is_active, approved_at)
select
  u.id,
  u.email,
  'Prénom Nom',
  'Project Coordinator',
  r.organisation_id,
  r.id,
  true,
  now()
from auth.users u
join mg2030_functional_role r on r.code = 'ADMIN'   -- ADMIN porte is_platform_admin = true
where u.email = 'prenom.nom@exemple.org';

-- Périmètre : l'administrateur voit tout le projet.
insert into mg2030_app_user_scope (user_id, kind)
select u.id, 'global' from auth.users u where u.email = 'prenom.nom@exemple.org';
```

Si la première requête insère 0 ligne, la cause la plus probable est une
adresse mal recopiée : vérifier avec
`select id, email from auth.users where email ilike '%prenom%';`.

### Étape 3 — vérifier

Se connecter sur `/login`. L'écran d'accueil doit s'afficher, et l'entrée
**Users** apparaître dans la navigation. Si « ce compte n'a pas accès à MG2030 »
s'affiche, l'UID de l'étape 2 ne correspond pas à celui de l'étape 1.

---

## 3. Ouvrir les comptes suivants

Même procédure, avec deux différences :

- **`functional_role_id`** : le code du POSTE, parmi les 14 de
  `mg2030_functional_role` (`COORD`, `PROC`, `CONSTR`, `SITEREP`, `TA`, `AFD`…).
  Depuis la migration 0037 il ne sert plus qu'à l'organigramme et à l'annuaire :
  **il n'accorde aucun droit**.
- **`access_level`** : `viewer`, `editor` ou `administrator`. C'est la **seule**
  colonne qui décide du droit d'écrire. Par défaut `viewer` — un compte s'ouvre
  en lecture, et c'est le bon sens du défaut.
- **`is_active`** : laisser à `false`. L'administrateur active ensuite depuis
  `/admin/users`, ce qui horodate l'approbation et en garde trace.

Les deux derniers se règlent ensuite depuis `/admin/users`, sans SQL.

### Périmètre des 14 représentants sur site

Le brief §8 veut qu'« un représentant sur site ne voie que son établissement ».
**Aucune source ne dit quel représentant couvre quel site** (`docs/GAPS.md`
point 29) : l'affectation se fait à l'ouverture des comptes.

```sql
insert into mg2030_app_user_scope (user_id, kind, site_id)
select '<UID>'::uuid, 'site', id from mg2030_site where site_code = 'TV-FAIK';
```

> **Affecter par SITE, pas par lot.** Les 4 lots de travaux des training venues
> n'ont aucun bâtiment rattaché — leur composition n'est pas arrêtée
> (`docs/GAPS.md` point 3). Un périmètre `lot` sur `W-TV-L1` ne résoudrait donc
> aucun site, et l'utilisateur ne verrait rien.

Codes disponibles : `SC` (Student Center) et les 13 `TV-*`.

---

## 4. Le point non tranché : l'invitation

`docs/GAPS.md` point 36 reste ouvert. Le brief demande des comptes sur
invitation **et** « pas d'envoi d'e-mail dans la première version ». Or
l'invitation Supabase *est* un e-mail.

| Voie | État |
|---|---|
| **Mot de passe provisoire transmis hors ligne** | Retenue ci-dessus, par défaut. Aucun e-mail, aucune dépendance |
| SMTP par défaut de Supabase | **Insuffisant** : 2 messages par heure. Ouvrir 30 comptes prendrait 15 heures |
| SMTP dédié | À configurer si la PIU veut de vraies invitations. Décision en attente |

---

## 5. Retirer un accès

| Situation | Geste |
|---|---|
| Absence temporaire | `/admin/users` → **Deactivate**. Le compte perd l'accès aux données au rafraîchissement suivant, la RLS s'en charge |
| Départ définitif | Désactiver, puis supprimer la ligne `mg2030_app_user` |
| **Jamais** | Supprimer le compte dans Supabase Auth — cela le supprimerait aussi pour l'autre application |

Un administrateur ne peut pas se désactiver lui-même : le bouton est neutralisé.
Sans cela, le dernier administrateur pourrait se verrouiller dehors et il
faudrait repasser par le SQL.

---

## 6. Régler les droits d'un compte

**Trois niveaux, et rien d'autre** (migration 0037) :

| Niveau | Ce qu'il peut faire |
| --- | --- |
| `viewer` | Lit tout ce que son périmètre autorise. Filtre, trie, exporte. N'écrit rien. |
| `editor` | Écrit partout où il voit, **sauf** sur les comptes. |
| `administrator` | Éditeur, plus la gestion des comptes et le choix des onglets visibles. |

Cela se règle depuis `/admin/users` → **Access**. Par SQL si besoin :

```sql
update mg2030_app_user set access_level = 'editor'
 where email = 'prenom.nom@example.org';
```

⚠ **Un déclencheur refuse cette colonne à qui n'est pas administrateur**
(`mg2030_private.guard_access_columns`). La politique `update_self` autorise
chacun à modifier sa propre fiche, et la RLS n'a aucun moyen d'en exclure une
colonne : sans ce verrou, tout éditeur s'écrirait `administrator` d'une requête.
Le même verrou couvre `is_active`, `organisation_id` et `functional_role_id`.

La table `mg2030_role_permission` et la colonne
`mg2030_functional_role.is_platform_admin` **ne décident plus rien**. Elles sont
conservées le temps d'une version, puis seront supprimées.

---

## 6 bis. Masquer un onglet — décision du 01/10/2026

Un module en cours de finition se retire du menu des autres comptes depuis
l'onglet **Settings** (`/settings`), sans mise en production. L'administrateur continue de le
voir, marqué d'un œil barré.

⚠ **C'est de la présentation, pas de la protection.** Masquer un onglet ne
restreint pas les données derrière : celles-ci dépendent de la RLS, et d'elle
seule. Pour soustraire une donnée, on change sa politique.

---

## 6 ter. Qui voit quoi dans la bibliothèque — décision du 01/10/2026

**Aucune restriction par rôle. C'est voulu, ce n'est pas un oubli.**

`mg2030_tag_access` contient aujourd'hui le produit complet **14 rôles × 4
tags** : tout membre actif voit toute la bibliothèque, y compris les documents
étiquetés `procurement`.

Cet état a été posé par la migration `0026`, qui réparait une bibliothèque
devenue invisible — la table n'avait jamais été peuplée, si bien que tout
document déposé disparaissait pour tout le monde sauf un administrateur
plateforme. Les droits ont alors été inscrits **explicitement**, en lignes,
plutôt que par une règle du type « un tag sans règle ne restreint personne » :
une confidentialité qui ne se lit pas dans les données n'est pas une
confidentialité.

La question a été posée le 01/10/2026. Réponse : **pas de restriction pour le
moment.**

Conséquence pratique, à connaître avant de déposer :

> Un document versé dans `02_Procurement` est lisible par l'ensemble de
> l'équipe projet, quel que soit son rôle. Les montants d'un appel d'offres non
> encore lancé ne doivent donc pas y être déposés tant que cette décision
> tient.

Pour restreindre le jour venu, retirer des lignes de `mg2030_tag_access` — le
mécanisme est en place et n'a pas besoin d'être récrit :

```sql
-- Exemple : reserver « procurement » a PROC, LEGAL, COORD et AFD.
delete from mg2030_tag_access a
 using mg2030_tag t, mg2030_functional_role r
 where a.tag_id = t.id
   and a.functional_role_id = r.id
   and t.code = 'procurement'
   and r.code not in ('PROC', 'LEGAL', 'COORD', 'AFD');
```

Le déposant lit toujours son propre dépôt, quel qu'en soit le tag, et
l'administrateur plateforme voit tout : ces deux règles vivent dans
`mg2030_private.can_read_document` et ne dépendent pas de cette table.

---

## 7. Vérifier que le cloisonnement tient

Après toute migration touchant aux politiques, exécuter
`supabase/tests/rls.test.sql`. Le test **s'annule intégralement** (il se termine
par `raise exception`) : il ne laisse aucune trace, ce qui le rend exécutable
sur la base partagée. Le message d'erreur **est** le rapport.

Le contrôle décisif : un compte réel de l'autre application doit lire **zéro
ligne** sur les 29 tables MG2030.

```sql
-- Doit toujours renvoyer zero ligne.
select * from mg2030_private.check_policy_guardrail();
```

---

## 8. Donner à un développeur les moyens de modifier la base

> Ajouté le 29/09/2026. Question posée : « qu'est-ce qu'il doit installer ? ».
> **Le plus souvent, rien.** Ce qui manque est un DROIT, pas un logiciel.

Le signe qui ne trompe pas : quelqu'un qui écrit ses migrations en les
accompagnant de « à appliquer depuis l'éditeur SQL de Supabase » les rédige
pour qu'un AUTRE les exécute — il n'atteint pas le tableau de bord. C'était le
cas de la migration `0030`, restée non appliquée plusieurs jours.

### Étape 1 — l'inviter à l'organisation Supabase

Tableau de bord → **Organization settings → Team → Invite member**, sur
l'organisation *Assemblage Ingenierie* (`amjedudflodlkbrteptt`).

⚠ L'organisation héberge **deux** projets : `EXTERNAL`
(`grnkbnldfzdzrgleorra`, celui de MG2030, partagé avec l'autre application) et
`INTERNAL`. Une invitation porte sur l'organisation, donc sur les deux. Le
rôle attribué est le seul garde-fou : `Developer` suffit pour écrire du SQL et
appliquer une migration ; `Owner` n'est nécessaire à personne d'autre qu'au
titulaire du compte.

Sans cette étape, aucun des outils ci-dessous ne servira à rien : ils
s'authentifient tous avec le compte Supabase de la personne.

### Étape 2 — choisir COMMENT il modifie la base

Trois voies, par ordre de simplicité. Aucune n'est obligatoire si la première
suffit.

| Voie | À installer | Quand la choisir |
|------|-------------|------------------|
| **Éditeur SQL du tableau de bord** | rien | Appliquer une migration ponctuelle, inspecter une table. C'est ce que décrit le reste de ce document |
| **Serveur MCP Supabase** dans Claude Code | rien — `.mcp.json` est versionné à la racine | Travailler la base depuis l'éditeur, en même temps que le code. Au premier lancement, Claude Code propose de se connecter (OAuth) ; la personne accepte avec son propre compte |
| **CLI Supabase** | `npm i -g supabase`, puis `supabase login` et `supabase link --project-ref grnkbnldfzdzrgleorra` | Diffs de schéma, migrations générées, tests RLS en local |

Le `.mcp.json` du dépôt cadre volontairement le serveur sur le seul projet
`EXTERNAL` (`?project_ref=grnkbnldfzdzrgleorra`) : un agent qui travaille sur
MG2030 n'a alors aucun moyen d'atteindre le projet `INTERNAL`. Il ne contient
**aucun secret** — chacun s'authentifie avec son propre compte.

Pour une session de lecture seule (diagnostic, revue), ajouter `&read_only=true`
à l'URL : les requêtes passent alors par un rôle Postgres en lecture seule.
