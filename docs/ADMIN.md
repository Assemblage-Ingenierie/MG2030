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

Relever l'**UID** du compte créé.

### Étape 2 — créer la ligne MG2030 (SQL Editor)

C'est cette ligne, et elle seule, qui donne accès à MG2030.

```sql
insert into mg2030_app_user
  (id, email, full_name, job_title, organisation_id, functional_role_id, is_active, approved_at)
select
  '<UID-RELEVE-A-L-ETAPE-1>'::uuid,
  'prenom.nom@exemple.org',
  'Prénom Nom',
  'Project Coordinator',
  r.organisation_id,
  r.id,
  true,
  now()
from mg2030_functional_role r
where r.code = 'ADMIN';   -- ADMIN porte is_platform_admin = true

-- Périmètre : l'administrateur voit tout le projet.
insert into mg2030_app_user_scope (user_id, kind)
values ('<UID-RELEVE-A-L-ETAPE-1>'::uuid, 'global');
```

### Étape 3 — vérifier

Se connecter sur `/login`. L'écran d'accueil doit s'afficher, et l'entrée
**Users** apparaître dans la navigation. Si « ce compte n'a pas accès à MG2030 »
s'affiche, l'UID de l'étape 2 ne correspond pas à celui de l'étape 1.

---

## 3. Ouvrir les comptes suivants

Même procédure, avec deux différences :

- **`functional_role_id`** : le code du rôle réel, parmi les 14 de
  `mg2030_functional_role` (`COORD`, `PROC`, `CONSTR`, `SITEREP`, `TA`, `AFD`…).
  L'organisation est **déduite du rôle** — un rôle `AFD` donne un compte en
  lecture seule, quelle que soit la matrice de permissions.
- **`is_active`** : laisser à `false`. L'administrateur active ensuite depuis
  `/admin/users`, ce qui horodate l'approbation et en garde trace.

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

## 6. Ajuster la matrice rôle × permission

La matrice chargée est une **proposition** (`docs/GAPS.md` point 11), pas une
donnée projet. Elle se modifie sans migration :

```sql
-- Accorder
insert into mg2030_role_permission (functional_role_id, permission_code)
select id, 'task.validate' from mg2030_functional_role where code = 'MRE';

-- Retirer
delete from mg2030_role_permission
 where permission_code = 'contract.write'
   and functional_role_id = (select id from mg2030_functional_role where code = 'LEGAL');
```

L'effet est immédiat : la RLS lit la matrice à chaque requête. La table est
visible en lecture sur `/admin/users`.

Trois attributions méritent un arbitrage de la PIU : les droits larges donnés à
l'**AT** (elle écrit partout mais ne valide rien), le droit du **Legal
Specialist** sur les marchés, et celui du **représentant sur site** sur les
tâches.

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
