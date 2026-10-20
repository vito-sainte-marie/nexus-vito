---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R2-EMPREINTE-DECISION-20261020
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
# GOV-R2-EMPREINTE-DECISION-20261020 : empreinte de décision et consommation automatique d'une clôture déposée par la CI

**Domaine :** gouvernance. **Étape :** R2 du plan de raccordement (`PLAN-RACCORDEMENT-GUARDIAN.md`, §2), après R1 (clos au registre, `39318f56`).
**Nature de cette request-1 :** cadrage et épreuves de falsification seulement. Aucun code, outil, workflow, permission, secret, identité ni connecteur n'est modifié par elle.

## Objet

1. **Empreinte (plan R2).** La décision déposée porte l'empreinte du texte de l'arbitre et l'identifiant du commentaire source ; `verifier` recompare. Aujourd'hui, une décision modifiée après dépôt n'est pas détectée (N6 de la matrice), et aucun acteur n'est empêché d'élargir une décision reçue (I3). R1 a posé la provenance (`mode`, `reference`) ; R2 y ajoute le contenu.
2. **Consommation automatique d'une clôture déposée par la CI.** Constat du 20/10/2026 : la decision-4 du lot R1 (`APPROVED`, `closes: true`) a été déposée par la CI, mais `STATE.json` restait en `ATTENTE_DECISION` ; il a fallu une prise en charge puis une consommation à la main (preuve `a2f2c2c5`, poussé `39318f56`). La CI pousse avec le jeton du workflow, qui ne relance ni la CI ni Claude : personne n'est déclenché. Frédéric demande que ce soit automatique (note du 20/10/2026, pour R2 ou R3).
3. **Risque résiduel hérité de R1.** Un job `claude.yml` utilise le même jeton que le relais et peut poster sous `github-actions[bot]` ; la vérification E5 de R1 ne distingue pas la CI de relais d'un job d'agent. L'empreinte (point 1) réduit ce risque sans l'éliminer : elle lie le dépôt au commentaire désigné, pas à son émetteur réel.

## Périmètre proposé

- **Épreuves de falsification écrites avant tout code** (chacune doit pouvoir rougir) : décision dont le texte diffère de l'empreinte ; décision dont l'identifiant de commentaire source est absent ou ne correspond pas ; empreinte recalculée à partir d'un texte modifié puis redéposée ; clôture automatique refusée si contrat, empreinte ou preuves attendues manquent ; clôture automatique qui ne doit jamais s'appliquer à une décision non issue de la CI.
- **Conception de la consommation automatique** : qui la déclenche sans relancer Claude ni modifier le jeton, quelle vérification formelle précède (contrat, empreinte, preuves attendues, aucun jugement métier par la CI, cf. E10 de la matrice), et comment le geste reste traçable. Les options qui exigent de toucher un workflow, une permission ou un secret sont **listées, pas exécutées**.
- **Mesure préalable** : la matrice (E10) donne 29 clôtures consommées sur 29 depuis le 08/10, sans mécanisme attribué ; le cas du 20/10 la contredit pour ce lot. À qualifier avant toute conception : quel mécanisme a consommé les 29, et pourquoi pas celle-ci.

## Hors périmètre

Voie B ; `tests.yml` ; tout workflow, permission, secret, identité, connecteur ou workflow d'armement ; Production ; règle des niveaux ; incident SQL d'ETAPE5 et clôture d'ETAPE5 ; toute écriture Supabase, fusion ou déploiement. R3 à R6 : chacun son lot.

## Décision demandée

Admettre le cadrage et les épreuves comme base de la R2, et dire si la conception de la consommation automatique peut avancer sans toucher un des éléments exclus. Si une option exige un palier réservé, l'arbitre le nomme et Claude Code s'arrête et rapporte. Rien n'est appliqué par cette demande.
