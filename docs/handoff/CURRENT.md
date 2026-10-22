<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/OUTILLAGE-PRISE-EN-CHARGE-20261022/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: OUTILLAGE-PRISE-EN-CHARGE-20261022
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=2c7435bd
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 161-fichiers
---
# OUTILLAGE-PRISE-EN-CHARGE-20261022 : refuser la prise en charge d'une décision déjà prise par un autre exécutant

*Déposé sur instruction de Frédéric (22/10/2026), JAUGEAGE-OCR-2-20261022 étant à l'état DECISION_CONSOMMEE (aucun lot en statut actif, règle D3 respectée). Aucun code n'est écrit avant la décision.*

## Constat : deux doubles exécutions le 22/10

1. **JAUGEAGE-SAISIE-DIRECTE** : la décision désignait `EXECUTANT_NEXT: github-actions-claude`. Une exécution a été prise en charge en session locale pendant que le runner pouvait aussi l'exécuter ; deux auteurs ont écrit sur le rail pour la même décision.
2. **JAUGEAGE-OCR-2** : même schéma sur la décision suivante, la prise en charge ayant eu lieu sans `git fetch` préalable du rail.

Cause commune : `handoff.js consommer <lot> --prise-en-charge` n'examine pas si un autre exécutant a déjà écrit après la décision. Rien dans l'outil ne s'oppose à une seconde prise en charge ; seule la vigilance de l'humain ou de Claude l'évite.

## Ce qui est demandé

1. **Refus outillé.** `consommer --prise-en-charge` refuse (code non nul, motif nommé, par exemple `DECISION_DEJA_PRISE_EN_CHARGE`) quand le rail contient, après la décision visée, un commit ou une entrée d'état d'un exécutant différent de celui qui demande. Message : qui, quand, quel commit.
2. **Épreuve rouge puis verte, avec mutation.** Rouge : deux prises en charge successives par deux exécutants, la seconde doit être refusée. Verte après le correctif. Mutation : neutraliser la comparaison d'exécutant doit faire rougir l'épreuve. Cas voisins à garder verts : même exécutant qui reprend après interruption, décision `closes:true`, lot sans exécutant désigné.
3. **Règle provisoire dans la gouvernance (GOV-002).** Inscrire dans `docs/learning/RULES.json` et `docs/learning/EXPERIENCE.jsonl` : quand `EXECUTANT_NEXT: github-actions-claude`, ne pas prendre en charge sans demande explicite de Frédéric ; avant toute prise en charge, refaire un `git fetch` du rail et s'arrêter si un autre exécutant y a écrit après la décision. La règle devient caduque quand le refus outillé est livré.
4. **Seconde leçon pour `RULES.json` (PR #149, 22/10).** Avant de déclarer des épreuves vertes, rejouer la suite après `bash outils/build.sh`, comme la CI (le build remplace les jetons `?v=` par l'empreinte de génération ; une épreuve qui lit un HTML source peut rougir seulement après). Constat : `test_jaugeage_capture_guidee_20261022.js` rouge en CI sur `7d98a1a7`, verte en local ; corrigé par `20f9286c`. Inscrire aussi l'événement dans `EXPERIENCE.jsonl`.
5. **Constat consigné.** Les deux doubles exécutions du 22/10 inscrites dans `EXPERIENCE.jsonl` (lot, décision, commits concernés, cause).

## Limites

Aucune écriture en Production, aucun déploiement, aucune fusion sans GO. Le périmètre est `outils/handoff.js`, son épreuve et `docs/learning/` ; pas de changement du protocole `nexus-handoff/2`.

## À arbitrer

Approuver le refus outillé et l'inscription de la règle, exécutant à désigner (la règle provisoire interdit à Claude de prendre en charge sans demande explicite).

## Lecture de `consommer` (outils/handoff.js, vers la ligne 559, faite le 22/10)

- `--prise-en-charge` ne compare que `v.statut === 'ATTENTE_CONSOMMATION_DECISION'` et `v.commit_decision === commit` : une seconde prise en charge sur la même décision est traitée comme idempotente (« rien à refaire »), quel que soit l'exécutant.
- `STATE.json` ne porte **aucun champ exécutant** : ni `pris_en_charge_par`, ni auteur du commit de décision. Le critère « autre exécutant » ne peut donc pas s'appuyer sur l'état seul ; il doit s'appuyer sur le rail : commits postérieurs au `commit_decision` (auteur, `Co-Authored-By`, committeur `github-actions[bot]`) et sur `EXECUTANT_NEXT` lu dans la décision.
- À établir par l'exécutant désigné : la règle exacte (auteur du commit, ou champ `pris_en_charge_par` écrit à la prise en charge). Je recommande le second, plus fiable, avec repli sur les auteurs de commits pour les prises en charge déjà faites.
- Limite avouée : je n'ai pas encore écrit ni éprouvé ce critère.
