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

### Étapes 2 à 5 — non menées

Employé Test A, Employé Test B, isolation croisée à l'écran et contrôles
finaux : **reportés** après le lot A2.

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

## A3 à A6 — hors correctif A2

| # | Anomalie | Portée | Suivi |
|---|---|---|---|
| **A3** | « Vito Sainte-Marie Usine », nom du commerce de production, **écrit en dur dans 39 écrans** (46 occurrences). S'affiche en pied de page de la Prise de poste alors que la session est sur `nexus-station-test`. L'en-tête, lui, lit la base. | Défaut multi-tenant : tout client verrait ce nom | à ouvrir |
| **A4** | Deux `console.error` sur l'écran d'accueil (« Chargement products (accueil) : aucune ligne exploitable », « (marge accueil): null »). Cause bénigne — base de recette vide — mais le contrôle « aucune erreur console » **ne passe pas** tel qu'énoncé. | Contrôle final 3 en échec | à arbitrer : corriger le niveau de journalisation, ou reformuler le contrôle |
| **A5** | Deux requêtes `HEAD` en **503** : comptage `pointages`, comptage `fdj_alertes`. Non reproduites au rechargement. | Intermittent, cause non établie | à surveiller |
| **A6** | Le pied de page annonce `build 20260904-0104 · commit b219da5`, alors que le commit déployé est `f3526ad`. | **Traçabilité** : on ne peut pas savoir depuis l'écran quelle version on éprouve | **bloquant avant validation finale de la recette** |

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

## Points explicitement NON VALIDÉS

Ces deux points ne sont pas des anomalies à corriger : ce sont des **trous de
couverture de la recette elle-même**. Ils restent NON VALIDÉS quel que soit le
résultat des dix contrôles, et doivent être relus à chaque fiche tant qu'ils
subsistent.

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
| Mise en production autorisée par | **— PERSONNE. Promotion interdite en l'état.** |
| SHA promu en production | **aucun** |
| Non-régression en production vérifiée le | sans objet |
| Retour arrière possible vers | `production` reste figée sur `501c0c7` — inchangée, non touchée |

**Motif du blocage :** cinq anomalies bloquantes constatées, dont deux fuites
de données réelles atteignables sans authentification. Toutes corrigées sur
la branche `config-par-environnement` et sur la base de recette, aucune
encore déployée ni promue.

**Ce qu'il reste à faire avant une passe 2 :** déployer le lot correctif sur
la recette, puis reprendre les dix contrôles avec une vraie session
navigateur — Manager Test, Employé Test A, Employé Test B, observation des
requêtes réseau, absence d'URL Supabase de production, absence d'appel de
fonction Edge de production, et isolation croisée éprouvée à l'écran autant
qu'en base.

> Sans nom ni date dans le bloc de décision, la version n'est pas autorisée
> en production. Ce bloc est vide : elle ne l'est pas.
