<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6352776584
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39865553026), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6352776584. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `0137793376c42ae951fe576458b83644405bbf7c`, `HEAD` = `0137793376c42ae951fe576458b83644405bbf7c`, SHA du run `0137793376c42ae951fe576458b83644405bbf7c`, tête du rail `0137793376c42ae951fe576458b83644405bbf7c`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Implémenter et éprouver les six correctifs ; utiliser carburant_releves comme source commune du statut de jaugeage avec isolation site_id et jour métier préservées ; aucune migration, écriture Production, fusion vers main/production, promotion ou déploiement ; si une migration devient nécessaire, isoler le correctif 5 dans une nouvelle demande ; obtenir une CI applicable verte. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Les six correctifs sont approuvés. Pour le correctif 5, `carburant_releves` est retenue comme source de vérité commune : le relevé saisi constitue la donnée métier, tandis que la vue de statut est dérivée. L’Accueil et l’écran de jaugeage doivent s’appuyer sur un même calcul, idéalement partagé, correctement borné au site et au jour métier.

Ce choix est technique et applique le comportement déjà demandé — un relevé du jour saisi par le manager compte comme effectué — sans introduire de nouvelle décision métier. Aucun motif d’escalade humaine n’est constitué, conformément à `PALIER_HUMAIN_RESTREINT` et `DELEGATION_ARBITRE`.

Conditions :
1. Couvrir les six corrections par des épreuves ciblées, dont la mutation demandée pour le filtre de catégories.
2. Le parcours ne doit plus utiliser de `confirm()` natif pour l’inventaire ; toute confirmation nécessaire doit être rendue dans la page.
3. Le calcul du jaugeage effectué doit lire `carburant_releves`, avec isolation `site_id` et définition existante du jour métier préservées.
4. Aucune migration n’est autorisée dans ce lot. Si l’implémentation en révèle la nécessité, suspendre uniquement le correctif 5 et déposer une demande séparée.
5. Aucune écriture en Production, fusion vers `main` ou `production`, promotion ou déploiement n’est autorisé par cette décision.
6. La CI applicable doit être verte avant présentation des preuves de réalisation.

RAIL_LU: 0137793376c42ae951fe576458b83644405bbf7c

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022
REQUEST: request-1.md
HEAD: 0137793376c42ae951fe576458b83644405bbf7c
LEASE: aucun
GATE_STATE: G0, CI non lancée
PROOF_STATE: PROOF_VALID
CONDITIONS: Implémenter et éprouver les six correctifs ; utiliser carburant_releves comme source commune du statut de jaugeage avec isolation site_id et jour métier préservées ; aucune migration, écriture Production, fusion vers main/production, promotion ou déploiement ; si une migration devient nécessaire, isoler le correctif 5 dans une nouvelle demande ; obtenir une CI applicable verte.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Implémenter sous lease les six correctifs et leurs épreuves sur une branche de travail issue du rail.
