<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/ACCUEIL-EN-SERVICE-20261030/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: ACCUEIL-EN-SERVICE-20261030
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6520833102
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41042957374), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6520833102. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `ACCUEIL-EN-SERVICE-20261030`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `75108ba5b8c933d0cd370a310a46c4f66b00e93a`, `HEAD` = `75108ba5b8c933d0cd370a310a46c4f66b00e93a`, SHA du run `75108ba5b8c933d0cd370a310a46c4f66b00e93a`, tête du rail `75108ba5b8c933d0cd370a310a46c4f66b00e93a`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Limiter la refonte fonctionnelle à l’Accueil Piste; n’adapter Caisse et Renfort que visuellement et sans changement de comportement; réutiliser exactement filLien/urlRepriseSelonFaits; préserver l’accès à l’étape 1; respecter reception_carburant_role, le filtrage par site et le fuseau de la station; ajouter les épreuves par mutations demandées; effectuer la recette sur Test et consigner ses résultats dans la PR; aucune fusion, promotion ou opération Production n’est autorisée par cette décision. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Décision

**APPROVED_WITH_CONDITIONS.**

Le périmètre fonctionnel principal est limité à **l’Accueil du pompiste en service**. Le point 8 est accepté uniquement comme adaptation visuelle opportuniste : pour Caisse et Renfort, réutiliser l’en-tête et la carte de poste seulement si cela n’entraîne aucune modification de comportement, de donnée, de calcul ou de routage. Sinon, leur contenu reste inchangé et l’écart est consigné dans la PR.

La mise en œuvre et la recette sur Test sont préautorisées par `PREAUTORISATIONS_CLAUDE`. Aucun GO humain supplémentaire n’est requis pour le code, les tests, les commits ou les pushs sur la branche du lot, conformément à `COMMIT_PUSH_RAIL_SANS_GO`.

Cette décision n’autorise ni fusion, ni déploiement, ni promotion vers Production. Lorsque la fusion sera effectivement demandée, elle restera sous le palier `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`.

Conditions vérifiables :

1. Le bouton principal du fil réutilise exactement `filLien` et conserve la cible issue de `urlRepriseSelonFaits`, sans recalcul ni perte d’accès à l’étape 1 du jaugeage.
2. Les tests par mutations couvrent au minimum l’unicité du bouton principal, l’égalité de sa cible avec `urlRepriseSelonFaits` et la présence de la tuile Réception pour le poste Piste.
3. La tuile Réception respecte `station_config.reception_carburant_role` et mène à `NEXUS-Carburant-Reception-v1`.
4. La détection d’une livraison attendue reste une lecture seule, filtrée par `site`, date locale de la station et statuts éligibles déclarés dans la demande.
5. Aucune donnée, aucun calcul métier et aucun comportement Caisse/Renfort hors adaptation visuelle sûre ne sont modifiés.
6. La recette est réalisée sur Test et la PR consigne les scénarios effectivement vérifiés ainsi que tout maintien à l’identique de Caisse ou Renfort.

BRANCHE_DU_LOT: accueil-en-service-20261030

RAIL_LU: 75108ba5b8c933d0cd370a310a46c4f66b00e93a
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: ACCUEIL-EN-SERVICE-20261030
REQUEST: request-1.md
HEAD: 75108ba5b8c933d0cd370a310a46c4f66b00e93a
LEASE: aucun
GATE_STATE: G0, CI non lancée
PROOF_STATE: PROOF_VALID
CONDITIONS: Limiter la refonte fonctionnelle à l’Accueil Piste; n’adapter Caisse et Renfort que visuellement et sans changement de comportement; réutiliser exactement filLien/urlRepriseSelonFaits; préserver l’accès à l’étape 1; respecter reception_carburant_role, le filtrage par site et le fuseau de la station; ajouter les épreuves par mutations demandées; effectuer la recette sur Test et consigner ses résultats dans la PR; aucune fusion, promotion ou opération Production n’est autorisée par cette décision.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Implémenter la refonte approuvée et ses tests sur la branche du lot.
