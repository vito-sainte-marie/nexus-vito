---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-BOUCLE-CONTRAT-1-20261015
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=d6a97a47
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 151-fichiers
  - id: diagnostic-lecture-seule
    classe: VERIFIED
    valeur: run 38667953549 et 38721886938 lus, commits ff3e7720 et b20d06bc
  - id: inventaire-lecteurs-state
    classe: VERIFIED
    valeur: 11 outils et 28 tests reperes
  - id: aucune-modification
    classe: DECLARED
    valeur: ni main ni Production ni secrets ni claude.yml ni permissions
---
# Boucle Handoff : tours vides et contrat d'exécution — diagnostic en lecture seule

Frédéric demande la correction de la boucle (mission prompt-correction-boucle_2). Le diagnostic est livré d'abord ; rien n'est modifié sur le rail, `main`, Production, secrets ou permissions avant votre arbitrage. Le travail de code se fera sur la branche `incident/INC-20261015-001`, issue du rail.

## 1. Verdict sur les faits relevés

| Fait relevé | Verdict | Preuve |
| --- | --- | --- |
| decision-1 (01:52Z) : `APPROVED_WITH_CONDITIONS`, branche dédiée, `CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL`, `EXECUTANT_NEXT: github-actions-claude` | **Prouvé** | `decision-1.md`, commit c4f65f65 |
| Conditions : migration, RLS, recette Test à 5 scénarios | **Prouvé** | même fichier |
| `github-actions-claude` sans `SUPABASE_TEST_*` | **Prouvé** | `CAPACITES-CANAL.json` (DEPOT_LECTURE, DEPOT_ECRITURE_RAIL, CANAL_PUBLICATION) |
| Prompt « Pousse sur le rail seulement » + consommer d'abord | **Prouvé** | `claude.yml` de `main` (prompt) et journal du run (lignes 570-575) |
| Run 38667953549 : `success`, seul commit ff3e7720, aucune branche, aucune demande, aucune alerte | **Prouvé** | historique du rail ; `ls-remote` : seule la branche `fdj-quart-absent-reconstitution-20261015` existe, créée plus tard à la main (06:37 EDT) |
| La garde « tour vide » ne teste que le mouvement du rail | **Prouvé** | étape « garantir la CI du rail » : test « le rail a bougé » ; le journal montre « 1 run(s) déjà présent(s) pour ff3e7720 » |
| Précédent 10/10, run 38059658879 : `success`, rien poussé | **Run prouvé** (`success`, 14:27-14:33Z). « 18 refus » et « rien poussé » : **à confirmer**, repris du commentaire de `claude.yml`. Absent de `INCIDENTS.jsonl`, `EXPERIENCE.jsonl`, `RULES.json` : **prouvé** |

## 2. Chronologie du 15/10 (UTC)

| Heure | Événement | Statut |
| --- | --- | --- |
| 14/10 21:49 EDT | request-1 déposée (f2132e72) | prouvé |
| 01:52:02 | Le relais matérialise decision-1 (c4f65f65). Le contrat déclare une capacité (dépôt rail) inférieure à ce que prescrit l'action (branche dédiée + migration Test) | prouvé |
| 01:52:11 | `claude.yml` : contrôles de charge utile OK, session lancée avec le prompt fixe et la liste `--allowedTools` | prouvé |
| 01:52:11-01:59 | Session de 423,9 s : 10 refus de permission (`permission_denials_count`), dont des sondes sur l'environnement Supabase, des identifiants et des branches FDJ. L'étape « lister les refus » compte des lignes (21), pas des refus | prouvé |
| 01:52:44 | Seul commit : ff3e7720 « consommer decision-1 », qui ne touche que `STATE.json` | prouvé |
| 01:59:23 | « garantir la CI » : le rail a bougé, donc succès. Pas de demande de blocage, pas d'alerte Telegram | prouvé |
| Après | decision-1 reste consommée **sans exécution**. Frédéric s'en aperçoit et fait la migration à la main (request-2 à 06:37 EDT, qui le déclare) | prouvé |
| 10:40:01 | decision-2 (`APPROVED_WITH_CONDITIONS`, même contrat : `DEPOT_ECRITURE_RAIL`, `github-actions-claude`). Run 38721886938 : `success`, seul commit b20d06bc, 4 lignes de `STATE.json` | **prouvé : 2e tour vide du jour, même lot**. Le lot était alors piloté à la main, d'où le faible dommage |
| 10:40 | Dans decision-2, `HEAD` (34c3a24c) ≠ tête du rail (dcfdcea2) : écart toléré par le relais | prouvé, à traiter dans le lot 2 |

Contre-exemples sains le même jour, à garder comme non-régression :
- PROPRETE decision-1 (run 38665049534) : commit 2a2f792e avec travail réel (92 branches classées, skill corrigé) puis request-2. C'est un cas où le contrat correspond à la capacité.
- RECONCILER decision-1 (63770384) : « consommer et constater le blocage — archive absente ». Arrêt matérialisé, consommation légitime (§4 cas 2).

## 3. Cause racine (prouvée par composition, hypothèse H1 confirmée par la logique, non par la lecture du transcript)

Quatre défauts s'enchaînent, et chacun suffit à lui seul à masquer le suivant.
1. **Contrat sans opérations.** `CAPACITE_REQUISE` est un texte libre rempli par l'arbitre. Le contrôle de `relancer-claude-ci.js` n'y compare que cette valeur déclarée, jamais ce que `ACTION_NEXT` exige.
2. **Prompt qui consomme d'abord.** La consommation (écriture de `STATE.json` et commit) est la première chose que fait la session, avant d'essayer l'action. `DECISION_CONSOMMEE` ne signifie donc plus « exécutée ».
3. **Garde de tour vide aveugle.** Le commit de consommation fait bouger le rail, donc il satisfait la garde.
4. **Aucune sortie de secours.** Quand la session est bloquée, le prompt demande une demande de blocage, mais rien ne la vérifie, et la session n'a pas toujours de quoi la déposer. Elle termine donc en `success`.

Dans les deux cas du 15/10, l'arbitre a de plus prescrit une branche dédiée à un exécutant qui ne peut pousser que sur le rail (règle absente de `ARBITRE-CHATGPT.md`).

## 4. Inventaire des lecteurs de `STATE.json` (pour le statut `PRISE_EN_CHARGE`)

Statuts existants (`handoff.js:133-134`) : actifs = `ATTENTE_DECISION`, `ATTENTE_CONSOMMATION_DECISION`, `EXECUTION_RECUE` ; terminaux = `DECISION_CONSOMMEE`, `CLOS`. **`ATTENTE_CONSOMMATION_DECISION` existe déjà** mais n'est lu que par `handoff.js` (liste des actifs) et `etat-deploiement.js:76` (`en_developpement`). Aucun outil ne l'écrit. C'est le candidat naturel : il évite de créer un 6e statut.

| Outil | Lecture du statut | Effet d'un nouveau statut actif |
| --- | --- | --- |
| `outils/handoff.js` | l.425 (un seul lot actif), l.445, l.509 (écriture à la consommation), l.551-552 (lot libre ?), l.777 (retour d'exécution : exige `DECISION_CONSOMMEE` ou `EXECUTION_RECUE`) | à adapter : `verifier` valide la liste `STATUTS_LOT`, et l.777 refuserait un retour déposé pendant la prise en charge |
| `outils/reveil-handoff.js` | l.69 : saute les lots `DECISION_CONSOMMEE`/`EXECUTION_RECUE` dont la décision est la dernière | un lot en prise en charge serait réveillé en boucle : **à adapter** |
| `outils/reveil-orchestrateur.js` | l.393 : recopie `statut_registre` | lecture seule, sans effet |
| `outils/etat-deploiement.js` | l.67-77 | déjà mappé pour `ATTENTE_CONSOMMATION_DECISION` |
| `outils/materialiser-decision-ci.js` | l.140-144 : n'accepte que `ATTENTE_DECISION` | une décision tombant pendant une prise en charge serait refusée : comportement voulu |
| `outils/rapatrier-vers-rail.js` | l.222-273 | traite « ouvert » = autre que `DECISION_CONSOMMEE` : à vérifier par test |
| `docs/skills/nexus-lot-reconciler/scripts/reconcilier.js` | l.126, 141, 178 | a son propre vocabulaire (`constate`) : à vérifier par test |
| `relancer-claude-ci.js`, `watchdog-stagnation.js`, `garde-boucle-autonome.js` | aucune lecture directe de `statut` | passent par `reveil-*` ; le watchdog est aussi à étendre pour le tour vide |
| `.github/workflows/tests.yml` | lit `STATE.json` | à vérifier |

Tests couvrants repérés (28 fichiers `test_*` à la racine) dont : `test_handoff_v2_20260905`, `test_reveil_handoff_20260907`, `test_reveil_autosuffisant_20261007`, `test_boucle_autonome_20261010`, `test_garde_boucle_autonome_20261010`, `test_watchdog_stagnation_20260930`, `test_watchdog_orphelines_20261014`, `test_etat_deploiement_20260907`, `test_execution_recue_20261012`, `test_handoff_rail_actif_20261010`, `test_materialiser_decision_ci_20261009`, `test_rapatriement_lot_du_rail_20261007`, `test_continuite_bout_en_bout_20260930`, ainsi que `docs/skills/nexus-lot-reconciler/tests/recette.js`.

**Recommandation :** réutiliser `ATTENTE_CONSOMMATION_DECISION` comme état « pris en charge », sans nouveau nom. Il faudra faire exécuter la suite avant et après, et adapter `reveil-handoff.js` l.69 ainsi que `handoff.js` l.777. Cela se démontre dans le lot 1, comme l'exige le §4 du prompt.

## 5. Classement provisoire des 17 scénarios (à confirmer en exécutant avant correctif)

| Catégorie | Scénarios | Remarque |
| --- | --- | --- |
| Anomalies (échouent avant, passent après) | 0, 2, 4, 5, 8, 9, 10, 12, 14, 15 | 0 est prouvé par la chronologie ; 8 et 12 par ff3e7720 et b20d06bc |
| Fonction nouvelle | 6 | `lot/<LOT_ID>`, logique préparée, non câblée |
| Non-régression | 1, 3, 7, 11, 13, 16 | contre-exemples réels : PROPRETE (1/13), RECONCILER (13) |

Point d'attention : le scénario 11 (concurrence) dépend du groupe `concurrency` de `claude.yml`, qui est sur `main`. Il ne se teste qu'en simulation dans le dépôt. Les scénarios 10 et 14 ne se démontrent qu'après le choix de la clé d'identité d'action (lot, décision, SHA du rail, opérations attendues).

## 6. Défauts voisins constatés (hors périmètre, à signaler)

- Le comptage des refus de permission compte des lignes (21) et non des refus (10) : `grep -c .` dans `claude.yml`.
- Le relais tolère `HEAD` ≠ tête du rail (decision-2).
- `TOUR_VIDE` n'est pas une famille connue de `valider-diagnostic.js` (le skill nexus-incidents). À ajouter dans le lot 1, avec l'enregistrement de l'incident INC-20261015-001 (2e occurrence : 10/10 et 15/10, donc règle GOV-002 dans `RULES.json` et `EXPERIENCE.jsonl`).
- Les modifications de `claude.yml` (garde, prompt, branches `lot/<id>`) sont sur `main` : **préparées seulement, jamais appliquées**.

## 7. Lot FDJ : la procédure de reprise est sans objet

Le lot `NEXUS-FDJ-STOCK-Q1-ABSENT-20261015` est **clos** (decision-3 APPROVED, consommée en 6cfaa3f8 ; migration appliquée, #128 fusionnée et déployée, Q1 du 14/10 créé par Frédéric). La procédure demandée au §9 (request-2 avec la section « Preuve des conditions de decision-1 ») ne peut donc plus s'exécuter. Elle est de toute façon couverte par request-2 de Frédéric (dcfdcea2), qui déclare déjà decision-1 consommée sans exécution. Je n'y touche pas.

## Points à arbitrer
1. Valider la cause racine (4 défauts composés, §3) et le classement provisoire des 17 scénarios (§5).
2. Autoriser le lot 1 : aucune consommation sans preuve d'action ou arrêt matérialisé, tour vide qui échoue avec alerte, réutilisation de `ATTENTE_CONSOMMATION_DECISION` comme état « pris en charge » (adaptations de `reveil-handoff.js` l.69 et `handoff.js` l.777), indépendamment du contrat. Code sur `incident/INC-20261015-001`, sans merge ni déploiement.
3. Ordre des lots suivants : lot 2 (champ `OPERATIONS` et table opérations vers capacités), puis lot 3 (branches `lot/<LOT_ID>`, qui modifie `claude.yml` sur `main` : décision de Frédéric, jamais appliqué par Claude).
4. Règle immédiate pour `ARBITRE-CHATGPT.md` : ne jamais prescrire une branche dédiée à `github-actions-claude`, qui ne pousse que sur le rail.
