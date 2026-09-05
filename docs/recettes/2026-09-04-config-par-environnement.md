# Fiche de recette — configuration par environnement

> **VERDICT : NON VALIDÉ — BLOQUÉ SÉCURITÉ.**
> Première passe. La mise en production n'est pas autorisée, et la recette
> elle-même n'est pas terminée : les contrôles 5 à 8 et 10 exigent une
> session navigateur authentifiée qui n'a pas encore eu lieu.

## Identification

| | |
|---|---|
| Fonctionnalité testée | Séparation Test / Production — configuration Supabase portée par le build |
| Commit testé (SHA complet) | `3efbf1cd6a443b21ea28ce7eba735840ebd238a7` |
| Branche | `config-par-environnement` |
| Environnement de recette | https://nexus-test-ddf.pages.dev (Cloudflare Pages) |
| Base de recette | projet Supabase `nexus-test` (`udljdqxerrbbbajxubfn`) |
| Date de recette | 04/09/2026 — passe 1 |
| Recette menée par | Frédéric Bragance, assisté de Claude |

## Bilan final — VALIDÉ / BLOQUANT / NON BLOQUANT / NON ÉPROUVÉ

Consolidé le 04/09/2026 sur l'état réellement déployé. Le détail de chaque
anomalie et de chaque étape figure plus bas.

### Les faits

| | |
|---|---|
| `config-par-environnement` (déployé) | `58e394b9b6f853207b65e176ec08411f23db46f8` |
| `main` | `501c0c744c3327dd5693a2bddc45d064045ca474` |
| `production` | `501c0c744c3327dd5693a2bddc45d064045ca474` |
| CI | verte sur les 8 commits de la recette, dont `58e394b` |
| Cloudflare | déployé — `environnement: "test"`, base `udljdqxerrbbbajxubfn`, `cache-control: no-store`, `x-robots-tag: noindex`, `robots.txt` en `Disallow: /`, balises `config → page → bandeau → auth` |

**Migrations présentes uniquement sur `nexus-test`** — 242 côté test, 240 côté
production :

| Migration | Test | Production |
|---|---|---|
| `20260904175723_verrouiller_rpc_stock_par_site` | ✅ | absente |
| `20260904175747_login_non_enumerable` | ✅ | absente |
| `20260904190027_site_unique_shifts_mission_catalog` | ✅ | absente |

**Production — confirmation.** 0 migration de la recette, 0 contrainte A2,
0 fonction créée pendant la recette, 0 ligne sur un site de test, 0 écriture
pendant la fenêtre de recette : la dernière écriture de production date de
13:40 locale, sur le site réel, par l'exploitation ; les premières écritures
de recette sont à 16:52 locale, sur `nexus-test`.

**Tests automatiques ajoutés pendant la recette**

| Fichier | Rôle |
|---|---|
| `test_config_environnement.js` | 17 vérifications : aucune URL ni clé Supabase en dur dans les 166 fichiers applicatifs |
| `test_securite_lot_isolation_20260904.js` | 35 vérifications : bandeau jamais hors « test », connexion non énumérable, message unique, `no-store`, `robots.txt` par environnement |
| `test_site_unique_20260904.js` | 23 vérifications : les trois verrous d'A2, réparation avant contrainte, `site` non supprimée |
| `test_identification_page_20260904.js` | 33 vérifications : identification de page avec et sans `.html`, query, fragment, boucle `?retour=` à 0 tour, 13 satellites |
| `test_journalisation_donnees_absentes_20260904.js` | 5 vérifications : absence de données en `info`, erreur de base restée en `error` |
| `outils/verifier-isolation-supabase.mjs` | Rejoue les deux fuites anonymes contre une vraie base. Hors suite : celle-ci n'ouvre aucune connexion réseau |
| `outils/verifier-site-unique.sql` | Rejoue A2 en 7 scénarios, transaction close par `rollback`, refuse de tourner sur une base ressemblant à la production |

### VALIDÉ

| # | Objet | Preuve |
|---|---|---|
| 1 | Séparation `nexus-test` / production | 3 migrations et 0 écriture de recette en prod ; 0 requête vers `uzhjpqpctpvxytxpxoqz` |
| 2 | Configuration TEST | `environnement: "test"`, `no-store`, `Disallow: /`, bandeau sur les 53 écrans |
| 3 | Aucun appel Supabase production | 0 sur 10 écrans × 3 comptes |
| 4 | Aucune Edge Function production | 0 — **réserve en NON ÉPROUVÉ** |
| 5 | Manager Test | session, rôle, site, 42 appels REST tous sur le site de test |
| 6 | Employé Test A | session, rôle CAISSIER, site, 6 écrans |
| 7 | Employé Test B | session, rôle Pompiste, site, 4 écrans |
| 8 | Prise de poste | 3 services, 3 rôles distincts, rappel de sécurité pompiste affiché |
| 9 | Pointage | 2 arrivées avec photo, horaire et retard enregistrés, site correct |
| 10 | **A2 `site = site_id`** | les 3 services portent `nexus-station-test` des deux côtés ; 0 ligne à deux sites dans `shifts` et `mission_catalog` |
| 11 | Isolation inter-site | 0 donnée de `vito-sainte-marie` ni de `site-fantome-test`, en base comme à l'écran |
| 12 | **Isolation A ↔ B** | 12 tentatives croisées : chacun ne voit que lui, ne modifie ni ne supprime rien de l'autre |
| 13 | Visibilité manager → équipe | 3 services de son site, 0 hors site |
| 14 | Protections d'écrans manager | Radar et Carburants Pilotage : refus affiché, aucune donnée |
| 15 | **A8 avec et sans `.html`** | reconnu sous les deux formes, avec query et fragment |
| 16 | Scripts et satellites attendus | 8/8 chargés ; aucun ne l'était avant A8 |
| 17 | Absence de boucle de navigation | URL entre 45 et 80 caractères sur tous les écrans |
| 18 | **A6 — traçabilité de la version servie** | `NEXUS_BUILD.commit` = SHA Cloudflare exact, sur quatre déploiements successifs ; empreinte identique en local et chez Cloudflare ; commit documentation-only → génération inchangée ; modification d'actif → génération modifiée |
| 19 | **A14 — génération unique, sans échappatoire** | `coherent = true` sur Cockpit et Inventaire ; 32 scripts dynamiques sur la génération officielle ; 0 occurrence de `20260831-1408` ni de `20260904-0104` ; 0 script dynamique sans épingle |

### BLOQUANT

**Aucun.** A6 et A14 sont **fermés le 05/09/2026**, sur preuves faites contre
le déploiement Cloudflare réel et non contre un arbre local — c'est
précisément la distinction qu'A6 existait pour imposer.

A6 était : « on ne peut pas savoir quelle version est réellement éprouvée ».
La question a désormais une réponse vérifiable depuis n'importe quel écran, et
une version incapable de la fournir ne peut plus être publiée : le build
échoue.

**Reste à traiter avant un verdict global**, aucun n'étant bloquant au sens
d'A6 mais A12 touchant à la sûreté d'une future promotion de schéma :
**A12 → A11 → A4-bis → A3**, puis la couverture des points non éprouvés.

### NON BLOQUANT

| # | Anomalie | Nature |
|---|---|---|
| A3 | Libellés « Vito Sainte-Marie Usine » codés en dur — 39 écrans, 46 occurrences | Défaut multi-site de présentation |
| A4-bis | `console.error` sur absence normale de données, `NEXUS-Cockpit-v2:736` | Hygiène de console |
| A5 | Deux `HEAD` en 503 intermittents, non reproduits | En observation |
| A11 | Le Cockpit affiche le rôle habituel (`employees.role`) au lieu du rôle du jour (`shifts.role`) | **Modèle métier** |
| A7 | L'accueil public ne porte pas le bandeau MODE TEST | Présentation |
| A10 | Aucun lien de déconnexion sur le Pointage une fois l'arrivée enregistrée | Exploitation |
| A12 | Renommage de migration désaligné avec la production | **Sécurité de la promotion** — prochain lot |
| A13 | Cloudflare Pages renvoie `200` et du HTML pour un actif absent, jamais `404` | Observation : rien à l'exécution ne signale un fichier manquant. Renforce la nécessité d'un échec au build |

### NON ÉPROUVÉ

Section complète plus bas. En résumé : aucune fonction Edge n'est déployée sur
`nexus-test`, donc « 0 appel Edge production » **ne prouve pas** l'isolation
des fonctionnalités Edge ; les rôles renfort et créateur n'ont aucun compte ;
la simultanéité de deux sessions n'a pas été testée.

### Ordre des lots arbitré

**A6 → A12 → A11 → A4-bis → A3**, puis couverture des éléments non éprouvés.
A12 passe avant A11 : il touche à la sécurité de la future promotion de la
base, quand A11 touche à la logique métier.

## Migrations

Aucune migration n'accompagnait `3efbf1c`. Deux migrations ont été appliquées
à la base de recette **pendant** cette passe, en réponse aux failles
constatées (voir « Anomalies bloquantes ») :

| Fichier | Appliquée sur Test le | Volumes avant → après | Procédure de retour |
|---|---|---|---|
| `20260904175723_verrouiller_rpc_stock_par_site.sql` | 04/09/2026 | aucune donnée touchée — droits et corps de fonctions uniquement | recréer `nexus_stock_lire_etat` depuis `nexus_stock_lire_etat_donnees` et rétablir `grant execute … to anon` — rétablirait la faille, à ne faire que pour un diagnostic |
| `20260904175747_login_non_enumerable.sql` | 04/09/2026 | aucune donnée touchée | `grant select on employees_public to anon` + `security_invoker = false` — rétablirait la faille |

- [x] Aucune donnée n'est modifiée : les deux migrations ne portent que sur
      des droits et des définitions de fonctions.
- [x] Volumes relevés avant et après : identiques, table par table
      (`inventaire_zones` 5, dont 3 sur le site sentinelle, inchangé).
- [x] Procédure de restauration rédigée. **Non essayée** : la rejouer
      rouvrirait volontairement une fuite de données. Écart assumé et nommé.
- [ ] Le code compatible est prêt et validé AVANT toute application en
      production → **NON**. `20260904175747_login_non_enumerable.sql` est
      **incompatible avec le code actuellement en production** : l'écran de
      connexion servi par GitHub Pages interroge encore `employees_public` en
      anonyme. Ordre imposé : code promu d'abord, migration ensuite.

## Les 10 contrôles prévus

| # | Contrôle | Résultat | Preuve |
|---|---|---|---|
| 1 | `NEXUS_ENV = test` | ✅ | `nexus-config.js` servi : `environnement: "test"` |
| 2 | URL Supabase = projet `nexus-test` | ✅ | `https://udljdqxerrbbbajxubfn.supabase.co` |
| 3 | Clé publiable = projet `nexus-test` | ✅ | `sb_publishable_aoD7…` ; l'appel REST anonyme atteint bien la base de test |
| 4 | `nexus-config.js` chargé avant `nexus-auth.js` | ✅ | 64/64 écrans servis, ordre vérifié dans le HTML livré |
| 5 | Aucune requête réseau vers Supabase production | ⏳ **non fait** | exige une session authentifiée ; à ce stade, seul le code servi a été balayé — zéro URL de production hors documentation |
| 6 | Aucune fonction Edge de production appelée | ⏳ **non fait** | voir la réserve ci-dessous |
| 7 | Connexion Manager Test | ⏳ **non fait** | aucun code PIN n'a été saisi |
| 8 | Connexion Employé Test | ⏳ **non fait** | idem |
| 9 | Absence de « Configuration absente » | ✅ | écran de connexion rendu, console vide |
| 10 | Simulation sans `nexus-config.js` → échec fermé | ⚠️ partiel | chemin d'échec lu dans `nexus-auth.js` et couvert par 17 vérifications automatiques ; **pas encore éprouvé en conditions réelles sur la recette** |

**Réserve sur le contrôle 6.** Toutes les URL de fonctions Edge du code sont
construites à partir de `NEXUS_SUPABASE_URL`, donc suivent l'environnement —
la seule occurrence en dur (`NEXUS-API-v1.html`) est une documentation
destinée aux consommateurs externes de l'API, et cet écran n'émet aucun
appel. Mais **le projet `nexus-test` n'héberge aucune fonction Edge** : les
écrans qui appellent `google-sheets-sync`, `admin-api`, `nexus-envoyer-facture`
et `clever-endpoint` échoueront en recette. Le contrôle 6 passera donc
trivialement, sans rien prouver, et quatre fonctionnalités resteront hors
recette tant que ces fonctions ne seront pas déployées sur le projet de test.

## Rôles contrôlés

| Rôle | Compte | Testé | Anomalie |
|---|---|---|---|
| Manager | `manager-test` | ☐ écran / ☑ base | aucune au niveau base |
| Caissière | `employe-test-a` | ☐ écran / ☑ base | aucune au niveau base |
| Caissière (simultanéité) | `employe-test-b` | ☐ écran / ☐ base | non éprouvée : exige deux sessions réelles |
| Pompiste | — | ☐ | **aucun compte de test pompiste n'existe** |
| Renfort | — | ☐ | **aucun compte de test renfort n'existe** |
| Créateur | — | ☐ | **aucun compte créateur de test** — or le créateur traverse les sites par conception ; ce chemin n'est éprouvé par personne |

Les contrôles « base » ont été menés en usurpant l'identité en SQL
(`request.jwt.claims` + rôle `authenticated`), sans mot de passe.

## Scénarios d'isolation

| # | Scénario | Statut |
|---|---|---|
| I1 | Deux caissières connectées en même temps : aucune donnée de l'une visible chez l'autre | ⚠️ **partiel** — en base, `employe-test-a` ne voit qu'une ligne d'employé, la sienne ; la simultanéité à l'écran reste à éprouver |
| I2 | Une nouvelle prise de poste ne récupère aucun état d'un service précédent | ⏳ non éprouvé sur la recette ; couvert uniquement par `test_missions_isolation_prise_de_poste.js` |
| I3 | Aucune écriture ne porte le `site_id` de production | ✅ **vérifié par tentative réelle** : écriture sur `vito-sainte-marie` refusée par la RLS, y compris lorsque la colonne `site` est omise et prend son défaut. Site sentinelle intact. Voir la réserve structurelle plus bas. |
| I4 | Un employé n'atteint aucune page manager, même en saisissant son adresse | ⚠️ **partiel** — en base, l'écriture de configuration manager par un caissier est refusée ; le garde-fou d'écran reste à éprouver |
| I5 | Le bandeau MODE TEST est visible sur tous les écrans | ❌ **échec** à la date du test — corrigé depuis, non encore déployé |

**Sens production → recette.** La production n'a reçu aucune écriture de la
recette : les deux seules écritures du jour portent sur le site réel, à
06 h 25 locale, par des comptes non marqués `compte_test`.

## Anomalies bloquantes — constatées par appel réel

| # | Anomalie | Preuve | État |
|---|---|---|---|
| B1 | `nexus_stock_lire_etat_json({p_site})` et `nexus_stock_lire_etat({p_site})` : `SECURITY DEFINER` + `row_security=off` + `EXECUTE` à `anon`, site pris dans le paramètre. **119 lignes de stock d'un autre site rendues à un visiteur anonyme.** | `outils/verifier-isolation-supabase.mjs` | **corrigé** — migration `20260904175723`, appliquée sur Test, preuve rejouée : refus 401 |
| B2 | `employees_public` lisible par `anon` sans filtre de site : **annuaire complet des employés, tous sites confondus.** Couplé à une connexion prénom + PIN, l'espace à deviner tombe à un PIN. | idem | **partiellement corrigé** — migration `20260904175747`, appliquée sur Test, preuve rejouée : refus 401. **Mesure provisoire**, voir ci-dessous |
| B3 | Aucun bandeau d'environnement : la recette était visuellement identique à la production. `NEXUS_ENVIRONNEMENT` existait dans `nexus-auth.js` et n'était lu nulle part. | lecture d'écran | **corrigé et déployé** — `nexus-bandeau-environnement.js` ; une régression de hauteur découverte à la vérification du déploiement a été corrigée dans la foulée, voir ci-dessous |
| B4 | `robots.txt` de la recette en `Allow: /` : environnement public et indexable, portant une copie des données métier de la station. | `GET /robots.txt` | **corrigé et déployé** — réécrit au build pour le test ; vérifié sur la recette : `Disallow: /` |
| B5 | `nexus-config.js` servi en `max-age=0, must-revalidate` au lieu de `no-store` — un exemplaire conservé fait parler un écran à la mauvaise base. Constaté en séance : un navigateur a continué de servir la configuration « test » après passage du build en « production ». | `_headers` absent | **corrigé et déployé** — vérifié sur la recette : `cache-control: no-store` sur `nexus-config.js` |

### B2 — pourquoi la correction n'est que provisoire

Le cadrage de l'environnement de recette
(`.github/recettes/CADRAGE-nexus-test.md`, branche `securisation-vues`,
décidé le 04/09/2026) écarte explicitement la solution appliquée ici :
« Une simple fonction SECURITY DEFINER publique est exclue : elle contourne
RLS elle aussi et déplacerait la porte au lieu de la fermer. » Le
remplacement décidé est une Edge Function portant limitation de tentatives,
verrouillage de compte et réponses homogènes.

La mesure provisoire a été retenue parce que la fuite était atteignable le
jour même et que la recette restait bloquée tant que la connexion ne
fonctionnait pas. Ce qu'elle ferme : l'annuaire n'est plus listable. Ce
qu'elle laisse ouvert : **aucune limitation du nombre de tentatives**, et un
prénom valide reste distinguable par le temps de réponse. L'écran affiche
désormais un message unique pour un prénom inconnu et pour un PIN incorrect
— exigence n° 2 du cadrage, honorée dès maintenant.

Suite : `docs/plans/2026-09-04-connexion-non-enumerable.md`.

**Conditions posées par Frédéric le 04/09/2026, à respecter sans exception :**

- la mesure reste explicitement marquée provisoire, dans la migration comme
  ici ;
- elle **n'est jamais promue seule vers la production** ;
- le remplacement définitif reste l'Edge Function du cadrage — limitation
  atomique des tentatives, verrouillage, déverrouillage manager, réponses et
  délais homogènes ;
- le plan `2026-09-04-connexion-non-enumerable.md` est **bloquant avant toute
  promotion** : tant qu'il n'est pas soldé, aucune promotion générale n'est
  autorisée.

### Écart de migrations entre la base et la branche — réconcilié

Relevé le 04/09/2026 : 242 fichiers sur `config-par-environnement`, 242 lignes
dans `supabase_migrations.schema_migrations` de `nexus-test`. **Aucune
migration ne vit uniquement en base.** L'écart réel portait sur la
numérotation de trois d'entre elles, désormais alignées sur la base — même
correction que le commit `501c0c7` :

| Ancien nom de fichier | Version en base, retenue |
|---|---|
| `20260904130807_fermer_lecture_anonyme_sites` | `20260904140000_fermer_lecture_anonyme_sites` |
| `20260904181500_verrouiller_rpc_stock_par_site` | `20260904175723_verrouiller_rpc_stock_par_site` |
| `20260904182000_login_non_enumerable` | `20260904175747_login_non_enumerable` |

Le texte enregistré des deux migrations du jour a également été aligné sur
celui des fichiers : `md5` identique de part et d'autre, y compris pour la
requalification en mesure provisoire.

Reste à réconcilier, hors de cette fiche : la branche `securisation-vues`
porte une variante numérotée `20260904105000` de la migration d'urgence sur
les vues, là où la base et `config-par-environnement` portent la variante
`20260904105148`. Ce sont deux numérotations du même correctif ; c'est la
branche qui doit s'aligner, pas la base.

## Anomalies non bloquantes, à traiter en lots séparés

| Anomalie | Impact | Suivi |
|---|---|---|
| 9 tests de non-régression en échec (inventaire ×5, réception ×2, carburant ×1, pilotage ×1) | Antérieur au 04/09/2026, sans lien avec cette version | à reprendre |
| 58 colonnes `site`/`site_id` ayant pour défaut `'vito-sainte-marie'` | Bombe amorcée : la RLS intercepte aujourd'hui, le défaut reprendrait la main si une politique était assouplie | `docs/plans/2026-09-04-defauts-site-production.md` |
| 17 vues en `SECURITY DEFINER` | Ne fuitent pas en pratique — par accident de configuration, pas par règle | `docs/plans/2026-09-04-vues-security-definer.md` |
| `site-fantome-test` et 5 comptes `compte_test` vivant dans la base de PRODUCTION | Comptes réels dans la base réelle, sans usage depuis le 19/08 | `docs/plans/2026-09-04-nettoyage-comptes-test-production.md` |
| Aucune fonction Edge déployée sur `nexus-test` | 4 fonctionnalités hors recette | à ouvrir |
| Protection contre les mots de passe compromis désactivée (Supabase Auth) | Faible : les secrets sont des PIN numériques | à arbitrer |

## État du déploiement — 04/09/2026

| | |
|---|---|
| SHA du lot correctif | `95cc92a4ffc00f76b76c02fda020d3dd1c6a5877` |
| SHA correctif de suivi | `f3526ada0f0662f73b79648257aaf1562ca40c2c` |
| Branche | `config-par-environnement` — **non fusionnée**, `main` et `production` figées sur `501c0c7` |
| CI GitHub Actions | ✅ succès sur les deux SHA — épingles de cache, suite de non-régression comparée aux 9 échecs connus, simulations métier |
| Déploiement Cloudflare Pages | ✅ https://nexus-test-ddf.pages.dev |

Vérifié sur le site déployé, pas seulement en local :

- `nexus-config.js` → `environnement: "test"`, `https://udljdqxerrbbbajxubfn.supabase.co`, en-tête `cache-control: no-store` et `x-robots-tag: noindex` ;
- `robots.txt` → `Disallow: /` ;
- ordre des balises sur les écrans servis : `nexus-config.js`, puis `nexus-bandeau-environnement.js`, puis `nexus-auth.js` ;
- écran de connexion : plus aucune référence à `employees_public`, appel à `nexus_identifiant_de_connexion` ;
- bandeau MODE TEST affiché, marge de compensation à 30 px ;
- `outils/verifier-isolation-supabase.mjs` rejoué contre la recette déployée : aucune porte ouverte, sortie 0.

### Régression trouvée à la vérification du déploiement, et corrigée

Le bandeau posait sa compensation de hauteur d'après une mesure prise une
seule fois. Sur une page chargée sans largeur de fenêtre — onglet en
arrière-plan, page préchargée, démarrage à froid d'une PWA — le texte
s'enroulait sur une vingtaine de lignes et la marge valait **306 px au lieu
de 30**, définitivement : rien ne remesurait ensuite. Constaté sur la
recette déployée, invisible en local.

Corrigé par `f3526ad` : une hauteur hors de [1, 120] px retombe sur 30, et la
mesure est refaite sur `load` et sur `resize`. Quatre vérifications ajoutées,
dont la régression elle-même. C'est la démonstration que vérifier le déployé
et non le local n'était pas une formalité.

## Passe navigateur du 04/09/2026 — étape 1 sur 5

Menée dans Chrome, session réelle, sur `https://nexus-test-ddf.pages.dev`.
**Interrompue après l'étape 1** sur décision de Frédéric : l'anomalie A2 est
bloquante et doit être traitée avant de poursuivre.

### Bloquant préalable — A1, levé

| | |
|---|---|
| Écran / action | `NEXUS-Login-v1` — saisie prénom + PIN |
| Rôle | les trois comptes |
| Requête | `POST /auth/v1/token?grant_type=password`, `email: manager-test@vito-nexus.local` |
| Attendu | session ouverte |
| Obtenu | `400 Invalid login credentials` |
| Cause | Comptes créés en `@nexus-test.local`, écran construisant `@vito-nexus.local`. Deux conventions dans deux fichiers qui ne se rencontraient pas : `NEXUS-Login-v1.html:170` et `outils/reinitialiser-scenario-test.sh:63`. **Aucune connexion n'avait jamais pu aboutir sur la recette** — d'où des contrôles 7 et 8 jamais passés. |
| Correction | Alignement des trois identités sur `nexus-test` (`id`, PIN, `created_at` inchangés) + constante `DOMAINE_LOGIN` et garde-fou bloquant dans le script de réinitialisation |
| Preuve | `last_sign_in_at` = 18:46:16, session active |

### Étape 1 — Manager Test

| Contrôle | Résultat |
|---|---|
| Ouverture de session | ✅ |
| Rôle affiché | ✅ Manager, quart Soir |
| Site affiché (en-tête) | ✅ NEXUS STATION TEST |
| Écrans accessibles | ✅ Prise de poste → App → Radar du Manager |
| Trafic réseau | ✅ 42 appels REST, tous vers `udljdqxerrbbbajxubfn` |
| Requête vers Supabase production | ✅ aucune |
| Fonction Edge production | ✅ aucune |
| Données d'un autre site | ✅ 40 requêtes site-scopées, toutes sur `nexus-station-test` |

### Étape 2 — Employé Test A (caissière)

Menée après les lots A2, A4 et A8. Session propre, prise de poste, pointage
avec photo, six écrans visités.

| Contrôle | Résultat |
|---|---|
| Boucle de redirection | ✅ aucune |
| URL stable | ✅ 70 à 80 caractères, un seul `?retour=` |
| Prise de poste | ✅ trois rôles proposés, **pas Manager** |
| Pointage | ✅ arrivée 23:10, photo, retard 7 min |
| Rôle affiché | ✅ CAISSIER |
| Site affiché | ✅ NEXUS STATION TEST |
| Écriture du service | ✅ `site = site_id = nexus-station-test` |
| Requête vers production | ✅ 0 sur 6 écrans |
| Fonction Edge production | ✅ 0 |
| Donnée d'un autre site | ✅ 0 |
| Scripts débloqués par A8 | ✅ 4/4 sur l'accueil, 4/4 sur l'Inventaire |

Écrans manager en saisissant l'adresse : Radar du Manager et Carburants
Pilotage s'ouvrent puis affichent « Cet écran est réservé aux managers » —
aucune donnée. Le Cockpit s'ouvre normalement, et c'est correct : il figure
dans l'offre Essential. **Nuance à retenir : l'écran n'est pas refusé, il
s'ouvre et se vide. La barrière est dans l'écran, pas dans la navigation.**

Isolation éprouvée en base sous l'identité de A : voit son service et lui
seul, ne voit ni le service ni les données du manager, ne peut ni les
modifier ni les supprimer (0 ligne), ne peut ni écrire au nom d'un autre ni
prendre un poste manager (refus `42501`).

### Étape 3 — Employé Test B (pompiste)

| Contrôle | Résultat |
|---|---|
| Boucle de navigation | ✅ aucune |
| URL stable | ✅ 45 à 76 caractères |
| Prise de poste | ✅ rôle Pompiste, rappel de sécurité propre au poste affiché |
| Pointage | ✅ validé, seconde photo |
| Écriture du service | ✅ `site = site_id = nexus-station-test` |
| Requête vers production / Edge | ✅ 0 / 0 |
| Donnée d'un autre site | ✅ 0 |
| Satellites A8 sur Inventaire | ✅ 4/4 |
| Trace de A ou du Manager à l'écran | ✅ **aucune** — recherche explicite des chaînes « Test A », « employe-test-a », « Manager Test », « manager-test » dans le texte rendu de chaque écran |

### Étape 4 — Isolation croisée A ↔ B

| Tentative | Résultat |
|---|---|
| B voit **son** service | 1 ✅ |
| B voit le service de A | **0** ✅ |
| B voit le **pointage** de A | **0** ✅ |
| B voit le service du Manager | **0** ✅ |
| B voit les autres employés | 1 — lui seul ✅ |
| B **modifie** le service de A | **0 ligne** ✅ |
| B **supprime** le pointage de A | **0 ligne** ✅ |
| A voit **son** service | 1 ✅ |
| A voit le service de B | **0** ✅ |
| A voit les pointages de B | **0** ✅ |
| A **modifie** le service de B | **0 ligne** ✅ |
| Manager voit l'équipe | **3 services** ✅ |
| …dont hors de son site | **0** ✅ |

Deux employés du même site sont cloisonnés **dans les deux sens**, en lecture
comme en écriture, et le manager voit toujours son équipe : le cloisonnement
n'a pas été obtenu en cassant la hiérarchie prévue.

**Note de méthode, à conserver.** La première sonde résolvait les
identifiants de référence *sans identité*, donc à `NULL` : tous les compteurs
valaient zéro, y compris « B voit son propre service ». Elle ressemblait à
une isolation parfaite alors qu'elle ne mesurait rien. La sonde retenue
vérifie d'abord que les services et le pointage de référence existent, et
échoue sinon. Un test d'isolation qui ne peut pas distinguer « rien n'est
visible » de « rien n'a été cherché » ne prouve rien.

### Étape 5 — Contrôles finaux

Collectés en continu sur les trois comptes et dix écrans. Résultats repris
dans le bilan en tête de fiche.

## A2 — deux identités de site sur une même ligne *(bloquant, corrigé)*

| | |
|---|---|
| **Écran** | `NEXUS-Prise-De-Poste-v1` |
| **Action** | Sélection du rôle Manager, « Confirmer ma prise de poste » |
| **Requête** | `POST /rest/v1/shifts` → 201 |
| **Rôle** | Manager, puis reproduit pour un caissier |
| **Attendu** | La ligne porte le site du compte sur toutes ses colonnes de site |
| **Obtenu** | `site = 'nexus-station-test'`, **`site_id = 'vito-sainte-marie'`** |

**Cause.** `shifts` et `mission_catalog` portent chacune `site` et `site_id`,
`text`, `NOT NULL`, avec le même `DEFAULT 'vito-sainte-marie'`. Les 7
politiques RLS des deux tables s'appuient **toutes** sur `site_id` ; aucune sur
`site`. L'application, elle, écrit l'une ou l'autre selon l'écran — `site` en
Prise de poste, `site_id` au Scanner, les deux dans Tempo. La colonne omise
prenait le défaut, c'est-à-dire la production, et la politique d'insertion de
`shifts` ne contrôlait ni l'un ni l'autre : seulement `employee_id` et le rôle.

**Portée réelle.** `mission_catalog` portait déjà **89 lignes sur 208** avec
deux sites différents. En multi-site, `select_shifts` filtrant sur `site_id`,
un manager n'aurait pas vu les services de son équipe, et un manager de
`vito-sainte-marie` aurait vu ceux de tous les autres commerces.

**Pourquoi trois passes SQL ne l'avaient pas vue.** Elles portaient sur des
tables à colonne de site unique — `inventaire_zones` notamment. Seule une
écriture réelle par l'écran pouvait la révéler. C'est l'argument de cette
recette navigateur.

**Correction** — migration `20260904193000`, trois verrous indépendants :
contrainte `site = site_id` ; déclencheur imposant le site du compte et
refusant toute valeur divergente fournie par le client ; RLS d'insertion
vérifiant enfin le site. Défauts de production retirés des quatre colonnes.
Données réparées : 1 ligne `shifts`, 89 lignes `mission_catalog`.

**Non fait, volontairement.** La colonne `site` n'est pas supprimée : le code
déployé l'écrit encore. Cible décrite dans
`docs/plans/2026-09-04-site-source-unique.md`.

## A8 — boucle de redirection infinie sous Cloudflare *(bloquant, corrigé)*

| | |
|---|---|
| **Écran** | `NEXUS-Prise-De-Poste-v1`, puis `NEXUS-Pointage-v1` |
| **Action** | Ouverture de session Employé Test A, chargement de n'importe quel écran |
| **Rôle** | Caissier — et tout rôle non-manager. Manager Test n'est pas touché : son garde de prise de poste rend la main avant |
| **Requête** | 68 chargements en chaîne de `/NEXUS-Prise-De-Poste-v1`, chacun ajoutant un niveau de `?retour=` ré-encodé |
| **Attendu** | L'écran de prise de poste s'affiche et propose les rôles |
| **Obtenu** | Écran bloqué sur « Chargement… », URL de plusieurs milliers de caractères, boucle sans fin, **aucune erreur console** |

**Cause.** Le code identifiait la page en comparant le dernier segment de
l'URL à des noms de fichiers avec extension. GitHub Pages sert
`/NEXUS-Prise-De-Poste-v1.html` ; **Cloudflare Pages répond 308 vers la forme
sans extension**. La page ne se reconnaissait plus dans
`NEXUS_PAGES_SEQUENCE_OBLIGATOIRE`, concluait que la prise de poste manquait,
et redirigeait vers elle-même.

**Ce n'est pas un bug latent : c'est une différence d'environnement.** Sur
GitHub Pages, qui sert la production, le garde fonctionne. Le défaut n'existe
que sur Cloudflare — l'hébergeur vers lequel la production doit migrer. La
production ne pouvait pas le révéler ; la recette, si.

**Portée réelle, au-delà de la boucle.** L'inventaire a trouvé **21
comparaisons** de ce type. Outre les 2 gardes, **17 aiguillages de chargement
de scripts** dans `nexus-auth.js` et **13 gardes d'auto-désactivation** dans
les satellites Inventaire et Carburants : sous Cloudflare, une quinzaine de
scripts ne se chargeaient pas et treize fonctionnalités sortaient
immédiatement — **absentes, en silence**. Les écrans s'affichaient, amputés.

**Non concerné, vérifié plutôt que supposé :** le verrou de forfait
(`nexus-forfait.js`) reçoit un nom de fichier en dur depuis chaque écran
Professional, jamais l'URL. Il n'est pas cassé. `NEXUS-App-v1.html:2303`
compare un `href` du catalogue interne, pas l'URL : consigné, non modifié.

**Correction.** Une couche unique, `nexus-page.js` : `NexusPage.identifiant()`
retire fragment, query et extension ; `NexusPage.est()` normalise **les deux
côtés** de la comparaison. Les littéraux restent écrits comme des noms de
fichiers. Posée au build sur les 53 écrans, entre `nexus-config.js` et le
bandeau, donc avant `nexus-auth.js` et avant les scripts qu'il injecte.
`nexus-auth.js` refuse de démarrer avec un message explicite si elle manque.

L'URL de retour n'est **pas** normalisée, délibérément : elle doit conserver
l'extension telle que l'hébergeur la sert — sur GitHub Pages, un nom sans
`.html` ne résout pas. Un test le verrouille.

**Preuve.** `test_identification_page_20260904.js`, 33 vérifications. Avant :
`/NEXUS-Prise-De-Poste-v1` non reconnue → boucle. Après : reconnue sous les
deux hébergeurs, avec ou sans query, avec ou sans fragment ; boucle mesurée à
**0 tour**.

## A7 — l'accueil public ne porte pas le bandeau MODE TEST

| | |
|---|---|
| **Écran** | `index.html` — page vitrine, sur laquelle la déconnexion renvoie |
| **Attendu** | Savoir qu'on est sur la recette |
| **Obtenu** | Aucun bandeau, aucune configuration chargée : la page est identique à celle de production |

Elle n'est pas dans les 53 écrans traités par le build — elle ne charge ni
`nexus-auth.js` ni la configuration. Sévérité faible : page vitrine, aucune
donnée. Mais son bouton « Voir l'app en direct » mène à la recette sans que
rien ne le dise. Même famille qu'A3.

## A3 à A6 — hors correctif A2

| # | Anomalie | Portée | Suivi |
|---|---|---|---|
| **A3** | « Vito Sainte-Marie Usine », nom du commerce de production, **écrit en dur dans 39 écrans** (46 occurrences). S'affiche en pied de page de la Prise de poste alors que la session est sur `nexus-station-test`. L'en-tête, lui, lit la base. | Défaut multi-tenant : tout client verrait ce nom | à ouvrir |
| **A4** | Deux `console.error` sur l'écran d'accueil (« Chargement products (accueil) : aucune ligne exploitable », « (marge accueil): null »). Cause bénigne — base de recette vide — mais le contrôle « aucune erreur console » ne passait pas tel qu'énoncé. | Contrôle final 3 en échec | **corrigé** — lot séparé : le contrôle n'est PAS assoupli, c'est la journalisation qui est corrigée. Une absence de données est un état métier normal (`console.info`) ; `console.error` reste réservé aux erreurs de la base. Les deux cas, jusque-là confondus dans la même condition, sont séparés. |
| **A5** | Deux requêtes `HEAD` en **503** : comptage `pointages`, comptage `fdj_alertes`. Non reproduites au rechargement. | Intermittent, cause non établie | à surveiller |
| **A6 — FERMÉ le 05/09/2026** | Le pied de page annonçait `build 20260904-0104 · commit b219da5` alors que neuf commits avaient été déployés depuis. L'identifiant est un horodatage posé **à la main** avant de committer : il porte donc le commit *précédent*, et se fige dès que personne ne relance l'outil. La CI vérifiait que tous les actifs partageaient le même identifiant, **jamais que cet identifiant correspondait au code servi** : elle est passée au vert neuf fois de suite. | **Défaut de traçabilité de version.** Voir la précision ci-dessous sur le cache | **corrigé et prouvé sur le déploiement réel** — `outils/build.sh`, empreinte de contenu, `CF_PAGES_COMMIT_SHA`, `nexus-build.js` non versionné, échec fermé au build, contrôle d'exécution |

## A4-bis — trois états, un seul niveau de gravité *(corrigé le 05/09/2026)*

Balayage global : **928 `console.error`** dans le code applicatif, sur 97
fichiers — contre **8 `console.warn`** et **10 `console.info`**. NEXUS n'avait
pratiquement qu'un seul niveau de gravité.

Ce n'était pas un problème de propreté de console. Un système qui ne distingue
pas « aucune donnée », « donnée incohérente » et « requête échouée » perd sa
capacité de diagnostic.

### Répartition

| | Catégorie | Avant | Après |
|---|---|---|---|
| C | Erreur technique — correcte | 916 | 923 |
| D | Condition mixte : erreur **et** absence confondues | **7** | **0** |
| B | Anomalie métier | **4** | 0 (passées en `warn`) |
| A | Absence normale traitée en erreur | **1** | 0 (passée en `info`) |

**916 sur 928 étaient déjà corrects.** C'est le constat principal, et il faut
le dire : l'écrasante majorité des gardes est saine.

### Le motif qui coûtait le plus

```js
if (error || !data || !data.length) { console.error('Chargement products:', error); return []; }
```

Sept occurrences. Une base tombée et une table vide produisaient **la même
ligne** — et quand c'était l'absence qui déclenchait, `error` valait `null` :
la console affichait « Chargement products: null ». Devant cela, personne ne
peut dire si Supabase est en panne ou si le commerce n'a pas encore importé
ses ventes. Le diagnostic était perdu **dans les deux sens**.

### Règle retenue

| État | Niveau |
|---|---|
| Requête échouée, exception, module absent | `console.error` |
| Requête réussie, 0 donnée, état normal | `console.info` ou silence |
| Données présentes mais incohérentes, précondition métier absente | `console.warn` |

Les quatre anomalies métier passées en `warn` disent désormais ce qu'elles
constatent : « des lignes existent mais aucune période exploitable n'a pu être
déterminée — données incohérentes, pas une absence », et « aucune prise de
poste active — incohérence de contexte métier, pas une panne technique ».

### Note de méthode — l'instrument était faux avant le code

Le premier passage d'audit a annoncé **909 C / 20 D / 0 A**. Le second, après
correction du motif de détection, a donné **916 C / 7 D / 1 A / 4 B**.

**Les deux chiffres venaient du même code : c'est l'outil de mesure qui était
faux.** Le premier classificateur regardait toute la ligne d'appel, où une
variable d'erreur figure presque toujours ; le second regarde la **condition
qui gouverne** l'appel. Et il a fallu un troisième passage pour reconnaître le
vocabulaire d'erreur francophone de NEXUS — `erreurUpload`, `errSeuil`,
`eSnap`, `e10`, `sourceError` — que les deux premiers classaient comme « non
classés », soit 195 appels parfaitement corrects.

Le premier chiffre aurait fait chercher treize problèmes inexistants et
manquer les quatre anomalies métier. C'est le risque propre à l'audit outillé,
et la raison pour laquelle le test de non-régression reconnaît explicitement
ces alias.

### Le test garde le motif, pas les chiffres

Deux règles sémantiques : aucun `console.error` sous une garde de vacuité
seule, aucune condition mêlant erreur et vacuité. Le compteur d'erreurs
techniques n'est **pas** une cible — il a vocation à croître quand on ajoute de
vraies gardes. Il n'existe que comme plancher contre une extinction massive des
journaux, et ne doit jamais devenir un seuil qu'on ajuste à chaque ajout
légitime.

## A11 — rôle habituel, rôle du jour, permissions *(corrigé le 05/09/2026)*

Audit transversal : **162 occurrences applicatives + 137 politiques RLS**, soit
299 points de décision. Trois notions que NEXUS confondait implicitement :

- **rôle habituel** = `employees.role` — ce que l'employé **est** ;
- **rôle du jour** = `shifts.role` — ce qu'il **fait** aujourd'hui ;
- **permissions** = dérivées de la fiche, **jamais** du rôle du jour.

### Répartition des 87 usages de `employees.role`

| | Catégorie | Nombre |
|---|---|---|
| C | Permission — correct sur la fiche | **57** |
| A | Rôle administratif — correct | 16 |
| B | Devrait lire le rôle du jour | 8 |
| D | Ambigu | 6 |

### Pourquoi l'audit dit 57 et le test 55

Les deux chiffres sont justes ; ils ne mesurent pas la même chose.

- **55** est le nombre de **lignes** portant à la fois `employee.role` et un
  littéral `'manager'` ou `'gerant'`. C'est ce que compte le test, qui
  travaille ligne par ligne.
- **57** est le nombre de **décisions de permission**. Deux d'entre elles
  déclarent leur ensemble de rôles sur une ligne — `const ROLES_AUTORISES =
  new Set(['manager','gerant'])` — et l'appliquent sur une **autre** :
  `ROLES_AUTORISES.has(employee.role)`. La ligne d'usage ne contient aucun
  littéral, elle échappe donc au comptage par ligne.

  - `nexus-inventaire-transferts-internes.js` : déclaration ligne 8, usage ligne 26
  - `nexus-inventaire-stock-controle-cible-v2.js` : déclaration ligne 8, usage ligne 14

Le test vérifie **les deux** : le décompte de 55 lignes, **et** que les deux
ensembles de constantes valent toujours `{manager, gerant}` et restent lus sur
la fiche. Aucune des 57 décisions n'a été modifiée par ce lot.

### Anomalies corrigées

| # | Anomalie | Nature | Correction |
|---|---|---|---|
| A11-a | Cockpit et Brief affichaient le rôle **habituel** dans un badge décrivant l'activité en cours | affichage | badge sur le rôle du service ; **vide** si aucun service fiable, plutôt que faux |
| A11-b | L'Inventaire retombait silencieusement sur la fiche en cas d'erreur réseau ou d'absence de service, et `zonesPourRole` en déduisait la zone : **un pompiste du jour comptait la boutique** | **métier** | plus aucun repli. Le poste est établi, ou le workflow s'arrête et l'explique |

**Comportement de l'Inventaire quand le poste est indéterminé** — aucune zone
sélectionnée, aucune écriture, écran d'arrêt distinguant panne réseau et
absence de prise de poste, bouton **Réessayer**, lien **Prendre mon poste**, et
l'erreur technique en console. Le principe posé : *un comptage retardé vaut
mieux qu'un comptage attribué à la mauvaise zone.*

### A11-c — FDJ : non corrigé, et c'est délibéré

La signature de clôture persiste le rôle habituel. L'arbitrage de principe est
pris — la trace doit porter le rôle **exercé au moment de l'acte** — mais le
rattachement au service n'est **pas fiable** : la signature porte
`quart_id = fdj_shifts.id`, qui identifie le quart FDJ et non le service
employé ; aucune clé étrangère ne relie les deux ; `fdj_shifts.employee_id` est
nullable ; une clôture peut être saisie après la fin du service et corrigée
ensuite par un manager, qui n'est pas le titulaire du quart.

Remplacer par « le rôle du service actif maintenant » serait **faux plus
souvent qu'aujourd'hui**. Lot séparé avec migration :
`docs/plans/2026-09-05-fdj-role-exerce.md`.

### Ce qui n'était pas une anomalie

Les **137 politiques RLS** et les 57 contrôles applicatifs lisent la fiche —
correct, et à ne pas toucher. Une **seule** politique dérive du rôle du jour,
`select_mission_assignments`, et c'est légitime : un travail confié au pompiste
doit s'afficher chez qui est pompiste ce jour-là. Le test attendait zéro ;
**l'attente était fausse et a été corrigée** à un, nommée et justifiée, avec
échec si ce nombre augmente sans relecture.

Missions et Accueil filtraient déjà sur le rôle du jour. La **paye** est
exemplaire : barème sur le poste constaté, fiche pour l'inclusion salariale, et
la divergence **nommée** dans le bulletin — « poste constaté dans Verify,
différent du rôle "caissier" ».

Vérifié en base : un non-manager ne peut pas prendre un service `manager`
(refus `42501`) ; `current_employee_role()` reste `caissier` pour un employé
pompiste du jour ; le manager conserve rôle et vue d'équipe.

### Contrat `NexusRole` — validé architecturalement, non généralisé

```
NexusRole.habituel()       employees.role — identité administrative
await NexusRole.duJour()   { role } ou { indetermine } — jamais de repli
NexusRole.peut(capacite)   habilitation, dérivée de la FICHE
```

`roleEffectif()` est **écarté** : avec 57 permissions sur 87 usages, une API au
nom neutre finirait tôt ou tard dans un contrôle d'accès. Le code doit dire ce
qu'il veut.

### A11-5 — dette structurelle, non traitée

Trois vocabulaires pour la même notion : `employees.role` ∈ {caissier,
pompiste, renfort, manager, gerant, vacataire}, `shifts.role` ∈ {pompiste,
**caissiere**, renfort, manager, **polyvalent**}. `caissier` ≠ `caissiere` :
toute comparaison directe échoue silencieusement, et chaque écran bricole son
propre pont. **C'est la cause profonde d'A11.** Chantier séparé, avec migration.

## A9 à A12 — relevées pendant la passe navigateur

### A9 — le pointage exige une photo *(contrainte normale, pas une anomalie)*

L'écran de Pointage demande une photo pour valider l'arrivée, et tant qu'elle
n'est pas prise, aucun autre écran n'est atteignable. C'est le parcours
employé prévu, pas un défaut : consigné pour que la contrainte soit connue de
qui reprend la recette. Les deux arrivées ont été pointées avec photo par
Frédéric ; aucune capture n'a été déclenchée automatiquement.

### A10 — pas de déconnexion depuis le Pointage

Une fois l'arrivée enregistrée, l'écran de Pointage ne propose aucun lien de
déconnexion. Sur un poste partagé au comptoir d'une station, l'employé qui
termine laisse la session ouverte sous son identité. Sévérité faible, mais
réelle en exploitation. Contourné pendant la recette en appelant la
déconnexion du client applicatif.

### A11 — le Cockpit affiche le rôle habituel, pas le rôle du jour

| | |
|---|---|
| **Écran** | `NEXUS-Cockpit-v2` |
| **Action** | Prise de poste en **Pompiste**, puis ouverture du Cockpit |
| **Rôle** | Employé Test B |
| **Attendu** | « POMPISTE » — le rôle du jour, que la prise de poste vient de fixer |
| **Obtenu** | « **CAISSIER** » — la valeur de `employees.role`, le rôle habituel |

L'accueil affiche « Pompiste · Votre service est en cours » et Missions
affiche « Rôle du jour : pompiste » : ces deux écrans lisent le service. Le
Cockpit lit la fiche employé.

Aucune donnée ne fuit, mais cela contredit la doctrine du rôle du jour, qui
est la raison d'être de la prise de poste. **Invisible avec A**, dont le rôle
du jour coïncidait avec le rôle habituel : c'est B qui l'a révélé — la raison
d'être d'un second employé de recette.

### A12 — un renommage de migration désaligné avec la production

| | |
|---|---|
| **Origine** | Commit `95cc92a`, pendant le lot A2 |
| **Action** | `20260904130807_fermer_lecture_anonyme_sites.sql` renommé en `20260904140000_…` pour s'aligner sur la version enregistrée par `nexus-test` |
| **Problème** | **La production a enregistré cette migration sous `20260904130807`.** Le fichier suivait la production avant ce renommage ; il ne la suit plus |
| **Risque** | À la promotion, l'outillage Supabase peut voir `20260904140000` comme une migration **nouvelle** et la rejouer sur une base où elle est déjà appliquée |
| **Statut** | Erreur introduite pendant la recette, assumée. **Aucun renommage de migration ne sera plus fait avant arbitrage.** Plan séparé : `docs/plans/2026-09-04-alignement-migrations.md` |

### A14 — une seconde chaîne de versionnement, révélée par le contrôle d'A6 *(FERMÉ le 05/09/2026)*

**À conserver dans l'histoire de NEXUS.** Le mécanisme de traçabilité posé par
A6 n'a pas seulement corrigé un pied de page : quelques minutes après sa mise
en service, son contrôle d'exécution a signalé sur le **déploiement réel** un
mélange de générations vieux de cinq jours, que ni la CI, ni la recette, ni
aucune relecture n'avaient jamais vu.

```
NEXUS — mélange de générations détecté (attendu 6573b1de07fa) :
  nexus-horizon-operationnel.js → 20260831-1408
  nexus-stock-moteur.js         → 20260831-1408
  nexus-reappro-stock-v1.js     → 20260831-1408
  nexus-conseiller-stock-v3.js  → 20260831-1408
  nexus-cockpit-stock-v3.js     → 20260831-1408
```

`nexus-auth.js` entretenait sa propre constante de génération, figée au
31 août. Le Cockpit chargeait donc cinq fichiers vieux de cinq jours pendant
que le reste de l'écran était à jour — exactement le scénario « nouvel écran,
ancien moteur » que l'épinglage sert à rendre impossible. Invisible à tous les
contrôles antérieurs : l'URL était construite par interpolation, il n'existait
aucun littéral à inspecter.

**L'inventaire s'est élargi en quatre vagues**, et c'est la leçon la plus
utile :

| Vague | Découverte | Portée |
|---|---|---|
| 1 | Contrôle runtime, Cockpit déployé | 5 scripts |
| 2 | Littéraux + boucles `forEach` dans `nexus-auth.js` | **18** |
| 3 | Scripts injectés **sans aucune épingle**, même fichier | **32** |
| 4 | Contrôle runtime, Inventaire déployé, **après** le premier correctif | **4 de plus**, dans deux autres fichiers |

La quatrième vague est la plus instructive : `nexus-header-nav.js` et
`nexus-inventaire-mission-rules-donnees.js` injectaient quatre scripts sans
épingle. Invisibles au contrôle d'exécution — il n'inspecte que les balises
présentes au chargement, or ceux-là sont ajoutés plus tard — et invisibles au
premier correctif, qui ne regardait qu'un fichier. **J'avais corrigé un
fichier ; le défaut était une pratique.**

**Correction.** La constante disparaît. Une primitive unique,
`NexusBuild.versionner()`, portée par le fichier qui porte déjà l'identité,
devient le seul moyen de construire une URL épinglée — sans repli d'aucune
sorte, car une valeur de repli serait une seconde génération, c'est-à-dire le
défaut qu'on retire. Les vérifications portent désormais sur **tous** les
fichiers applicatifs.

C'est le genre de dette qu'un système de build fiable doit rendre impossible,
et non pas seulement signaler.

**Preuves de fermeture, sur le déploiement Cloudflare réel :**

| Déploiement | Génération | Ce qu'il démontre |
|---|---|---|
| `bd5bd60` | `6573b1de07fa` | chaîne A6 en service ; le contrôle révèle A14 |
| `04dbcd4` | `b9cd40a00ba4` | `nexus-auth.js` modifié → génération modifiée |
| `0af560d` | `e6febf4cb905` | 3 fichiers modifiés → génération modifiée |
| `9f4188e` | `e6febf4cb905` | **documentation seule → génération INCHANGÉE** |

Chaque génération calculée par Cloudflare est **identique à celle calculée en
local** : le déterminisme n'est pas une intention, il est mesuré.

Sur Cockpit et Inventaire : `coherent = true`, 20 et 21 scripts chargés, **0
hors génération**, **0 occurrence** de `20260831-1408` ni de `20260904-0104`,
**0 script dynamique sans épingle** hors les deux exceptions prévues
(`nexus-build.js`, qui porte l'identité, et `nexus-config.js`, servi en
`no-store`). 0 appel Supabase production, 0 fonction Edge. Ordre
`build → config → page → bandeau → auth` vérifié sur les quatre écrans
authentifiés.

Rejeu A8/login : URL à 70 caractères, aucune boucle, aucune erreur console.

**Nuance conservée par exactitude** : l'écran de connexion porte
`config → build → page → bandeau` — la configuration avant l'identité. Sans
conséquence, il ne charge pas `nexus-auth.js` et le bandeau, seul consommateur
de la configuration, vient après elle. Reliquat de la balise committée à la
main dans ce fichier.

### A6 — précision sur le cache, à ne pas laisser déformée

J'ai d'abord écrit qu'un fichier modifié servi sous une épingle inchangée
était « potentiellement servi depuis le cache ». C'est **trop fort pour
Cloudflare** : Pages sert tout en `cache-control: public, max-age=0,
must-revalidate`, donc le navigateur revalide à chaque chargement et reçoit la
version courante. C'est pourquoi le correctif A4 est passé sans que l'épingle
bouge.

Le défaut A6 est donc **d'abord et principalement un défaut de traçabilité de
version** : depuis un écran, on ne pouvait pas savoir quel commit servait la
page. Ce n'est pas la preuve qu'un ancien fichier était servi depuis le cache.

Le risque de cache reste réel ailleurs, et c'est pourquoi l'épinglage garde
son sens : sur **GitHub Pages**, qui sert la production avec un `max-age` de
dix minutes, et dans le cache mémoire d'un onglet déjà ouvert.

## Défense en profondeur — requêtes sans filtre de site

Relevées pendant l'étape 1, à verser à l'audit de défense en profondeur. La
RLS les cadre correctement aujourd'hui ; elles ne portent aucun filtre propre.

| Requête | Table | Filtre de site |
|---|---|---|
| `GET /rest/v1/mission_completions?select=points` | `mission_completions` | aucun — RLS seule (`select_mission_completions` sur `site_id`) |
| `GET /rest/v1/pointages?select=employee_id,retard_min&type=eq.arrivee&retard_min=gt.0` | `pointages` | aucun — RLS seule (`select_pointages` sur `site`) |

Aucune correction demandée dans A2. À traiter comme question d'architecture :
une requête qui ne dit pas ce qu'elle veut dépend entièrement d'une politique
qu'elle ne nomme pas.

À noter au passage : les politiques d'insertion de `mission_completions` et
`mission_progress` ne vérifient **ni site ni site_id** — même forme que le trou
de `shifts` corrigé par A2, sur des tables où la colonne unique rend l'anomalie
moins visible.

## NON ÉPROUVÉ

Ce ne sont pas des anomalies : ce sont les **trous de couverture de la recette
elle-même**. Ils restent NON ÉPROUVÉS quel que soit le résultat des contrôles,
et doivent être relus à chaque fiche tant qu'ils subsistent. Cette section est
la plus importante à ne pas laisser se périmer : une recette qui ne dit pas ce
qu'elle n'a pas testé se lit comme une recette complète.

### Ce qui n'a pas été exercé

- **Rôles** : pompiste et caissière l'ont été — par la prise de poste de B et
  de A, pas par des comptes dédiés. **Renfort** est proposé à l'écran et
  jamais exercé. **Créateur** n'a aucun compte : c'est le seul profil qui
  traverse les sites par conception, et la branche créateur de la garde
  `nexus_site_autorise` ajoutée par A2 **n'est parcourue par aucun test**.
  Le profil « authentifié sans ligne `employees` » n'a pas été éprouvé.
- **Simultanéité** : le scénario I1 demande deux employés connectés *en même
  temps*. A et B ont été éprouvés **successivement**. Le cloisonnement est
  prouvé en base dans les deux sens ; deux sessions navigateur ouvertes
  simultanément ne l'ont pas été.
- **Reprise de poste (I2)** : chaque compte n'a pris qu'un seul service. Le
  cas d'un second service pour le même employé, et la non-reprise de l'état
  du service précédent, n'ont pas été joués.
- **Parcours** : cycle de pointage complet (début et fin de pause, départ),
  comptage d'inventaire réel, complétion de mission, FDJ, Progression.
- **Écrans jamais ouverts** : Scanner, Tempo, Campagne, Capital, Planning,
  Journal, Assignations, Résultats Équipe, Évaluation Employé, Traçabilité,
  Paramètres Station, Paramètres Inventaire, Admin Sites.
- **Procédures de retour** : les migrations de la recette ont une procédure de
  restauration rédigée, **non essayée** — la rejouer rouvrirait volontairement
  une fuite. La restauration d'une sauvegarde n'a jamais été testée sur ce
  projet.

### NV1 — trois profils n'ont aucun compte de test

`nexus-test` ne porte que trois comptes : `manager-test`, `employe-test-a`,
`employe-test-b`. Il n'existe **aucun compte pompiste, aucun compte renfort,
aucun compte créateur**.

Le cadrage prévoit que `employe-test-a` endosse successivement Caissière,
Pompiste et Renfort — mais ce basculement de rôle n'a pas été éprouvé, et le
rôle est lu depuis `employees.role`, pas choisi à l'écran. Le **créateur** est
le cas le plus sérieux : il traverse les sites par conception
(`je_suis_createur()` + `sites.acces_createur_autorise`, vrai sur les trois
sites de test), c'est donc le seul profil capable de lire légitimement
plusieurs sites — et personne ne l'éprouve. La garde ajoutée sur les RPC stock
comporte une branche créateur qu'aucun test ne parcourt.

**Conséquence :** l'isolation croisée est validée entre deux caissiers d'un
même site. Elle n'est validée ni pour un pompiste, ni pour un renfort, ni pour
un créateur.

### NV2 — aucune fonction Edge sur `nexus-test`

Le projet de recette n'héberge **aucune** Edge Function. Les écrans appellent
pourtant `admin-api`, `google-sheets-sync`, `nexus-envoyer-facture` et
`clever-endpoint`, toutes construites depuis `NEXUS_SUPABASE_URL` — elles
échoueront donc en recette.

Le contrôle n° 6 (« aucune fonction Edge de production appelée ») passera
donc, mais **sans rien prouver** : on ne peut pas appeler par erreur une
fonction de production dans un environnement qui n'appelle aucune fonction du
tout. Les fonctionnalités correspondantes — API d'administration,
synchronisation Google Sheets, envoi de facture, scanner produits — **ne sont
pas couvertes par la recette**.

## Décision

| | |
|---|---|
| Recette validée le | **— NON VALIDÉE** |
| Motif | **A6 fermé le 05/09. Reste A12, A11, A4-bis, A3 et la couverture des points non éprouvés.** |
| Mise en production autorisée par | **— PERSONNE. Promotion interdite en l'état.** |
| SHA promu en production | **aucun** |
| SHA éprouvé par cette passe | `58e394b9b6f853207b65e176ec08411f23db46f8` — sous la réserve d'A6, qui empêche précisément de le garantir depuis un écran |
| Non-régression en production vérifiée le | sans objet |
| Retour arrière possible vers | `production` figée sur `501c0c7`, inchangée et non touchée |

**Où en est le verdict.** Huit anomalies bloquantes ont été constatées et
**toutes corrigées** — deux fuites de données atteignables sans
authentification, une double identité de site en base, une boucle de
redirection rendant l'application inutilisable pour tout compte non-manager,
et l'impossibilité de se connecter. La huitième, **A6**, a été fermée le
05/09/2026 avec **A14** qu'elle a elle-même révélée — sur preuves faites
contre le déploiement réel.

**Ce qu'il reste avant de pouvoir valider**, dans l'ordre arbitré :

1. **A12** — l'écart de numérotation de migration, qui touche à la sûreté
   d'une future promotion de schéma ;
2. **A11** — le Cockpit doit lire le rôle du jour ;
3. **A4-bis** — balayage global de la journalisation ;
4. **A3** — chantier multi-site des libellés ;
5. la **couverture des points non éprouvés**, en particulier les fonctions
   Edge absentes de `nexus-test`, les rôles sans compte de recette et la
   simultanéité de deux sessions.

Aucun de ces points n'empêche la recette de progresser ; A12 empêche en
revanche une promotion sereine du schéma.

> Sans nom ni date dans ce bloc de décision, la version n'est pas autorisée en
> production. Ce bloc est vide : elle ne l'est pas.
