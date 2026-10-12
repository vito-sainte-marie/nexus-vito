# Fast Track de bout en bout — audit de continuité factuel (12/10/2026)

Document purement documentaire : audit + plan. Rien n'est implémenté ni fusionné
par ce document. Mandat : réveil Handoff du 2026-10-12 sur l'issue #28,
`NEXUS_BASE_BRANCH=handoff-continuite-20260920`.

Checkout de cet audit : HEAD `7978abb` = `origin/handoff-continuite-20260920`
(ancêtre direct, aucun écart de racine). `node outils/handoff.js verifier` →
conforme (50 lots, 17 avertissements préexistants, 0 nouvelle erreur).
`node run-tests.js` → 318/327, les 9 échecs strictement identiques à la liste
historique (`test_reception_moteur.js`, `test_reception_v1_dom.js`, etc. — hors
périmètre Fast Track). Aucune régression constatée.

## 1. Tableau E0–E7 : FAIT / PARTIEL / ABSENT / NON PROUVÉ

| Étape | État | Preuve (SHA, test) |
|---|---|---|
| **E0 — Mesure/registre** | **FAIT**, mais sa conséquence n'est **pas encore intégrée ici** | `23e02b1` (passe `SUPABASE_TEST_LECTURE` à NON pour `github-actions-claude`, preuve run 38234629984). Un second commit, `4bdd507`, repasse cette capacité à OUI (preuve run 38311137673, pooler IPv4) — **non fusionné** dans `handoff-continuite-20260920` : `git merge-base --is-ancestor 4bdd507 HEAD` échoue. Il vit seul sur `origin/claude/issue-28-20261012-2131`, en avance d'un commit sur ce HEAD. Sur CE checkout, `docs/handoff/CAPACITES-CANAL.json` porte donc encore `SUPABASE_TEST_LECTURE: NON`. |
| **E1 — Ordre d'exécution typé** | **FAIT** | `63fb3e0`. `outils/ordre-execution.js` (216 lignes) : types fermés (`MIGRATION_APPLY`\|`LECTURE_CONTROLE`\|`SYNC_REGISTRE`), hash canonique SHA-256, refus codés, aucun champ `sql` possible. `node test_ordre_execution_20261012.js` → vert (« propriétés A–M tiennent »), avec mutations. |
| **E2 — Catalogue et détection** | **FAIT** | `b50930e`. `outils/detecter-operation.js` : une migration ajoutée sous `supabase/migrations/` est détectée par nature d'artefact (jamais par la prose) et routée vers `MIGRATION_APPLY`. `node test_detecter_operation_20261012.js` → vert (« propriétés A–G »), épreuve de mutation « débrancher l'aide » incluse. |
| **E3 — Câblage du routage** | **FAIT** | `18f64d3`. `outils/handoff.js` (lignes ~738+) appelle `ordre-execution` depuis `demande` ; `outils/preparer-ordres.js` écrit `order-N-k.json` dans le lot quand `--depuis`/`--cible-env` désignent une migration. `node test_ordre_depuis_demande_20261012.js` → 9 groupes verts, dont un essai CLI réel sur dépôt jetable (épreuve D) et une mutation « débrancher le câblage ». |
| **E4 — Consommation par l'exécutant** | **PARTIEL** — logique complète et testée, **jamais exercée contre un Supabase réel** | `2d97f2a` + durci par `7978abb` (PREFLIGHT-REEL-1). `outils/consommer-ordre.js` (186 lignes) implémente le mode `reel` (gardes, verrou persistant par fichier `wx`, preuve de preflight obligatoire, `consommerAsync`) — mais `lecteur`/`ecrivain` sont **toujours injectés** par l'appelant ; aucune connexion Supabase n'existe dans ce module. La seule porte CLI exposée est `blanc` (`require.main === module`, ligne ~174) : il n'existe **aucune commande `reel`** câblée en CLI pour la session habilitée. `node test_consommer_ordre_20261012.js` → 9 groupes verts, avec un écrivain **simulé** (« réel : EXECUTE, un seul appel » teste le code chemin `reel`, pas une vraie base). Le doc d'architecture le dit lui-même (§E5bis) : « Ce qui reste non prouvé : aucun témoin réel n'est écrit [...] aucune exécution réelle n'a eu lieu ». |
| **E5 — Retour et reprise** | **FAIT pour le mécanisme, NON PROUVÉ en conditions réelles** | `45b56b3` + `c726d3f` (fix horloge). Statut `EXECUTION_RECUE` ajouté à `STATUTS_LOT_ACTIFS` ; commande `handoff.js execution` ; `outils/handoff.js verifier` contrôle le GO d'un retour (environnement, habilitation, décision Production citant le hash — `fbaa4c8`). `node test_execution_recue_20261012.js` → 8 groupes verts, dont la garde G (GO du retour) et sa mutation H. Jamais exercé sur un retour produit par une exécution réelle (dépend d'E4). |
| **PREFLIGHT-REEL-1** (avant E6, hors plan initial E0-E7 mais sur le chemin critique) | **FAIT pour les doubles, explicitement non prouvé pour le réel** | `7978abb` (HEAD). `outils/preflight-reel.js` (138 lignes) : identité par deux témoins indépendants, provenance commit→blob→SQL haché, preuve émise dans le processus (`WeakSet`), verrou persistant `wx`, cycle asynchrone avec délai obligatoire. `node test_preflight_reel_20261012.js` → 13 groupes verts, 14 mutations, six processus en course réels (pas simulés). Le commit lui-même l'annonce : « Doubles seulement : aucun accès base, ni E6 ni E7, ni Production. » |
| **E6 — Exécuteur Test dédié** | **ABSENT** | Non commencé. Option documentée (§2.4 de l'architecture), nécessite un nouveau rôle `nexus_exec_test` et un GitHub Environment `nexus-test-executor` — un nouveau secret Test, donc une autorisation distincte. |
| **E7 — Exécuteur Production** | **ABSENT** | Non recommandé par le document lui-même avant d'avoir pratiqué E4 sur plusieurs lots réels ; nécessite un GitHub Environment à relecteur obligatoire = Frédéric. Décision de posture distincte, hors de ce mandat. |

**Constat central.** La chaîne logique E1→E5 (+ PREFLIGHT-REEL-1) existe, est testée par mutation à chaque étage, et n'a **jamais** menti sur son propre statut : chaque commit annonce lui-même ce qu'il ne prouve pas. Mais toute la pile repose sur des `lecteur`/`ecrivain` **injectés** — aucun test, aucune commande CLI de ce dépôt n'a jamais parlé à un Supabase réel en écriture. Le chaînon manquant exact demandé par le mandat n'est donc pas « E1 à E5 sont absents » (ils ne le sont pas) : c'est qu'**aucun chemin exécutable n'existe encore pour invoquer `consommer-ordre.js` en mode `reel` depuis la session habilitée**. Il n'y a pas de CLI `reel`, et le mode `reel` exige un `project_ref`/`sentinelle` réels que rien ne fournit encore (dépendance notée dès l'architecture : « à définir avec E6 »).

## 2. Le fast-track peut-il être éprouvé sans E6/E7 ?

**Oui, pour une preuve de bout en bout minimale, sans aucun nouveau secret ni Environment GitHub** — à condition de fermer exactement trois choses, dans cet ordre :

1. **Fusionner `4bdd507` dans `handoff-continuite-20260920`** (pur fast-forward documentaire : `docs/handoff/CAPACITES-CANAL.json`, un seul fichier, aucune applicative). Sans ce commit, `SUPABASE_TEST_LECTURE` reste `NON` sur ce rail et toute tentative de lecture Test depuis `github-actions-claude` serait un geste non autorisé par le registre lui-même — le classifieur (`classifierCapacite`) la refuserait, à raison.
2. **Ajouter une porte CLI `reel` à `outils/consommer-ordre.js`**, invoquée **uniquement** par la session habilitée (celle qui a déjà exécuté G1 et les migrations Production du 09-12/10, trousseau `readonly` existant). Elle doit fournir : un `lecteur` qui lit réellement `project_ref`/blob/mesures via le connecteur Supabase déjà autorisé, un `ecrivain` qui appelle `execute_sql` (déjà le mécanisme employé pour les migrations Production antérieures), et un répertoire de verrous réel sous le lot. **Aucun nouveau secret** : c'est le même trousseau et le même connecteur que ceux qui ont déjà appliqué les migrations `20261011200000`/`20261011220000` en Production (cf. `docs/handoff/lots/FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011/`).
3. **Rejouer un ordre `LECTURE_CONTROLE`** (pas `MIGRATION_APPLY`) en premier, en mode `reel`, contre `nexus-test`. C'est l'essai à blanc **réel** que l'architecture recommandait déjà (§E4 : « Rejouer le lot FDJ comme essai à blanc sur Test ») — un ordre qui ne mute rien, pour prouver tout le chemin (preflight, verrou, écrivain, constat, `execution-N.json`, statut `EXECUTION_RECUE`, réveil) sans engager de DML/DDL. Une fois ce chemin vert sur une lecture, répéter avec une vraie `MIGRATION_APPLY` sur Test devient un geste du même type, pas un nouveau risque.

E6/E7 ne sont nécessaires que pour **déléguer** cette exécution à un exécutant automatique (`workflow_dispatch`/CI) au lieu de la session habilitée humaine-déclenchée. Ce mandat ne les demande pas : il demande une preuve de bout en bout, que la session habilitée peut produire seule.

## 3. Scénario d'acceptation — NEXUS PAYE / VERIFY (Phase 3)

Fondations déjà posées, vérifiées dans le code existant (pas inventées pour ce
scénario) :
- `nexus-verify-moteur.js` (seuils de gravité caisse, seule vérité, Article 11) ;
- `nexus-paye-moteur.js`, en-tête : « Le planning est une prévision. Verify et
  Pointage sont des preuves de présence. Aucun écart de caisse ne devient une
  retenue sans décision explicite du manager » ;
- `docs/handoff/lots/NEXUS-HEURES-VERIFY-PAYE-1-20261009/decision-1.md` — Q1
  (8ᵉ heure = heure sup, sans double comptage), Q3 (remise à zéro des
  anciens écarts incohérents, effet 2026-10-01, historique avant préservé), A
  (durée > 12h = pointage jamais arrêté, jamais une heure payée automatique) ;
- `docs/nexus/BACKLOG.md:35` — `PAYE-003` (statut `TERRAIN`, pas encore
  `PRET_POUR_DEV`) : « Les écarts Verify doivent remonter clairement dans
  NEXUS PAYE — Variables visibles avec source et statut d'arbitrage ».

### Parcours reproductible, environnement Test, jeu de données non sensible

| # | Étape | Preuve attendue |
|---|---|---|
| 1 | Un quart Test porte une fonction **caissière** confirmée par Verify (`audits_caisse`) ET une ligne de **renfort** au planning officiel sur le même créneau/site/date. | SQL : la requête de détection de cumul rend 1 ligne pour ce quart. |
| 2 | NEXUS PAYE affiche ce quart avec priorité **caisse**, jamais un double comptage, et une **anomalie manager** explicite (planning non actualisé) — pas un silence. | UI : le quart apparaît une seule fois, étiqueté anomalie, lien vers la source Verify. |
| 3 | Un second quart porte un renfort **sans** conflit caisse. | UI/SQL : il entre dans le tableau des recettes **sans** doublon avec les heures caisse du même employé. |
| 4 | Un pointage brut Test dépasse 12h sans clôture. | Moteur : aucune heure sup automatique n'en sort ; le manager doit saisir un retard/une correction manuelle, défaut = 0 minute. |
| 5 | Un jour à barème 8h est travaillé en entier. | Dossier comptable : 7h base + 1h sup affichées séparément, pas une seule ligne de 8h. |
| 6 | Un écart Verify `critique` existe sur un audit antérieur au 2026-10-01 (historique) et un autre postérieur. | PAYE : l'historique (avant le 01/10) reste visible tel quel ; celui d'octobre est assaini/recalculé, jamais fusionné silencieusement. |
| 7 | Comparaison écarts mensuels employé vs manager sur le même mois Test. | Les deux doivent être cohérents (même source Verify, même règle de gravité) — tout écart de lecture entre les deux écrans est un défaut à bloquer, pas à arbitrer en silence. |
| 8 | Traçabilité : chaque ligne PAYE affichant un écart Verify porte sa source (`audit_id`, date, quart) et son statut d'arbitrage (`manager`\|`non arbitré`). | C'est exactement PAYE-003 : actuellement absent, à vérifier négativement avant toute correction (si l'écran affiche déjà un montant sans cette source, c'est le défaut même que PAYE-003 nomme). |

### Critères de succès chiffrables
- 0 double comptage caisse+renfort sur l'ensemble du jeu Test (requête de
  détection = 0 ligne après correction, si applicable).
- 100 % des écarts Verify affichés en PAYE portent une source et un statut
  d'arbitrage (actuellement probablement 0 % — à mesurer avant toute
  implémentation, PAYE-003 n'étant pas encore `PRET_POUR_DEV`).
- 0 heure supplémentaire générée automatiquement depuis un pointage ouvert
  (>12h) sur le jeu Test.
- Écarts mensuels identiques (± 0) entre vue employé et vue manager sur le
  même mois Test.

### Rollback
Jeu de données Test versionné et idempotent (même convention que
`outils/semer-recette-test.sql`/`outils/capturer-baseline-recette-test.sql`),
aucune ligne appartenant à une autre recette touchée ; rollback = rejouer le
script de semis sur une base Test déjà reconstruite (mécanisme déjà existant
et pré-autorisé par `CLAUDE.md` §1 pour `nexus-test`).

**Ce scénario n'a pas été exécuté dans ce GO** (aucune écriture Test n'est
autorisée par ce mandat sans un GO ciblé distinct, §Phase 3 du réveil).

## 4. Plan de fermeture ordonné

| Ordre | Action | Dépendance | GO requis |
|---|---|---|---|
| 1 | Fusionner `4bdd507` (fast-forward documentaire, `CAPACITES-CANAL.json` seul) dans `handoff-continuite-20260920`. | Aucune. | Arbitrage a posteriori possible (CLAUDE.md : outillage/registre, aucun secret, aucune Production, aucun `main`) — **pas de GO préalable requis**, mais hors du périmètre « sans fusion automatique » de CE GO : à faire par l'Orchestrator ou une session habilitée à pousser sur le rail. |
| 2 | Ajouter la porte CLI `reel` à `consommer-ordre.js`, strictement outillage (aucun fichier applicatif/métier). | (1), pour que le registre autorise la lecture Test depuis le canal qui l'exercera. | Arbitrage a posteriori possible sous les mêmes 4 conditions (CLAUDE.md), si l'implémentation reste côté outillage et n'ouvre aucun nouveau secret. |
| 3 | Essai à blanc **réel** : un ordre `LECTURE_CONTROLE` consommé en mode `reel` contre `nexus-test`, par la session habilitée, avec le connecteur/trousseau déjà existant. | (1), (2). | **GO ciblé requis** : c'est une opération Supabase Test réelle, même en lecture — à soumettre comme ordre précis avant exécution, par prudence méthodologique, même si CLAUDE.md pré-autorise déjà la lecture Test à Claude. |
| 4 | Rejouer un `MIGRATION_APPLY` Test réel de bout en bout (par ex. une migration déjà appliquée en Production, pour preuve d'idempotence contrôlée) via le même chemin. | (3) vert. | GO ciblé Test, comme (3). |
| 5 | Construire le jeu de données Test pour le scénario Paye/Verify (§3) et exécuter les 8 étapes. | Aucune dépendance sur E4/E5 — scénario indépendant, peut démarrer en parallèle de (1)-(4). | **GO ciblé requis** pour toute écriture Test (semis du jeu de données). |
| 6 | Mesurer PAYE-003 sur le jeu Test construit en (5) : l'écart Verify est-il déjà visible en PAYE avec source/statut ? Si non, ouvrir PAYE-003 comme lot de développement distinct. | (5). | Aucun GO pour la mesure seule (lecture) ; GO distinct pour toute correction applicative. |
| 7 | E6/E7 — non planifiés par ce mandat ; à rouvrir séparément si Frédéric souhaite déléguer l'exécution à un exécutant automatique plutôt qu'à la session habilitée. | — | Décision de posture distincte (hors de ce GO). |

## 5. NEXT_ACTION_CONTRACT (`nexus-handoff/2`)

```
NEXT_ACTION_CONTRACT
  DECISION: NEEDS_EVIDENCE
  CLOSES: false
  LOT: (aucun lot ouvert par cet audit — documentaire uniquement)
  REQUEST: (aucune — ce document n'est pas un request Handoff)
  HEAD: 7978abbcec53312bc12b6357d9701bfb525eeeb3
  LEASE: aucun
  GATE_STATE: G0 — CI non interrogée depuis ce canal (lecture locale uniquement)
  PROOF_STATE: PROOF_VALID — 318/327 tests, 9 échecs historiques identiques, handoff.js verifier conforme
  CONDITIONS: fusionner 4bdd507 avant toute lecture Test depuis github-actions-claude ; aucune écriture Test/Production sans GO ciblé distinct de ce GO
  BLOCKER: aucun chemin CLI 'reel' pour consommer-ordre.js ; 4bdd507 non fusionné sur handoff-continuite-20260920
  STOP_REQUIRED: non
  CAPACITE_REQUISE: SUPABASE_TEST_LECTURE (pour l'étape 3 du plan), puis SUPABASE_TEST_ECRITURE (pour les étapes 4-5)
  OWNER_NEXT: Claude
  EXECUTANT_NEXT: session-claude-habilitee (seul canal déjà capable, trousseau existant)
  ACTION_NEXT: fusionner le commit documentaire 4bdd507 (CAPACITES-CANAL.json) sur handoff-continuite-20260920, puis soumettre un GO ciblé pour l'essai à blanc réel LECTURE_CONTROLE (étape 3 du plan de fermeture)
```

## 6. Ce qui n'a pas été fait dans ce GO (respect strict du périmètre)

Aucune écriture Supabase Test/Production, aucun DML/DDL, aucune migration,
aucun changement de secret/ACL, aucune fusion vers `main`/`production`, aucun
déploiement, aucune activation E6/E7, aucun nouveau lot Handoff concurrent. Le
lot actif du registre (`FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011`, statut
`DECISION_CONSOMMEE`) n'a pas été touché. Aucune fusion de `4bdd507` n'a été
effectuée : ce document se limite à constater qu'elle reste à faire, sans
l'exécuter, conformément à « sans fusion automatique ».
