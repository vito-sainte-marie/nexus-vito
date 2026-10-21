---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-OCR-20261021
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6324225452
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39658330491), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6324225452. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-OCR-20261021`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `4be124f1cc87f3a6992163b7853d6fea4315209f`, `HEAD` = `4be124f1cc87f3a6992163b7853d6fea4315209f`, SHA du run `4be124f1cc87f3a6992163b7853d6fea4315209f`, tête du rail `4be124f1cc87f3a6992163b7853d6fea4315209f`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Avant tout commit contenant le worker, comparer par empreintes la copie iMac et la copie iCloud et consigner la provenance retenue ; scanner l’arbre candidat contre les secrets et vérifier que .gitignore exclut .env, qu’aucun fichier .env ni aucune valeur réelle de SUPABASE_SERVICE_KEY n’est versionné, et que .env.example ne contient que des valeurs factices ; limiter les fichiers au périmètre annoncé ; tester uniquement avec des textes synthétiques ou une photo sans personne ni document ; ne réaliser aucun préremplissage, SQL, migration, fusion vers une branche protégée ni déploiement dans ce lot. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

Le périmètre est approuvé sous conditions. La référence à une variable d’environnement existante n’élargit pas en elle-même une surface de sécurité, dès lors qu’aucune valeur secrète n’est lue, copiée ou versionnée. Aucun motif de palier humain n’est déclenché. Conformément à `DELEGATION_ARBITRE` et `COMMIT_PUSH_RAIL_SANS_GO`, l’ouverture du chantier et les commits sur le rail n’exigent pas de GO supplémentaire.

RAIL_LU: 4be124f1cc87f3a6992163b7853d6fea4315209f

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: JAUGEAGE-OCR-20261021
REQUEST: request-1.md
HEAD: 4be124f1cc87f3a6992163b7853d6fea4315209f
LEASE: aucun
GATE_STATE: G0, CI non exécutée pour ce lot
PROOF_STATE: PROOF_VALID
CONDITIONS: Avant tout commit contenant le worker, comparer par empreintes la copie iMac et la copie iCloud et consigner la provenance retenue ; scanner l’arbre candidat contre les secrets et vérifier que `.gitignore` exclut `.env`, qu’aucun fichier `.env` ni aucune valeur réelle de `SUPABASE_SERVICE_KEY` n’est versionné, et que `.env.example` ne contient que des valeurs factices ; limiter les fichiers au périmètre annoncé ; tester uniquement avec des textes synthétiques ou une photo sans personne ni document ; ne réaliser aucun préremplissage, SQL, migration, fusion vers une branche protégée ni déploiement dans ce lot.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec `outils/handoff.js decision --auteur ChatGPT`.
