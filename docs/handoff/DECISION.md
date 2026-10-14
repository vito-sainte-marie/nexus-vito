<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CARBURANTS-VISUEL-1-20261014/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CARBURANTS-VISUEL-1-20261014
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38654515912), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6180805451. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-CARBURANTS-VISUEL-1-20261014`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `479bc71dc358a227dc81f8fc0dad6f62a19f3aa2`, `HEAD` = `479bc71dc358a227dc81f8fc0dad6f62a19f3aa2`, SHA du run `479bc71dc358a227dc81f8fc0dad6f62a19f3aa2`, tête du rail `479bc71dc358a227dc81f8fc0dad6f62a19f3aa2`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Modifier uniquement NEXUS-Carburants-v1.html sur le rail; limiter le diff au CSS et au balisage de présentation des trois cartes; conserver tous les libellés, champs, états, messages et comportements; ne modifier aucune logique JavaScript, règle métier, donnée, table, droit ou autre page; appliquer les trois couleurs prescrites avec contraste suffisant et sans apparence d’alerte; vérifier les rendus ordinateur, tablette et mobile; exécuter les contrôles réellement disponibles et signaler ceux qui n’existent pas; fournir le diff, les fichiers modifiés, les résultats des contrôles, le SHA du commit et une capture avant/après si possible, sinon déclarer explicitement son indisponibilité; annoncer uniquement le statut « développé » sur le rail; aucune écriture sur main ou production et aucun déploiement. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Décision

**APPROVED_WITH_CONDITIONS.**

La modification est visuelle, réversible et limitée au rail. Elle ne touche ni Production, ni secret, ni permission, ni base de données, ni règle métier. Aucun motif d’escalade humaine n’est constitué. Les acquis `DELEGATION_ARBITRE` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent : l’exécution et le push sur le rail ne nécessitent aucun GO humain supplémentaire.

L’exécution devra préserver strictement la logique fonctionnelle et produire les preuves demandées avant l’arbitrage du résultat.

RAIL_LU: 479bc71dc358a227dc81f8fc0dad6f62a19f3aa2

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-CARBURANTS-VISUEL-1-20261014
REQUEST: request-1.md
HEAD: 479bc71dc358a227dc81f8fc0dad6f62a19f3aa2
LEASE: aucun
GATE_STATE: G0, CI non exécutée pour ce changement
PROOF_STATE: PROOF_VALID
CONDITIONS: Modifier uniquement NEXUS-Carburants-v1.html sur le rail; limiter le diff au CSS et au balisage de présentation des trois cartes; conserver tous les libellés, champs, états, messages et comportements; ne modifier aucune logique JavaScript, règle métier, donnée, table, droit ou autre page; appliquer les trois couleurs prescrites avec contraste suffisant et sans apparence d’alerte; vérifier les rendus ordinateur, tablette et mobile; exécuter les contrôles réellement disponibles et signaler ceux qui n’existent pas; fournir le diff, les fichiers modifiés, les résultats des contrôles, le SHA du commit et une capture avant/après si possible, sinon déclarer explicitement son indisponibilité; annoncer uniquement le statut « développé » sur le rail; aucune écriture sur main ou production et aucun déploiement.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Développer et pousser sur le rail l’identité visuelle prescrite des trois cartes Carburants avec les preuves d’exécution demandées.
