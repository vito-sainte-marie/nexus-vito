<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/GOV-R1-IDENTITES-PROVENANCE-20261019/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R1-IDENTITES-PROVENANCE-20261019
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
---
# GOV-R1-IDENTITES-PROVENANCE-20261019 : identités et provenance des décisions humaines

**Domaine :** gouvernance. **Étape :** R1 du plan de raccordement (avec R7, même lot de réglages), ouverte par la condition 3 de `GOV-R0-DOSSIER-V2-20261019/decision-1.md`.
**Nature de cette request-1 :** cadrage et épreuves de falsification seulement. Aucun code, aucun outil, workflow, permission, secret, identité ni connecteur n'est modifié par elle.

## Objet

Qu'une décision « humaine » ne soit valable que si elle vient de l'identité de Frédéric, et que le Handoff s'arrête explicitement quand il ne peut pas le vérifier. Aujourd'hui `author` est un texte libre (constat C1 à C8 de `CONSTAT-PROVENANCE-HUMAINE-HANDOFF-20261019.md`) ; sous l'outil actuel, seul le niveau 2 (« rapporté ») est atteignable pour une décision déposée sous le compte `vito-sainte-marie`, partagé avec des agents.

## Périmètre proposé

1. **Cahier de provenance** : exigences X1 (sollicitation proactive), X2 (réponse simple), X3 (reprise traçable ou arrêt explicite) ; niveaux de preuve 1/2/3. Base : `CAHIER-DES-CHARGES-LOT-PROVENANCE-HUMAINE-20261019.md`, à déposer dans ce lot.
2. **Épreuves de falsification écrites avant tout code** (chacune doit pouvoir rougir) :
   - une décision `--auteur "Frédéric Bragance"` sans preuve est qualifiée niveau 2 ou refusée, jamais niveau 3 ;
   - une preuve altérée ou d'un autre compte est rejetée ;
   - une décision sans preuve vérifiable déclenche l'arrêt explicite, pas le silence ;
   - le compte partagé seul ne suffit pas à atteindre le niveau 3.
3. **Instruction des pistes P1 à P5** du cahier (commit signé, approbation d'environnement, empreinte d'échange, second canal, arrêt explicite), avec leurs capacités réelles à vérifier : aucune n'est supposée exister.
4. **Réglages de Frédéric (R1 + R7)** : identités Guardian et agents distinctes, approbation sur `main`/`production`, ruleset du rail, CODEOWNERS, connecteurs cloisonnés. Ils sont **listés, pas exécutés** : ils relèvent de Frédéric et d'une décision de ce lot.

## Hors périmètre

Régularisation de l'incident SQL d'ETAPE5 (reste ouvert), clôture d'ETAPE5, toute écriture Supabase, fusion ou déploiement, tout changement d'outil avant que les épreuves du point 2 soient écrites et validées. R2 à R6 : chacun son lot.

## Décision demandée

Motif `CHANGEMENT_DOCTRINE` (palier de Frédéric) : le cadrage ci-dessus, et le choix des pistes à instruire. Rien n'est appliqué tant que Frédéric n'a pas décidé sur le rail.
