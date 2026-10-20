---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-R3-CONSOMMATION-CLOTURE-20261020
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6298350443
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39475936778), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6298350443. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-R3-CONSOMMATION-CLOTURE-20261020`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `d48dcb0541abfcb6248bf8295b7cf48ba63c6aab`, `HEAD` = `d48dcb0541abfcb6248bf8295b7cf48ba63c6aab`, SHA du run `d48dcb0541abfcb6248bf8295b7cf48ba63c6aab`, tête du rail `d48dcb0541abfcb6248bf8295b7cf48ba63c6aab`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Écrire G1–G10 rouges avant le code; conserver le rapport sans écriture par défaut et exiger --appliquer; échouer fermé sans mutation sur API indisponible, provenance ou empreinte non concordante, ou pluralité ambiguë; ne modifier aucun workflow, hook, secret, permission, identité, connecteur, branche protégée ou distant; limiter la consommation aux clôtures CI intégralement conformes sans jugement de fond; traiter le journal des transitions et tout déclencheur autonome dans un lot distinct; redéposer les résultats G1–G10 et verifier après implémentation. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Décision

**APPROVED_WITH_CONDITIONS.**

O3 et les épreuves G1–G10 sont admis. L’outil peut être écrit dans `outils/` sans câblage. Ce cadrage relève de l’acquis `OUTILLAGE_A_POSTERIORI` : il ne touche ni Production, ni secret ou permission, ni choix métier, ni `main`.

Aucun palier réservé n’est déclenché. En particulier, ce lot n’arme pas une boucle agissant au nom de Frédéric : O3 n’a aucun déclencheur autonome, fonctionne en rapport par défaut et n’écrit que sur invocation explicite avec `--appliquer`.

Le journal des transitions prévu par le plan R3 reste dans un **lot distinct** : le rattacher ici constituerait une extension inutile du périmètre de consommation des clôtures.

Conditions vérifiables :

1. G1–G10 sont écrites et constatées rouges avant l’implémentation.
2. Le mode par défaut demeure strictement sans écriture ; `--appliquer` est obligatoire pour toute mutation.
3. Toute API inaccessible, provenance non concordante, empreinte divergente ou ambiguïté entre plusieurs candidats provoque un arrêt sans modification.
4. Aucun workflow, hook, permission, secret, identité, connecteur, branche protégée ou écriture distante n’est modifié.
5. L’outil ne consomme que les clôtures CI satisfaisant intégralement les gardes décrites ; il ne juge ni ne réinterprète le fond.
6. Le journal des transitions et tout déclencheur autonome restent hors de ce lot.
7. Après implémentation, une nouvelle demande rapporte les résultats G1–G10 et le passage de `verifier`.

RAIL_LU: d48dcb0541abfcb6248bf8295b7cf48ba63c6aab

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: GOV-R3-CONSOMMATION-CLOTURE-20261020
REQUEST: request-2.md
HEAD: d48dcb0541abfcb6248bf8295b7cf48ba63c6aab
LEASE: aucun
GATE_STATE: G1, CI non exécutée pour l’implémentation à venir
PROOF_STATE: PROOF_VALID
CONDITIONS: Écrire G1–G10 rouges avant le code; conserver le rapport sans écriture par défaut et exiger --appliquer; échouer fermé sans mutation sur API indisponible, provenance ou empreinte non concordante, ou pluralité ambiguë; ne modifier aucun workflow, hook, secret, permission, identité, connecteur, branche protégée ou distant; limiter la consommation aux clôtures CI intégralement conformes sans jugement de fond; traiter le journal des transitions et tout déclencheur autonome dans un lot distinct; redéposer les résultats G1–G10 et verifier après implémentation.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Écrire et exécuter les épreuves G1–G10 rouges sur le rail avant toute implémentation de O3.
