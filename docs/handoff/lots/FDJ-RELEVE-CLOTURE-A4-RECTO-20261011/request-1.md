---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-RELEVE-CLOTURE-A4-RECTO-20261011
seq: 1
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
    valeur: c623307596863378f384c4e7a5499ba700304159
  - id: ci-pr101
    classe: VERIFIED
    valeur: artefact-nonregression-cloudflare-success
  - id: run-tests
    classe: VERIFIED
    valeur: 262-269-identique-socle
  - id: pdf-cas-a
    classe: VERIFIED
    valeur: 1-page-29-jeux
---
## Objet

Lot mandaté par Frédéric le 11/10/2026 : **refondre le PDF du relevé de clôture d'un quart FDJ en une seule page A4 paysage, recto, avec le détail intégral des jeux.** Il ne doit plus y avoir de troncature ni de « + N autres — voir le détail dans l'app ».

Je demande **un arbitrage sur la PR [#101](https://github.com/vito-sainte-marie/nexus-vito/pull/101)**. Le geste recommandé est le **GO de fusion** dans `production`, puis le **GO de déploiement**, qui est un geste distinct. Il n'y a **aucune migration** et aucune écriture en base.

## État mesuré (11/10/2026)

| Fait | Valeur | Comment |
|---|---|---|
| PR | #101, OPEN vers `production`, MERGEABLE, **non fusionnée** | `gh pr view 101` |
| Tête | `c623307596863378f384c4e7a5499ba700304159` (branche `fdj-releve-cloture-a4-recto-20261011`, base `9f2e7ec`) | — |
| CI de #101 | Construire et éprouver l'artefact SUCCESS, non-regression ×2 SUCCESS, Cloudflare Pages SUCCESS ; GitHub Pages et Supabase Preview SKIPPED | `statusCheckRollup` |
| Fichiers | `NEXUS-FDJ-Manager-v1.html`, `test_fdj_releve_cloture_paysage_1page.js` (réécrit), `test_fdj_releve_manager_ecran.js` | — |
| run-tests local | 262/269, **identique** au socle `origin/production` 9f2e7ec : les 7 mêmes rouges connus, aucun nouveau | — |

## Diagnostic

Le PDF de référence est le Q1 du 10/10, quart de Loane : 29 jeux, caisse 1 501,50 / 1 501,50, deux versions dont une régularisation manager. `construireReleveClotureQuartPdf` n'imprimait que les 10 premiers jeux. Il mêlait les quantités et les euros dans une même cellule, et affichait un écart signé.

## Changement (un générateur, même moteur pdf-lib)

- **En-tête compact** : station, quart, employé, validation, identifiant abrégé, `Version N/total · Définitif|Provisoire`.
- **Gauche (65 %)** : un tableau de stock intégral sur 7 colonnes. Les jeux sans vente sont présents et le total grattage figure en pied de tableau. Les incohérences quantité/montant sont **signalées**, jamais corrigées.
- **Droite (35 %)** : la synthèse caisse (« Caisse conforme / Excédent constaté / Manquant constaté », écart en valeur absolue), les contrôles, puis l'historique des versions. L'historique est complet s'il tient ; sinon il est condensé, avec le nombre réel de versions, l'initiale, la dernière et un renvoi vers NEXUS.
- **Donnée absente** : affichée « non saisi » ou « indisponible » et comptée en anomalie.
- **Contenu impossible à tenir sur une page** : le relevé **n'est pas généré**, et un conflit explicite est remonté (« rien n'a été tronqué »). Il n'y a ni annexe, ni réduction arbitraire des polices.

## Recette (vrais PDF générés avec pdf-lib)

| Cas | Résultat |
|---|---|
| A — Q1 du 10/10, données Production lues en `begin read only` | 1 page 841,89 × 595,28, 29/29 jeux, Caisse conforme, Version 2/2 · Définitif |
| B — mouvements (approvisionnements) | 1 page |
| C — manquant −37,50 / excédent +12,00 | libellés et écart absolu corrects |
| D — 6 versions ; D' — 21 versions | liste complète ; historique condensé « 21 versions au total » |
| E — noms longs, montants ×1000 | 1 page |
| F — 149 jeux ; F' — 29 stocks finaux absents | conflit levé, aucun PDF |

**Frontières mesurées.** Les noms tiennent jusqu'à environ 51 caractères avec des montants ×1000 ; le plus long nom réel en Production fait 22 caractères. Au-delà d'environ 19 à 22 anomalies d'une ligne, le conflit est levé ; le cas réel en compte 1.

**Mutations, dans une copie jetable.** Tronquer à 10 jeux, signer l'écart, tronquer l'historique, couper les anomalies, neutraliser la garde du tableau : **toutes rougissent**.

## Hors périmètre, inchangé

Règles FDJ, calcul de caisse, stocks, priorité Q2/Q1, RLS, certification, régularisations, écritures fermées par A6. Il n'y a aucune migration.

## Prochain geste recommandé

1. **GO de fusion de #101** (Frédéric ou arbitre).
2. Puis le **GO de déploiement** : l'approbation de l'environnement `github-pages` reste un geste humain distinct.
3. Après le déploiement : comparer le HTML servi à `production` sans les lignes `<script src>` entières, puis générer un relevé réel en lecture seule.

Je ne fusionne ni ne déploie quoi que ce soit sans ce GO.
