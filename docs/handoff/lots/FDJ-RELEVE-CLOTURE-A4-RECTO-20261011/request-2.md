---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-RELEVE-CLOTURE-A4-RECTO-20261011
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=9f2e7ec
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 144-fichiers
  - id: pr101-tete
    classe: VERIFIED
    valeur: f9804e756f3671624142d810a943ac530a87d8e8
  - id: fusion-production
    classe: VERIFIED
    valeur: 866b153843adcffded43548de98431d461eb508b
  - id: ci-pr101
    classe: VERIFIED
    valeur: artefact-nonregression-cloudflare-success
  - id: deploiement
    classe: VERIFIED
    valeur: run-38152602971-waiting-non-approuve
  - id: run-tests
    classe: VERIFIED
    valeur: 262-269-identique-socle
  - id: pdf-trois-ecarts
    classe: VERIFIED
    valeur: 1-page-29-jeux-nul-plus12-moins37.50
  - id: mutations
    classe: VERIFIED
    valeur: 7-sur-7-rouges
---
## Objet

Les conditions de decision-1 sont remplies et #101 est **fusionnée**. Je demande maintenant le **GO de déploiement**, c'est-à-dire l'approbation de l'environnement `github-pages` pour le run 38152602971, qui est en attente. C'est un geste humain : Frédéric.

## État mesuré (11/10/2026, 15:46Z)

| Fait | Valeur |
|---|---|
| Tête fusionnée | `f9804e756f3671624142d810a943ac530a87d8e8` ; CI de #101 : artefact, non-régression ×2 et Cloudflare en SUCCESS |
| Fusion | `866b153843adcffded43548de98431d461eb508b` dans `production` à 15:45:15Z (merge commit, verrouillé sur la tête) |
| Tests sur `production` | run 38152603041 SUCCESS |
| Déploiement | run 38152602971 `waiting` : **non approuvé** |
| run-tests local | 262/269, les 7 mêmes rouges que le socle |

## Conditions de decision-1 et preuves

1. **NON RENSEIGNÉ = 0** : un stock initial, un approvisionnement ou un stock final absent vaut 0 à l'affichage, sans écriture en base.
   - Sur le Q1 réel du 10/10, MISSION PATRIMOINE 15 € affiche 0 / 0 / 0 / 0 / 0,00 € et la synthèse indique « Anomalies (0) ».
   - Garde-fou contre le masquage : une vente déduite d'un stock final compté 0 reste une anomalie (« compté 0 : N vendu(s) déduit(s), à vérifier »), et l'écart au total des ventes du relevé la rattrape aussi.
2. **Bandeau « ÉCART CONSTATÉ »** : pleine largeur, au-dessus du pied de page. Il est réservé avant les colonnes : il n'est jamais coupé ni reporté.
   - Il vaut caisse réelle − caisse attendue, sens confirmé par le schéma `fdj_cash_controls` (`ecart = caisse_reelle - caisse_attendue`).
   - Écart nul : CONFORME en vert. Positif : EXCÉDENT en ambre, avec « + ». Négatif : MANQUANT en rouge, avec « - ».
   - En noir et blanc, le mot, le signe et l'épaisseur du cadre portent le sens.
   - L'écart n'est plus répété dans la synthèse.
3. **Recette visuelle sur trois PDF** : écart nul sur le Q1 réel, +12,00 € et −37,50 €. Chacun fait 1 page de 841,89 × 595,28, avec 29/29 jeux, et les rendus ont été inspectés. Les autres cas (B, D, G, E, sans contexte) font aussi 1 page ; F lève toujours le conflit.
4. **Mutations** : 7 nouvelles, qui rougissent toutes : garde non renseigné, couleurs inversées, signe +, sens inversé, bandeau non réservé, écart répété, montant en petit.

## Effet de bord, commun

Le moteur `nexus-pdf-moteur.js` remplace désormais « ≠ » et « − » par « <> » et « - ». Avant, ces caractères hors WinAnsi étaient retirés silencieusement de tous les PDF.

## Prochain geste

1. **GO de déploiement** par Frédéric : approuver `github-pages` sur le run 38152602971.
2. Ensuite :
   - comparer le HTML servi à `866b153` sans les lignes `<script src>` entières ;
   - vérifier que `nexus-pdf-moteur.js` est bien servi ;
   - générer un relevé réel en lecture seule ;
   - clore le lot.

Je n'approuve pas le déploiement moi-même.
