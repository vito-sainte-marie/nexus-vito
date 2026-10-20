<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/GOV-R2-EMPREINTE-DECISION-20261020/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-R2-EMPREINTE-DECISION-20261020
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6295763318
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39457083039), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6295763318. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-R2-EMPREINTE-DECISION-20261020`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `68ca39cdbf4a17f50abf38fbf0708e7d7ced2117`, `HEAD` = `68ca39cdbf4a17f50abf38fbf0708e7d7ced2117`, SHA du run `68ca39cdbf4a17f50abf38fbf0708e7d7ced2117`, tête du rail `68ca39cdbf4a17f50abf38fbf0708e7d7ced2117`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Attribuer le mécanisme des 29 consommations et l’exception R1; écrire les épreuves falsifiantes avant le code; vérifier l’empreinte contre la source désignée indépendante; conserver explicite le risque d’identité github-actions[bot]; ne modifier aucun élément hors périmètre et n’armer aucune automatisation; garantir une consommation mécanique, traçable et sans jugement métier. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Le cadrage et les épreuves de falsification sont admis comme base de R2. La conception de la consommation automatique peut avancer sans modifier les éléments exclus, après qualification de l’écart E10.

Conditions :
1. Attribuer factuellement le mécanisme ayant consommé les 29 clôtures et expliquer pourquoi il n’a pas consommé automatiquement la clôture R1.
2. Écrire avant le code les épreuves falsifiantes proposées, notamment contre le recalcul d’une empreinte après altération. La vérification doit comparer la décision à une source désignée et indépendante, pas seulement valider un couple texte–empreinte fourni ensemble.
3. Ne pas présenter l’empreinte comme une preuve de l’identité réelle de l’émetteur : le risque résiduel lié à plusieurs jobs publiant sous `github-actions[bot]` doit rester explicite tant qu’une provenance fiable ne le résout pas.
4. Limiter cette étape à la mesure, aux épreuves et à la conception. Toute option touchant un workflow, une permission, un secret, une identité, un connecteur ou un mécanisme d’armement doit seulement être documentée puis arrêtée avant exécution. Une permission ou un secret relève de `SECRET_PERMISSION_SURFACE_SECURITE` ; l’armement d’une boucle agissant au nom de Frédéric relève de `ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC`.
5. La consommation automatique conçue doit rester mécanique : contrat valide, empreinte et commentaire source concordants, preuves attendues présentes, provenance CI admissible et traçabilité du geste. Elle ne doit effectuer aucun jugement métier.

Les acquis `DELEGATION_ARBITRE`, `OUTILLAGE_A_POSTERIORI` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent : aucun GO humain supplémentaire n’est requis pour poursuivre la mesure, les épreuves et la conception sur le rail.

RAIL_LU: 68ca39cdbf4a17f50abf38fbf0708e7d7ced2117
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: GOV-R2-EMPREINTE-DECISION-20261020
REQUEST: request-1.md
HEAD: 68ca39cdbf4a17f50abf38fbf0708e7d7ced2117
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Attribuer le mécanisme des 29 consommations et l’exception R1; écrire les épreuves falsifiantes avant le code; vérifier l’empreinte contre la source désignée indépendante; conserver explicite le risque d’identité github-actions[bot]; ne modifier aucun élément hors périmètre et n’armer aucune automatisation; garantir une consommation mécanique, traçable et sans jugement métier.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Documenter sur le rail l’attribution vérifiable des 29 consommations E10 et la cause précise de l’exception R1.
