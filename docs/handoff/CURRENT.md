<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-HEURES-VERIFY-PAYE-1-20261009/request-10.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 10
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=f36679f
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 147-fichiers
  - id: pr105-tete
    classe: VERIFIED
    valeur: a02deb2101d175a6e533910ae2552aa2e6bfa4c6
  - id: pr105-ci
    classe: VERIFIED
    valeur: build-SUCCESS-non-regression-SUCCESS-CLEAN
  - id: recette-q2-servie
    classe: HUMAN
    valeur: non-faite
---
# Demande d'arbitrage — PR #105 : le renfort déclaré au Q2 vaut 7 h (remplace la règle du 10/10)

Ce texte se suffit. Demande d'arbitrage seulement ; ni GO ni ordre d'exécution.

## Changement de règle demandé

La règle posée le 10/10 ignorait un renfort déclaré au quart 2. Frédéric a tranché le 13/10 : un renfort est désigné au Q1 ; il ne doit pas être enregistré aux deux quarts ; le formulaire Q2 doit dire que la personne est déjà renfort ; sans renfort au Q1, la saisie manuelle au Q2 reste possible (rare). Choix (a) : Paye compte un renfort déclaré au Q2 comme renfort de journée, 7 h normales, 0 h sup.

## Ce que fait la PR #105 (`renfort-q2-manuel-20261013` vers `production`, tête `a02deb2`, 1 commit)

- Verify : la note du Q2 indique « Déjà renfort de la journée (quart N, noms). Il vaut 7 h pour le jour entier : ne le déclarez pas une seconde fois ici. »
- Paye (`nexus-paye-moteur.js`) : le renfort Q2 n'est plus ignoré. Le jeu par salarié et par jour garantit qu'un renfort aux deux quarts ne vaut qu'une journée. Caisse/piste prime toujours sans cumul. Aucun taux, aucune retenue.
- Épreuve `test_nexus_paye_reconciliation_verify_paye_20261013.js` : Q2 → 7 h, 1 jour.

## État mesuré

| Mesure | Valeur |
|---|---|
| PR | OPEN, MERGEABLE, CLEAN, tête `a02deb2101d175a6e533910ae2552aa2e6bfa4c6` |
| contrôles | « Construire et éprouver l'artefact » SUCCESS ; `non-regression` SUCCESS ; Cloudflare Pages SUCCESS ; Pages SKIPPED (attendu) |
| épreuves ciblées | 5 vertes |
| suite complète | 7 rouges inventaire/réception, identiques sur `origin/production` (préexistants, non causés) |
| données Production | 9 renforts Q1 du 01 au 12/10 écrits dans `audits_caisse.employes_renfort` sur instruction de Frédéric ; relus dans Paye : 7 h normales, 0 h sup, comptés une fois |
| recette navigateur Q2 sur URL servie | non faite |

## Dépendance

La PR #105 repose sur le code de la PR #104 (request-8), non encore fusionnée au moment de cette demande : #105 ne se fusionne qu'après #104, ou le verdict doit le dire.

## Geste demandé

Verdict sur le changement de règle (Q2 compté 7 h sans cumul) puis, séparément, GO nominatifs pour la fusion de #105 et pour le déploiement Pages. Rien n'est fusionné ni déployé par cette demande.

## Hors périmètre, non tranché

Q4 (case vide au planning) et B (heures exceptionnelles : colonne de provenance ou ligne distincte) restent ouvertes, sans recommandation fermée.
