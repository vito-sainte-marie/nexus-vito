# NEXUS-EXECUTOR-SUPABASE-1 — audit et architecture minimale

Date : 2026-10-12 · Statut : **PROPOSITION, rien d'implémenté.** Aucun secret touché, aucune Production armée, aucun déploiement. Chaque étape ci-dessous exige son GO distinct.

## 1. Diagnostic : ce qui existe réellement (mesuré le 12/10)

| Composant | État | Preuve |
|---|---|---|
| `docs/handoff/CAPACITES-CANAL.json` | 4 canaux (`github-actions-claude`, `session-claude-habilitee`, `arbitre-chatgpt`, `frederic`), 9 capacités OUI/NON, preuves EXERCEE/ENVELOPPE, table `gestes` | lu |
| `outils/classification-canal.js` (`classifierCapacite`) | fonction pure : « le canal visé peut-il ? sinon qui ? » → `CHANNEL_LIMITATION` + liste d'exécutants | **appelée par aucun workflow ni par `handoff.js`** (son en-tête le dit : « aucun workflow n'est câblé ici ») |
| `outils/relancer-claude-ci.js` | seul consommateur de `capacites-canal` : boucle autonome (stade (a) → `repository_dispatch` → `claude.yml`) | lu |
| Contrat de décision | porte déjà `CAPACITE_REQUISE`, `EXECUTANT_NEXT`, `OWNER_NEXT` (ex. decision-4) | `escalade-humaine.js:131` |
| `etat-maillon.js` | un `BLOCKED` exige condition, sha, branche, lot, maillon, **prochaine_action** | lu |
| `escalade-humaine.js` | deux paliers : arbitre / Frédéric ; Production = palier Frédéric | lu |
| `CANAUX.json` + `reveil-orchestrateur.js` | `wake_to` → issue #28 (publication CI) | lu |
| `claude.yml` (main) | secrets : `CLAUDE_CODE_OAUTH_TOKEN`, 3 PIN Test, `SUPABASE_TEST_DB_URL_READONLY` ; aucun secret Production ; filtre d'auteur `vito-sainte-marie` ; boucle verrouillée par `vars.NEXUS_BOUCLE_AUTONOME` | lu |
| `tests.yml` | seul consommateur de `SUPABASE_TEST_DB_URL_WRITE` (rôle `nexus_ci_recette`, étroit) | grep |
| Exécutant Production réel | `session-claude-habilitee` : connecteur Supabase `execute_sql` + trousseau `readonly`. A exécuté G1 (09/10) et 200000/220000 (12/10), un GO par action, transaction unique gardée (registre + md5) | request-3 de G1, request-3 du lot FDJ |

**Constat central.** Les trois moitiés existent : *savoir qu'un canal est incapable* (registre + classifieur), *nommer l'exécutant* (contrat), *exécuter proprement* (session habilitée). Il manque la colonne vertébrale qui les relie : un **ordre d'exécution typé** que le GO désigne et que l'exécutant consomme.

**Écart de fait à lever d'abord (E0).** Le registre déclare `SUPABASE_TEST_LECTURE = OUI` pour `github-actions-claude`, et le secret `SUPABASE_TEST_DB_URL_READONLY` existe (nom vu par `gh secret list`, valeur jamais lue). Or le job mesuré n'a vu aucune variable `PG*`. Deux causes possibles, non distinguées : l'étape « Préparer connexion » a pris sa branche « secret absent/invalide » (`NEXUS_TEST_DB_AVAILABLE=0`), ou le bac à sable de Claude ne propage pas l'environnement (le registre note `printenv-refuse-par-le-bac-a-sable`). À mesurer dans le journal du run, sans lire de valeur. Selon le résultat, le registre doit passer à NON avec une preuve EXERCEE, ou le canal doit être réparé. Une capacité déclarée est une opinion.

## 2. Architecture minimale

Principe : **aucun nouveau secret en premier lieu.** On réutilise l'exécutant qui marche et on lui donne un ordre typé.

### 2.1 L'ordre d'exécution (`order-N.json`, dans le lot, sur le rail)

Liste **fermée** de types, jamais de SQL libre : `MIGRATION_APPLY`, `LECTURE_CONTROLE`, `SYNC_REGISTRE`. Champs :

- `operation` : type + `lot` + `request` d'origine ;
- `cible` : `env` (`test` | `production`) et `project_ref` attendu (`udljdqxerrbbbajxubfn` / `uzhjpqpctpvxytxpxoqz`) ;
- `artefact` : chemin, **blob SHA git** et commit (migration immuable : le blob est figé, jamais réécrit) ;
- `preconditions` : taille du registre, dernière version, md5 des fonctions touchées, objets attendus absents ;
- `postconditions` : mêmes mesures attendues après ;
- `retour_arriere` : référence ou « aucun, justifié » ;
- `expire_le`, `usage_unique: true`.

`operation_hash` = sha256 du JSON canonique. **Le GO cite ce hash.**

### 2.2 Le GO lie le hash, pas une phrase

- Production : commentaire de Frédéric (acteur vérifié) contenant `GO <operation_hash>`. L'arbitre ne peut pas le donner (palier Frédéric).
- Test : décision de l'arbitre suffit (hors Production, hors doctrine), toujours sur un hash.
- L'exécutant **recalcule** le hash depuis l'ordre et le blob réellement lu. Hash différent, ordre expiré, ordre déjà consommé, projet différent ou précondition fausse → **refus avec code**, aucune écriture, jamais d'adaptation. Un GO ne couvre donc jamais une autre opération (exigence 8).

### 2.3 Routage automatique (exigences 2 et 3)

1. Détection par **nature de l'artefact**, pas par la prose : tout fichier `supabase/migrations/*.sql` ajouté ou modifié dans la demande, ou toute opération du catalogue → capacité `SUPABASE_<ENV>_ECRITURE` ou `_LECTURE`. On étend la table `gestes` (2 entrées aujourd'hui) en catalogue.
2. `handoff.js demande` appelle `classifierCapacite` avec le canal courant. Si le canal est incapable, il **n'écrit pas BLOCKED sans issue** : il génère l'ordre, pose `EXECUTANT_NEXT`/`CAPACITE_REQUISE` et publie le réveil vers l'exécutant (GO humain si Production).
3. Cas « personne n'est capable » : `CAPACITE_SANS_EXECUTANT`, seul vrai blocage.

### 2.4 Exécutants (exigences 4, 5, 7)

| Exécutant | Env | Mécanisme | Nouveau secret |
|---|---|---|---|
| **Session habilitée** (existant) | Test + Production | consomme `order-N.json`, applique par le connecteur, un `execute_sql` gardé | aucun |
| **Exécuteur Test** (option) | Test | `workflow_dispatch` dans un GitHub Environment `nexus-test-executor`, rôle dédié `nexus_exec_test`, applique **uniquement** le fichier au blob nommé | oui, Test seulement, **distinct** de `nexus_ci_recette` (pas d'élargissement) |
| **Exécuteur Production** (option, à ne pas faire maintenant) | Production | Environment à relecteur obligatoire = Frédéric, mêmes contrôles | oui, **Production** : changement de posture |

Production, contrôles obligatoires avant toute écriture : projet vérifié (ref + sentinelle lue en base), blob SHA = ordre, commit atteignable depuis `production`, préconditions mesurées, GO hash valide et non expiré, ordre non consommé. Après : postconditions mesurées, registre relu, ordre marqué consommé. Les accès existants (trousseau `readonly`, connecteur de l'Orchestrator) ne changent pas.

### 2.5 Retour et reprise (exigence 6)

L'exécutant dépose `execution-N.json|md` dans le lot (hash, mesures avant/après, horodatages mesurés, résultat, code de refus éventuel), par le transport existant. `STATE.json` passe à `EXECUTION_RECUE`. Le réveil `wake_to` va à l'arbitre ; la reprise réutilise le stade (a) et la boucle déjà démontrée. Rien de nouveau côté transport.

## 3. Risques

1. **Ordre forgé ou modifié après le GO** → le hash et le blob le détectent ; l'ordre vit sur le rail, jamais sur `main`/`production`.
2. **Rejeu** → `usage_unique` + marqueur consommé dans le lot.
3. **Mauvais projet** → ref attendu dans l'ordre + sentinelle lue en base ; le pooler et l'URL composée sont refusés (cf. standard du 01/10).
4. **Secret Production dans GitHub** (exécuteur Production) : surface permanente, rotation, journaux. C'est le vrai risque ; c'est pourquoi il est différé et conditionné.
5. **`issue_comment`** : reste sans secret applicatif. Le canal ne fait que *produire l'ordre* ; il ne l'exécute jamais.
6. **Registre menteur** (E0) : un OUI non exercé fait router vers un canal incapable.
7. **Catalogue qui s'élargit** : tout nouveau type d'opération est une édition du catalogue, avec épreuve de mutation, pas un champ libre.
8. **Exécutant absent** : la session habilitée n'est pas un service. Le routage la désigne mais ne la réveille pas ; un humain ouvre la session.

## 4. Plan par étapes (un GO par étape)

- **E0 — Mesure.** Lire le journal du dernier run `claude.yml` (état de `NEXUS_TEST_DB_AVAILABLE`, sans valeur), corriger `CAPACITES-CANAL.json` avec une preuve EXERCEE. Doc/registre seulement.
  - **Résultat (12/10) :** run 38234629984, job 114762162104 : l'étape « Préparer connexion » émet « configuration is invalid » puis `NEXUS_TEST_DB_AVAILABLE=0`. Le secret existe mais son contenu est rejeté par la validation (schéma/composantes) ; la capacité n'est donc pas exercée. `SUPABASE_TEST_LECTURE` passe à NON avec preuve EXERCEE. Réparer le contenu du secret est un changement de secret : hors périmètre, à décider séparément.
- **E1 — Schéma de l'ordre.** `outils/ordre-execution.js` pur (construction, hash canonique, validation, refus codés) + épreuves, dont mutations : hash altéré, blob différent, projet croisé, ordre expiré, rejeu. Aucun accès base.
- **E2 — Catalogue et détection.** Étendre `gestes` ; détecter le type par nature d'artefact ; épreuve « débrancher l'aide » (preuve de câblage, pas seulement de fonction).
- **E3 — Câblage du routage.** `handoff.js demande` appelle le classifieur et génère l'ordre au lieu d'un `BLOCKED` sans issue ; `verifier` refuse un `BLOCKED` de capacité sans ordre.
- **E4 — Consommation par la session habilitée.** Procédure : lire l'ordre, rejouer les préconditions en lecture, refuser sur tout écart, appliquer par `execute_sql` gardé, mesurer, déposer `execution-N`. **Rejouer le lot FDJ comme essai à blanc sur Test.**
- **E5 — Retour/reprise.** Statut `EXECUTION_RECUE`, réveil arbitre, test de bout en bout sur Test.
- **PREFLIGHT-REEL-1 (12/10, avant E6) — ce que l'exécutant prouve au lieu de le déclarer.** `outils/preflight-reel.js`, câblé dans `consommer-ordre.js` ; doubles seulement, aucun accès base.
  - *Identité* : deux témoins de sources distinctes (`connexion`, `sentinelle` lue en base) doivent rendre `cible.project_ref` = `ENVS[env]`. Témoin absent, illisible ou sans référence → `IDENTITE_NON_PROUVEE` ; témoin d'un autre projet → `PROJET_REEL_DIFFERENT`. Le témoin reçoit l'environnement, pas la valeur attendue.
  - *Provenance* : commit atteignable depuis une ref désignée (Production : `origin/production` seule ; Test : `origin/main` ou `origin/production`) → sinon `COMMIT_NON_ATTEIGNABLE` ; blob à `commit:chemin` = blob de l'ordre → sinon `BLOB_COMMIT_DIFFERENT` ; le SQL lu se hache en ce blob → sinon `SQL_NON_LIE_AU_BLOB`. L'écrivain reçoit ce SQL, jamais un SQL libre.
  - *Preuve* : gelée, émise par `preflight` dans le processus (registre `WeakSet`), liée au hash et au projet ; une copie champ pour champ est refusée (`PREFLIGHT_ABSENT`).
  - *Verrou persistant* : un fichier par projet créé en `wx`, vu des autres processus ; illisible = tenu ; libéré seulement sur EXECUTE, sur une réconciliation qui conclut (EXECUTE / NON_APPLIQUEE), ou par un humain habilité qui nomme l'opération ; toute libération est archivée. `mode: 'reel'` sans répertoire de verrous → `ORDRE_MALFORME`.
  - *Asynchrone* : `consommerAsync` exige `delaiMs` ; rejet → INCERTAIN ; délai dépassé → INCERTAIN sans relecture d'un état intermédiaire, verrou tenu ; l'issue tardive est consignée à son arrivée ; `reconcilierVerrou` refuse de conclure tant que l'issue n'est pas acquise (`ISSUE_NON_ACQUISE`).
  - *Épreuves* : `test_preflight_reel_20261012.js` (13 groupes, dépôt git jetable, six processus en course, 14 mutations) et `test_consommer_ordre_20261012.js` adapté. Limite : la mutation « répertoire facultatif » ne rend pas l'écriture possible (le verrou inconstructible est lu tenu) ; elle fait perdre la cause du refus.
  - *Ce qui reste non prouvé* : aucun témoin réel n'est écrit (la requête de sentinelle et l'origine de `connexion` restent à définir avec E6) ; aucune exécution réelle n'a eu lieu.
- **E6 — (option, décision distincte) Exécuteur Test dédié.**
- **E7 — (option, décision distincte de Frédéric) Exécuteur Production en Environment protégé.** Non recommandé avant d'avoir pratiqué E4 sur plusieurs lots.

## 5. Ce que je recommande

E0 → E5 : tout le gain (fin des blocages sans prochaine action, GO lié à l'opération) sans aucun nouveau secret ni ouverture Production. E6/E7 sont des décisions de posture à part.
