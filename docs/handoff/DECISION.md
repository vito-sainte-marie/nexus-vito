<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/PRISE-DE-POSTE-UN-ECRAN-20261025/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: PRISE-DE-POSTE-UN-ECRAN-20261025
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6397519369
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40192227402), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6397519369. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `PRISE-DE-POSTE-UN-ECRAN-20261025`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `6380b9576ca5df4e4dc4e5c59036239b7add063d`, `HEAD` = `6380b9576ca5df4e4dc4e5c59036239b7add063d`, SHA du run `6380b9576ca5df4e4dc4e5c59036239b7add063d`, tête du rail `6380b9576ca5df4e4dc4e5c59036239b7add063d`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Trois cartes sans présélection ni source planning; choix en un appui; « Ma progression » toujours visible et placée en premier après la fin du service; aucun jeu de planning fictif; aucune nouvelle lecture ou écriture Production; PR uniquement en brouillon vers production avec recette Guardian sur aperçu; aucune fusion, promotion, migration ou mise en production; option planning maintenue hors périmètre. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Décision : APPROVED_WITH_CONDITIONS.**

Le recadrage explicite de Frédéric est cohérent et remplace la présélection prévue par `decision-1` : aucune divergence d’autorité ne subsiste. Le dépassement de périmètre de la seconde lecture Production est consigné ; en l’absence de mutation, de donnée personnelle restituée et de nouvelle lecture prévue, il ne justifie pas un STOP. La suite demeure bornée à la construction et à la recette hors Production.

Conditions vérifiables :
1. Les cartes Piste, Caisse et Renfort sont affichées sans présélection ni dépendance au planning ; le poste est choisi en un appui sur sa carte.
2. « Ma progression » reste visible ; lorsque la journée est terminée, elle passe en premier avec « Votre service est terminé ».
3. Aucun jeu de planning fictif, aucune nouvelle lecture ou écriture Production, et aucune migration liée à l’option planning ne font partie de ce lot.
4. La PR reste en brouillon vers `production`, avec recette Guardian sur l’aperçu ; aucune fusion, promotion ou mise en production n’est autorisée par cette décision.
5. La fiche `OPTION-PLANNING-PRISE-DE-POSTE` reste hors périmètre et ne vaut autorisation ni de migration ni de mutation Production.

Les acquis `DELEGATION_ARBITRE` et `PALIER_HUMAIN_RESTREINT` s’appliquent : aucun nouveau GO humain n’est requis pour construire et tester ce périmètre.

RAIL_LU: 6380b9576ca5df4e4dc4e5c59036239b7add063d

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: PRISE-DE-POSTE-UN-ECRAN-20261025
REQUEST: request-2.md
HEAD: 6380b9576ca5df4e4dc4e5c59036239b7add063d
LEASE: aucun
GATE_STATE: G0, CI à exécuter pendant la construction
PROOF_STATE: PROOF_VALID
CONDITIONS: Trois cartes sans présélection ni source planning; choix en un appui; « Ma progression » toujours visible et placée en premier après la fin du service; aucun jeu de planning fictif; aucune nouvelle lecture ou écriture Production; PR uniquement en brouillon vers production avec recette Guardian sur aperçu; aucune fusion, promotion, migration ou mise en production; option planning maintenue hors périmètre.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
