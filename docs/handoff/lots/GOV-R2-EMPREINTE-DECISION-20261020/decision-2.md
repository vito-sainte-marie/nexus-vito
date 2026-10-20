---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-R2-EMPREINTE-DECISION-20261020
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6296095776
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39459485862), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6296095776. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-R2-EMPREINTE-DECISION-20261020`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `1c04afbf3ab883bf9af20b20b88383384fb1dcf4`, `HEAD` = `1c04afbf3ab883bf9af20b20b88383384fb1dcf4`, SHA du run `1c04afbf3ab883bf9af20b20b88383384fb1dcf4`, tête du rail `1c04afbf3ab883bf9af20b20b88383384fb1dcf4`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Écrire F1 à F8 avant le vérificateur et conserver la preuve de leur état rouge puis vert; limiter les modifications à outils/; lier la vérification au commentaire et au run précisément désignés; comparer le corps canonique et les champs DECISION, CLOSES, LOT et REQUEST; échouer explicitement sans consommation si la source est absente, inadmissible, hors lot ou injoignable; maintenir explicite que la concordance ne prouve ni l’identité de l’émetteur ni l’immutabilité absolue du commentaire; ne modifier aucun workflow, secret, permission, identité, connecteur ou mécanisme d’armement et ne câbler aucune option O1 ou O2. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Les conditions de `decision-1.md` sont satisfaites au stade mesure, épreuves et conception. F1 à F8 sont validées comme jeu falsifiant, et le commentaire du relais lu par l’API constitue une source externe désignée adaptée à une preuve de concordance.

Cette validation ne transforme pas l’empreinte en preuve d’identité ou d’immutabilité absolue : le partage de `github-actions[bot]` reste explicitement un risque résiduel. Le vérificateur doit donc se limiter à établir la concordance entre la décision matérialisée et le commentaire précisément désigné.

L’écriture du jeu rouge puis du vérificateur vert dans `outils/` est autorisée sans câblage. Les acquis `OUTILLAGE_A_POSTERIORI`, `COMMIT_PUSH_RAIL_SANS_GO` et `PALIER_HUMAIN_RESTREINT` s’appliquent.

Aucun palier Frédéric n’est déclenché maintenant. O1 et O2 devront rester non exécutées : leur mise en œuvre nécessiterait respectivement un nouvel arbitrage portant les codes `ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC` et/ou `SECRET_PERMISSION_SURFACE_SECURITE`. O3, qui n’arme aucune boucle et n’élargit aucune permission, ne relève pas automatiquement de Frédéric.

RAIL_LU: 1c04afbf3ab883bf9af20b20b88383384fb1dcf4
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: GOV-R2-EMPREINTE-DECISION-20261020
REQUEST: request-2.md
HEAD: 1c04afbf3ab883bf9af20b20b88383384fb1dcf4
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Écrire F1 à F8 avant le vérificateur et conserver la preuve de leur état rouge puis vert; limiter les modifications à outils/; lier la vérification au commentaire et au run précisément désignés; comparer le corps canonique et les champs DECISION, CLOSES, LOT et REQUEST; échouer explicitement sans consommation si la source est absente, inadmissible, hors lot ou injoignable; maintenir explicite que la concordance ne prouve ni l’identité de l’émetteur ni l’immutabilité absolue du commentaire; ne modifier aucun workflow, secret, permission, identité, connecteur ou mécanisme d’armement et ne câbler aucune option O1 ou O2.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Écrire dans outils/ le jeu d’épreuves F1 à F8 et constater son état rouge avant tout code du vérificateur.
