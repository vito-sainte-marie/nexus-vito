---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 4
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: nexus-live-events-dependance
    classe: VERIFIED
    valeur: grep-lecture-code-aucune-dependance-Production-reelle-migration-21-exclue-en-permanence
  - id: manifeste-migrations-finalise
    classe: VERIFIED
    valeur: 16-incluses-4-exclues-Test-CI-21-exclue-permanente-5-6-conditionnees-mesure-temporelle
  - id: repetition-preprod-test-identifiee
    classe: DECLARED
    valeur: nexus-test-suffit-outils-reconstruire-base-test-sh-existant-non-execute-aucun-acces-depuis-ce-canal
  - id: preprod-anonymise-dump
    classe: NOT_APPLICABLE
    valeur: non-necessaire-tant-que-la-repetition-Test-suffit-plan-reste-INCONNU-NON_CONSTRUIT
  - id: re-mesure-finale-preparee
    classe: DECLARED
    valeur: 6-requetes-SELECT-only-consolidees-non-executees
  - id: regression-globale
    classe: VERIFIED
    valeur: 228-237-9-echecs-historiques-inchanges
  - id: guardians-apprentissage
    classe: VERIFIED
    valeur: guardians-router-0-finding-verifier-apprentissage-conforme-20-regles
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Poursuite déterministe — dépendance nexus_live_events fermée, répétition PREPROD-équivalente identifiée

En réponse à `decision-3.md`, consommée (`b9fa80b`).

## 1. Dépendance Production réelle à `nexus_live_events` — vérifiée, aucune

Vérification par lecture de code (pas supposée) : seuls `NEXUS-App-v1.html`
(entrée de navigation `data-role="createur"`, description « … environnement
Test ») et `NEXUS-Live-Developpement-v1.html` référencent
`nexus_live_events` côté application. La lecture est encadrée par un
`if (error)` qui affiche un message explicite sur cet écran précis, jamais
un plantage. `outils/producteur-evenements-live.js` n'écrit jamais en base
lui-même (RLS `je_suis_createur()`, aucun `service_role`) : aucun processus
CI/cron n'écrirait automatiquement dans cette table en Production. **Aucune
dépendance fonctionnelle Production n'existe.** La migration 21 est donc
**exclue en permanence pour cette release**, matérialisé dans
`manifeste-migrations-production-1.md` (section « Exclue en permanence »).

## 2. Manifeste finalisé avec le résultat de la mesure Advisor

La condition #5 (`seed_referentiel_advisor`) est mise à jour avec le résultat
réel de `mesures-advisor-production-lecture-seule-1.md` (0/37 écrasée) —
condition satisfaite pour l'état mesuré, avec rappel explicite que cette
mesure est temporelle et doit être rejouée avant la gate (voir point 4).

## 3. Répétition PREPROD-équivalente — `nexus-test`, aucune ressource nouvelle

Recherché en premier, comme demandé : `nexus-test` (ressource Test
existante, comptes `compte_test=true` uniquement — aucune donnée personnelle
possible par construction) suffit pour la répétition migrations + recette
recherchée par `decision-3.md` §3, sans construire de PREPROD depuis un dump
Production. Détaillé dans le nouveau `plan-repetition-preprod-test-1.md` :
outillage déjà existant (`outils/reconstruire-base-test.sh`, qui rejoue la
totalité des migrations versionnées — les 16 de Production et les 4
Test/CI, sans distinction, exactement l'état attendu de ce projet),
recette existante (`outils/recette-navigateur-test.js`, `run-tests.js`).
Aucune ressource facturable nouvelle, donc aucune gate de coût déclenchée.

**Non exécuté dans ce lot** : ce canal GitHub Issue n'a ni le trousseau
macOS que lit ce script, ni accès réseau/identifiant vers `nexus-test`
(constat inchangé depuis le 06/09/2026). Limite honnête signalée avant
exécution : la reconstruction complète du schéma ne réapprovisionne pas les
comptes `auth.users` de recette — à vérifier explicitement avant de lancer
la recette, sous peine d'un échec sans rapport avec les migrations.

`plan-preprod-anonymise-1.md` (PREPROD depuis dump Production) reste
`INCONNU / NON CONSTRUIT`, non nécessaire tant que la répétition Test suffit
à la preuve recherchée.

## 4. Re-mesure finale — requêtes consolidées, prêtes

Nouveau `re-mesure-finale-gate-1.md` : requêtes strictement `SELECT`
consolidées pour rejouer, immédiatement avant la gate, les six vérifications
qui reposent sur des mesures temporelles (Advisor, cohérence site/site_id,
résolution du fuseau, reprise des services, absence d'écriture concurrente
heuristique, non-existence de `nexus_live_events` en Production). Aucune de
ces requêtes n'a été exécutée ici — aucun accès Production dans ce canal.

## 5. Ce qui reste ouvert

- Exécution réelle de la répétition Test (point 3) — nécessite l'Orchestrator
  ou Frédéric (trousseau/réseau).
- Re-mesures finales (point 4) — nécessite un accès Production en lecture
  seule, à exécuter au plus près de la gate.
- `plan-preprod-anonymise-1.md` reste non construit — pas nécessaire pour ce
  package tant que la répétition Test suffit.
- Fenêtre de déploiement pour #6 : toujours `INCONNU`, mesure à rafraîchir.

## Preuves

- Registre : `node outils/handoff.js verifier` conforme (29 lots, 10
  avertissements préexistants, 0 nouvelle erreur) avant et après ce dépôt.
- Régression : `node run-tests.js` → 228/237, 9 échecs strictement
  identiques à la liste historique, 0 régression.
- Guardians : `outils/guardians-router.js` → 0 finding.
- Apprentissage : `outils/verifier-apprentissage.js` → conforme, 20 règles.
- Aucun fichier applicatif touché — diff limité à `docs/handoff/`.

## Pourquoi un humain doit-il intervenir ici ?

Aucune décision de fondateur n'est nécessaire à ce stade : la fermeture de
la dépendance #21 et l'identification de la répétition Test s'appuient sur
des faits vérifiés par lecture de code, pas sur un jugement de fondateur. Le
package de readiness n'est pas encore complet pour la gate finale (répétition
Test non exécutée, re-mesures non fraîches, PREPROD non construit) — ce
retour documente une progression déterministe, pas une demande d'arbitrage.

## Invariants respectés

Aucun changement `main`/`production`, aucune écriture ni migration Supabase
Production, aucun déploiement réel, aucun rollback Production, aucune
donnée personnelle manipulée, aucune ressource facturable créée, aucun
secret/PIN/service_role ajouté ou exposé.
