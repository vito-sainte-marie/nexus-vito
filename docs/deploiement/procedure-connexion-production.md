# Connexion sécurité, lot 1 — procédure Production

Migrations : les quatorze fichiers listés au §6 (étapes 1, 2, 2b à 2i, 4, 4b, 5, 5b). Fonction : `supabase/functions/connexion/index.ts`. Page : `NEXUS-Login-v1.html`.

**Rien de ceci ne s'exécute sans un GO distinct du gérant pour chaque étape.** Toutes les mesures citées dans les fiches de qualification sont des mesures Test (projet `udljdqxerrbbbajxubfn`). La mesure Production sera faite au GO. Aucune lecture Production n'a été faite pour ce lot.

## 0. Ce que ce lot ne met pas en Production

L'injection de pannes (`nexus_connexion.panne_injectee`, `nexus_connexion.panne_pour`, variable `RECETTE_PANNES`) est un outil de recette Test. Elle est exclue de deux façons, qui se contrôlent séparément.

1. **Côté base : migration 2i** (`20261126200000_connexion_lot1_etape2i_retrait_pannes_injectees.sql`). La 2f crée la table et la fonction ; la 2i les retire. Appliquées dans l'ordre sur une base neuve, elles laissent 16 fonctions et 7 tables (17 fonctions avec l’étape 4, `equipe_pour`). Ni la table ni la fonction n'existent donc jamais durablement en Production.
2. **Côté fonction : code retiré du source.** Le commit de retrait de la constante `RECETTE_PANNES`, de la fonction `panne()` et de ses appels est fait : le source `index.ts` du dépôt ne contient plus aucun code de pannes. Ce source est celui qui sera déployé en Production (md5 au §5).

**Preuve sur Test (25/11/2026, projet `udljdqxerrbbbajxubfn`), après application de la 2i :**
- `to_regclass('nexus_connexion.panne_injectee')` = null ; `to_regprocedure('nexus_connexion.panne_pour(uuid,text)')` = null.
- 16 fonctions et 7 tables dans `nexus_connexion` (avant : 17 et 8) ; 0 EXECUTE et 0 SELECT pour `anon` et `authenticated` ; 7 tables sur 7 avec RLS.
- La fonction `connexion` déployée (variable `RECETTE_PANNES` non posée) répond sans la table : mauvais code → 401 neutre `{"ok":false,"erreur":"refus"}` ; bon code → 200 avec session.
- Source sans code de pannes déployé sur Test le 25/11/2026 (version 10, md5 `7a0a9530…`, jalon antérieur ; le source Production est celui du §5) : mauvais code → 401 neutre `{"ok":false,"erreur":"refus"}` ; bon code → 200 avec session. Le source de Production est celui du dépôt à ce md5.

## 1. Ordre réel Production

**Sauvegarde Production avant l'étape 1.** Le plan FREE n'offre pas de restauration à un instant donné. Avant toute migration, le gérant (ou Guardian sur GO distinct) exporte hors dépôt : les tables `public.employees` et `auth.users` (colonnes d'identité et état, pas de mot de passe en clair) et la définition des fonctions `public.nexus_*` touchées. Précisez au GO : qui exporte, où le fichier est rangé, qui peut le lire. Aucun export, aucun secret, aucun hash dans le dépôt.

**Fusion de #381 et fonction.** Fusionner #381 publie aussi la section « Comptes de l'équipe », qui appelle `lister_equipe`. L'étape 3 (fonction déployée) doit donc précéder la fusion de l'étape 4, sans quoi la section répond « indisponible ».

| # | Étape | Qui | Condition |
|---|---|---|---|
| 1 | Migrations, dans l'ordre des horodatages (étape 1 … 4b) | Guardian | GO distinct |
| 2 | Secrets de la fonction : `AUTH_MASTER_SECRET`, `PEPPER`, `IP_FP_SECRET`, `ORIGINES_AUTORISEES=https://app.nexusconseil.net` | le gérant, jamais lus ni journalisés par l'exécutant | GO distinct ; étape 1 faite |
| 3 | Déploiement de la fonction `connexion` (source sans code de pannes) | Guardian | GO distinct ; étapes 1 et 2 faites |
| 4 | Bascule de `NEXUS-Login-v1.html` vers la fonction | fusion de la PR | GO distinct ; recette navigateur publiée (375 et 1280, Jour et Nuit) ; étape 3 faite ; comptes `Recette…` et inactifs traités (voir ci-dessous) ; limites Auth relues |

**Avant l'étape 4, deux contrôles présentés au gérant.**
(a) Comptes `Recette…` et comptes inactifs qui peuvent encore se connecter (défaut P1). Requête en lecture seule, sur GO, filtrée par site (`where site_id = '<site_du_GO>'`) : nombre et liste (nom, rôle, actif) ; le gérant décide de la désactivation AVANT la bascule. Aucun compte incertain `a_migrer` n'est touché.
(b) Relire les limites Auth de Production (taux de connexion par IP) et les comparer au budget de 20 appels Auth par minute.

Le secret `AUTH_MASTER_SECRET` ne se change plus après l'étape 4 sans réinitialiser tous les comptes migrés (le mot de passe Auth en dérive). Décision du gérant : rotation uniquement en cas d'incident (§4).

Étape 1 : la migration 2 de l'étape 1 copie dans `sauvegarde_auth` l'identité de chaque compte (`user_id`, e-mail et e-mail d'identité d'avant, alias, date). **Elle ne copie aucun mot de passe ni empreinte** ; les scripts `99*` ne restaurent que les e-mails et l'ancienne fonction. Aucun compte n'est migré par les migrations : le passage `a_migrer` → `migre` se fait à la première connexion réussie, station par station (budget 20 appels Auth par minute).

## 2. Retour arrière de chaque étape

**ATTENTION : pas de retour arrière de la page après la première migration réelle d'un compte.** Les comptes migrés ont un mot de passe Auth dérivé que l'ancienne page ne peut pas utiliser.

| Étape | Retour arrière |
|---|---|
| 4 Page | Revenir au `NEXUS-Login-v1.html` précédent (revert de la fusion). L'ancienne page appelle Auth directement avec `nexus_identifiant_de_connexion`, qui doit donc rester en place. Les comptes déjà migrés ont un mot de passe Auth dérivé : l'ancienne page ne peut plus les connecter. **La page ne se rebascule donc qu'avant la première migration réelle d'un compte**, sinon seule la réinitialisation par un gérant les répare. |
| 3 Fonction | Supprimer la fonction `connexion` (ou la redéployer à la version précédente). Sans elle, la page bascule rend « indisponible ». |
| 2 Secrets | Supprimer les secrets. Ne jamais les journaliser. |
| 1 Migrations | `outils/recette/connexion_lot1/99_retour_arriere.sql`, `99b`, `99c` (pannes, comptes incohérents), `99d` (budget), `99e` (limite IP), `99f` (étapes 4 et 4b : `equipe_pour` retirée, `auteur_autorise` rétablie), dans l'ordre inverse. Pour la 2i : recréer la table et la fonction depuis la 2f est inutile en Production (outil de recette), aucun retour arrière n'est requis. Le schéma est supprimé en dernier. |

## 3. Mesures à refaire en Production (lecture seule, catalogue)

**Avant l'étape 1** (état de départ attendu : le schéma n'existe pas)
```sql
begin read only;
select to_regnamespace('nexus_connexion') as schema_connexion;
select count(*) as pgcrypto from pg_extension where extname = 'pgcrypto';
select count(*) as fonctions_publiques
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('nexus_connexion_email_de', 'nexus_identifiant_de_connexion');
rollback;
```

**Après l'étape 1** (valeurs mesurées sur Test, à comparer)
```sql
begin read only;
select count(*) filter (where c.relkind = 'r') as tables,
       count(*) filter (where c.relkind = 'r' and c.relrowsecurity) as tables_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'nexus_connexion';
select count(*) as fonctions from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion';
select to_regclass('nexus_connexion.panne_injectee') as panne_table, to_regprocedure('nexus_connexion.panne_pour(uuid,text)') as panne_fonction;
select count(*) as exec_anon_auth from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'nexus_connexion' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
select count(*) as select_anon_auth from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'nexus_connexion' and c.relkind = 'r' and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'));
rollback;
```
Attendu (mesuré sur Test le 25/11/2026 après 4b) : 7 tables, 7 avec RLS, 17 fonctions (16 avant l’étape 4), `panne_table` et `panne_fonction` null, 0 EXECUTE, 0 SELECT.

**Avant l'étape 4 : comptage des comptes par station** (à lancer seulement sur GO ; le filtre par site est obligatoire)
```sql
begin read only;
select s.site_id, count(*) as comptes
from public.employees s
where s.site_id = '<site_du_GO>'
group by 1;
rollback;
```
Les colonnes exactes de `employees` se vérifient au GO, sur le catalogue, avant de lancer la requête. Les comptes `a_migrer` incertains ne sont pas touchés.

**Après l'étape 4** : par station, nombre de comptes `a_migrer` restants (`select count(*) from nexus_connexion.compte where etat = 'a_migrer'`, rapproché du site), jusqu'à zéro avant la station suivante ; nombre d'événements `budget_auth`, `egress_proche` et `incoherence_auth` au journal ; alerte gérant : au moins 3 réponses 5xx en 1 minute sur `connexion`. Source de l'alerte : la ligne `indisponible` du journal (Auth 429, ou relance unique de la page après un 5xx, `detail.source` = `limite_auth` ou `relance_5xx`). Preuve Test du 25/11/2026 : lignes 1510 à 1512, `relance_5xx` ; contrôles (`relance` inconnue, `relance` sur `lister_equipe`) : 401 neutre, aucune ligne.

**Limite connue.** Si la fonction est entièrement indisponible, la relance échoue aussi et rien n'est journalisé : la carte ne s'allume pas lors d'une panne totale. Une sonde externe (Vigie) est une piste pour l'étape 7, hors de ce lot.

## 4. Décisions du gérant (Guardian 7182241504)

- **Journal** `nexus_connexion.journal` : conservé 6 mois (180 jours), purge automatique quotidienne à 03 h 15 (pg_cron, tâche `nexus-connexion-purge`, migration 20261126230000).
- **Alerte « connexion indisponible »** : gérant et managers du site concerné, jamais un autre rôle. Le gérant reçoit l'action technique (vérifier le service) ; le manager reçoit la consigne d'attente (prévenir le gérant, ne pas multiplier les essais) et aucune action technique.
- **`AUTH_MASTER_SECRET`** : changé uniquement en cas d'incident.
- **Code** : 6 chiffres.
- **Code temporaire** : valable 24 h, puis refus neutre ; un manager ou le gérant en pose un nouveau.
- **Sauvegarde avant l'étape 1** : faite par Guardian, conservée sur l'ordinateur du gérant, hors dépôt, sans mot de passe ni empreinte.

## 5. Source de la fonction (mise à jour étape 4)

Le source `index.ts` ajoute l'action `lister_equipe` (l’étape 4b journalise le refus et applique la règle gérant/manager validée) puis, à l'étape 5, `alerte_indisponible` et le contrôle d'expiration du code temporaire. Test porte la **version 16**, déployée le 26/11/2026 depuis le fichier de la branche (md5 `c106b325a0e92a8b8aad5b3d2fae0274`) ; c'est ce md5 que Guardian contrôle avant tout déploiement en Production. Limite connue : en panne totale de la fonction, aucune ligne `indisponible` ne peut être écrite ; la carte du Brief n'affiche alors rien, et la carte « lecture impossible » reste neutre. L'étape 5b (`20261127090000`) ajoute `premier` (première réponse « indisponible » de l'heure) à `alerte_indisponible_pour` ; `site_id` reste celui du lecteur. La carte n'a aucun bouton ; les personnes déjà connectées gardent leur session (`getSession`, sans appel à `connexion`). Mesure Test : `lister_equipe` sans JWT → 403 neutre ; les autres actions répondent comme avant.

## 6. Plan de bascule Production (à exécuter seulement sur GO distinct par étape)

Rien ici n'est exécuté. Le gérant et Guardian arbitrent.

### 6.1 Les 14 migrations, dans l'ordre, avec leur md5 sur la tête de la branche

Guardian compare avant d'appliquer (`md5 <fichier>`).

| # | Fichier | md5 |
|---|---|---|
| 1 | `20261126090000_connexion_lot1_etape1_alias_opaque.sql` | `9fca041aa81dfefe62ba6175891f4899` |
| 2 | `20261126120000_connexion_lot1_etape2_etat_prive.sql` | `55ec7720ce7ec11506b4d7fcfa2d0a1a` |
| 3 | `20261126130000_connexion_lot1_etape2b_controle_auteur.sql` | `7579d6188ab82b7977afe9eb4ed7aed1` |
| 4 | `20261126140000_connexion_lot1_etape2c_refus_journalise.sql` | `f2996a0aa89eaa95c976570dacb14437` |
| 5 | `20261126150000_connexion_lot1_etape2d_compteur_sorties.sql` | `256891cbc0af54c5d04aa8f57911e1d0` |
| 6 | `20261126160000_connexion_lot1_etape2e_surveillance_sans_blocage.sql` | `0837095c4d9075e81fb454350d153302` |
| 7 | `20261126170000_connexion_lot1_etape2f_incoherence_auth.sql` | `71e92696754e9f2e9732377e878ec8ed` |
| 8 | `20261126180000_connexion_lot1_etape2g_budget_auth.sql` | `67998f56376e172799ec844df7f09a8e` |
| 9 | `20261126190000_connexion_lot1_etape2h_limite_ip_echecs_reels.sql` | `38c0c5194e1f0dcd9948419bdded72f6` |
| 10 | `20261126200000_connexion_lot1_etape2i_retrait_pannes_injectees.sql` | `73f990fe821406ccb3d57aad1096c49c` |
| 11 | `20261126210000_connexion_lot1_etape4_equipe_pour.sql` | `673e6f116ed0afbaebf9b76d56be3110` |
| 12 | `20261126220000_connexion_lot1_etape4b_equipe_refus_et_gerant.sql` | `c27aecf33908a6c0f3a1bbf5345e4631` |
| 13 | `20261126230000_connexion_lot1_etape5_decisions_gerant.sql` | `bf689f877f6967ccec79499294db1743` |
| 14 | `20261127090000_connexion_lot1_etape5b_alerte_premier.sql` | `199ee17f07f2af2fb30e9fe78b7146ec` |

Fonction `supabase/functions/connexion/index.ts` : md5 `c106b325a0e92a8b8aad5b3d2fae0274`.

### 6.2 Étapes de bascule (dans cet ordre)

1. **Sauvegarde** (Guardian, sur son Mac, hors dépôt) : identités et états seulement, jamais un mot de passe ni une empreinte.
2. **Migrations** (Guardian) : les 14 fichiers du §6.1, mesure du catalogue ensuite (§3). Je reporte ensuite cette mesure Production dans `docs/deploiement/qualification-ordre-migration-code.json` par un commit de suite ; la garde « Déploiement Production » doit être verte avant la fusion (condition de l'étape 5).
3. **Secrets** (le gérant) : voir §1.
4. **Fonction** (Guardian) : déploiement du source au md5 du §6.1.
5. **Page, puis compte témoin, puis gérant.** Conditions préalables : (i) la mesure Production est inscrite dans `qualification-ordre-migration-code.json` et la garde « Déploiement Production » est verte avant la fusion ; (ii) les deux contrôles du §1, en lecture seule et sur GO, sont faits : (a) comptes `Recette…` et comptes inactifs, filtrés par site, le manager décidant avant la bascule de ce qu'on en fait ; (b) limites Auth de Production comparées au budget de 20 appels par minute. La première connexion réelle est le point de non-retour (§2). Le compte témoin passe donc avant celle du gérant :
   - la page est déployée (approbation de l'environnement `github-pages` par le gérant) ;
   - **avec GO distinct pour le compte fictif en Production** : connexion et changement de code du compte fictif, puis contrôle de la page servie (version attendue, parcours Connexion, Brief et déconnexion) ; ensuite seulement, connexion du gérant ;
   - **sans ce GO** : pas de compte fictif. Le contrôle de la page servie se limite à la lecture de la page (version, formulaire, appel de la fonction avec un faux compte : refus neutre 401), et la connexion du gérant devient la première migration réelle. Le gérant le sait avant d'accepter ;
   - **durée de session** : à la première connexion, lire `expires_in` (journalisé par la fonction) et la comparer à la durée voulue ; l'écart se règle dans Auth, pas dans la page.
6. **Stations** une à une, jusqu'à zéro compte `a_migrer` (budget de 20 appels Auth par minute).

### 6.3 Panne de la fonction après la migration d'un compte

Constat : après migration, la page ne parle plus qu'à la fonction ; aucune autre voie de connexion n'existe dans la page. Si la fonction tombe, personne ne se connecte, ce qui est le comportement prévu (« indisponible »). La relance échoue aussi (voir la limite du §3).

Option de repli qui ne passe pas par la fonction : le gérant, seul, depuis le tableau de bord Supabase (accès propriétaire du projet) peut lire les journaux de la fonction, vérifier les secrets, et redéployer une version précédente de la fonction si l'interface le propose. Il peut aussi poser à la main un mot de passe sur un compte Auth. **Effet sur la dérivation** : le mot de passe d'un compte migré est calculé par la fonction (`AUTH_MASTER_SECRET`, identifiant, version). Un mot de passe posé à la main ne le suit pas ; au retour de la fonction, la connexion de ce compte échoue (refus neutre) tant qu'un manager ou le gérant n'a pas réinitialisé le code, ce qui réécrit le mot de passe dérivé et monte la version. Une session déjà ouverte reste valable jusqu'à son expiration. Aucune procédure de restauration de mot de passe n'est décrite ici : seulement ce constat et cette option, à arbitrer par le gérant.

### 6.4 Créneau proposé

Horaires du site tels que `station_config` les décrit sur Test (site de test) : quart 1 de 06:00 à 13:00, quart 2 de 13:00 à 20:00, fuseau `America/Martinique` (UTC−4). Les horaires réels de la station de Production n'ont pas été lus (aucune lecture Production sans GO) : **le gérant confirmera lui-même les horaires de Production et la date**.

Créneau proposé (simple proposition, à valider ou changer par le gérant) : un soir après 20:00 et avant 05:00, par exemple de 21:00 à 22:30 heure de Martinique, hors quarts et hors prise de poste, jamais la veille d'une paie ni un jour de clôture.

| Étape | Durée estimée |
|---|---|
| 1 Sauvegarde | 10 min |
| 2 Migrations et mesure | 15 min |
| 3 Secrets | 5 min |
| 4 Fonction | 10 min |
| 5 Page (déploiement et approbation) | 10 min |
| 5 Compte témoin, contrôle de la page, session | 10 min |
| 5 Connexion du gérant | 5 min |
| 6 Première station | 15 min |
| Marge | 10 min |
| Total | environ 1 h 30 |

Les durées sont des estimations, sans mesure Production.
