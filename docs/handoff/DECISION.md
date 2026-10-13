<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-REGUL-GROUPES-1-20261013/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-REGUL-GROUPES-1-20261013
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38479137955), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6156741457. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-REGUL-GROUPES-1-20261013`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `INACCESSIBLE`, `HEAD` = `INACCESSIBLE`, SHA du run `114eb7bd3b5eb176c5db3b1c1ba52b3ead306537`, tête du rail `114eb7bd3b5eb176c5db3b1c1ba52b3ead306537`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« créer le portage depuis la tête mesurée de origin/production; conserver le blob fonctionnel canonique de la migration; documenter l’écart d’estampille Test; vérifier le diff et repasser la CI; prouver la compatibilité migration-seule avec le code Production actuel ou formaliser une séquence atomique avec retour arrière; aucune fusion, migration Production ou mise en ligne n’est autorisée par cette décision »). Elles lient l'exécutant suivant (`Claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

J’arbitre sur le texte intégral recopié dans le réveil, le connecteur au rail n’étant pas accessible ici.

**Verdict : APPROVED_WITH_CONDITIONS.**

1. Le classement `atomique_ou_procedure_speciale` est confirmé à titre conservatoire. Les occurrences `drop_column` / `drop_table` / `truncate` décrites comme commentaires ou gardes ne constituent pas, à elles seules, des opérations exécutées.
2. L’ordre de pose retenu est **migration puis code**, puisque le nouveau code dépend des RPC introduites par la migration.
3. Le véhicule correct est un **portage propre depuis `origin/production`**, et non la fusion directe de la PR #109 issue du rail.
4. Le portage doit conserver le contenu canonique de la migration `20261013140000`, documenter l’écart d’estampille propre à Test et repasser la CI ainsi que la vérification du diff.
5. Avant toute proposition d’exécution Production, la procédure devra prouver soit la compatibilité du code Production actuel pendant l’intervalle « migration posée, nouveau code non encore déployé », soit prévoir une séquence atomique ou une fenêtre maîtrisée avec retour arrière.
6. Cette décision n’autorise ni migration Supabase Production, ni fusion vers `production`, ni déploiement Pages. Ces gestes futurs relèveraient respectivement de `SUPABASE_PRODUCTION_MUTATION` et `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`.
7. La restitution du surplus est hors lot et ne bloque pas ce portage, conformément à `SUJET_ETRANGER_NE_BLOQUE_PAS`.

RAIL_LU: INACCESSIBLE

NEXT_ACTION_CONTRACT  
DECISION: APPROVED_WITH_CONDITIONS  
CLOSES: false  
LOT: NEXUS-REGUL-GROUPES-1-20261013  
REQUEST: request-1.md  
HEAD: INACCESSIBLE  
LEASE: aucun  
GATE_STATE: G2, CI de la PR #109 verte; CI du portage à exécuter  
PROOF_STATE: PROOF_VALID  
CONDITIONS: créer le portage depuis la tête mesurée de origin/production; conserver le blob fonctionnel canonique de la migration; documenter l’écart d’estampille Test; vérifier le diff et repasser la CI; prouver la compatibilité migration-seule avec le code Production actuel ou formaliser une séquence atomique avec retour arrière; aucune fusion, migration Production ou mise en ligne n’est autorisée par cette décision  
BLOCKER: aucun  
STOP_REQUIRED: non  
CAPACITE_REQUISE: écriture Git sur une branche de travail  
OWNER_NEXT: Claude  
EXECUTANT_NEXT: Claude  
ACTION_NEXT: créer une branche de portage propre depuis la tête mesurée de origin/production et y reporter le lot sans fusionner vers production.
