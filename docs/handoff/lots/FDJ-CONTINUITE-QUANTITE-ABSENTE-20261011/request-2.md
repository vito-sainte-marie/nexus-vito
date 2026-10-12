---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=866b153
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 144-fichiers
  - id: pr102-tete
    classe: VERIFIED
    valeur: 364a4cd1785bc7c7a794bfaae5524c060b2f60c6
  - id: migration-test
    classe: VERIFIED
    valeur: 20261011220000-registre-320
  - id: migration-production
    classe: VERIFIED
    valeur: 200000-et-220000-absentes-registre-308
  - id: recette-decision-1
    classe: VERIFIED
    valeur: 55-ok-0-ko-3-info
  - id: mutations
    classe: VERIFIED
    valeur: D1-D9-mordent
  - id: recette-200000-rejouee
    classe: VERIFIED
    valeur: 48-ok-5-ko-reecrite-54-ok
  - id: suite
    classe: VERIFIED
    valeur: 264/271
  - id: ci-pr102
    classe: VERIFIED
    valeur: artefact-non-regression-cloudflare-success
---
## Objet

Matérialisation de **decision-1** (APPROVED_WITH_CONDITIONS, `closes: false`) sur la PR [#102](https://github.com/vito-sainte-marie/nexus-vito/pull/102), **non fusionnée**. Le développement et Test sont terminés. Je demande à l'arbitre de juger cette matérialisation, puis des **GO Production distincts**, un par geste. Aucun n'a été accordé par decision-1 (« Aucun GO Production implicite »), et je n'en exécute aucun sans GO.

## État mesuré

| Fait | Valeur |
|---|---|
| PR | #102, OPEN vers `production`, MERGEABLE, tête `364a4cd1785bc7c7a794bfaae5524c060b2f60c6` |
| CI de #102 | Construire et éprouver l'artefact SUCCESS, non-régression SUCCESS ×2, Cloudflare Pages SUCCESS ; GitHub Pages et Supabase Preview SKIPPED |
| Migrations du lot | `20261011200000` (blob `cc0bb193…`, inchangé) et `20261011220000` (blob `217887edf68aea556d35705001d8799948e4977b`) |
| Test (`udljdqxerrbbbajxubfn`) | 200000 et 220000 appliquées ; registre 319 → **320** le 12/10 ; 9 md5 consignés |
| Production (`uzhjpqpctpvxytxpxoqz`), lecture seule | registre **308**, aucune des deux migrations ; les 6 md5 « avant 220000 » sont consignés dans la procédure (12/10 03:58:32Z) |

## Ce que matérialise 20261011220000

- Fin vide et stock disponible nul : **0 explicite automatique**, tracé `stock_final_zero_automatique`.
- Fin vide et stock disponible > 0 : **confirmation par jeu**, dans une seule fenêtre et sans choix présélectionné.
  - « Confirmer 0 » : 0 est enregistré et tracé `confirmation_stock_final_zero` (`confirme_par_l_utilisateur: true`).
  - « Corriger la saisie » : retour au jeu, le quart n'est pas clôturé.
- **Validation impossible** tant qu'une fin est indéterminée : `check_violation`, rien n'est écrit.
- **Mêmes règles** pour l'employé (`fdj_confirmer_caisse`, `fdj_corriger_caisse_confirmee`) et pour le manager (`fdj_manager_creer_quart`, `_modifier_quart`, `_changer_statut_quart`, `_enregistrer_comptages`, régularisations comprises).
- La continuité Q1 → Q2 se lit sur des fins désormais explicites.
- Jamais écrits : une quantité saisie (jamais remplacée par 0), un mouvement de stock, une validation ou certification existante. Les ACL de A6 sont réaffirmées à l'identique ; les 3 aides nouvelles sont réservées à `service_role`.
- Qualification `exige_code_d_abord` : une fois 220000 appliquée, l'ancien écran manager est refusé (23514, M5). Le code de #102 fonctionne avec ou sans 220000.

## Preuves (Test, 12/10)

- **Recette des cas de décision sous rollback : 55 OK / 0 KO / 3 INFO** (C1 à C12). Les INFO :
  - C8a : `changer_statut` ne pose pas `valide_le` (préexistant) ;
  - C8e : `ventes_qte` NULL (préexistant) ;
  - C10 : deux traces pour deux confirmations réelles.
- **Mutations D1 à D9 : toutes mordent.**
- **Recette 200000 rejouée après 220000 : 48 OK / 5 KO** (S1b, S1c, S3a, S4, S7). Ces assertions encodaient le comportement que decision-1 remplace. Je les ai réécrites et la recette rend **54 OK / 0 KO**. Je le signale pour que l'arbitre juge cette réécriture.
- Écran manager : 19 OK (M3, M4, M5, MZ).
- `test_fdj_confirmation_stocks_finaux_20261011.js` : 7/7 tests, 77/77 vérifications. `test_fdj_continuite_quantite_absente_zero_20261011.js` : 10/10.
- `run-tests.js` sur 364a4cd : **264/271**. Les 7 rouges (inventaire, réception) sont préexistants.
- Un **rouge intermittent hors lot** : `test_cloture_services_obsoletes_20260916.js` (« sortie non nulle »), observé 1 fois sur 3 exécutions. Il dépend de `Date.now()` et ne charge aucun fichier FDJ ; seul, il passe 14/14. Je le signale tel quel, sans le reclasser en dette connue.
- Garde d'ordre migration → code : « qualifié pour 2 migration(s) », sortie 0. Épreuve d'empreinte : 32/32 (305).

## Limite connue

Un jeu actif sans aucune ligne de comptage est listé « stock de départ inconnu » : il exige une confirmation et n'est jamais mis à 0 automatiquement.

## GO demandés, un par geste

1. **Arbitrage** de la matérialisation de decision-1 (ChatGPT ou Frédéric).
2. **Migration Production `20261011200000`**, gestes 1 à 3 de `docs/deploiement/procedure-fdj-continuite-quantite-absente-zero-production.md` : préflight (registre 308), application, constat (registre 309).
3. **Fusion de #102 et déploiement GitHub Pages** (approbation humaine de l'environnement), après le geste 2 seulement ; constat du code servi (sha256 de `NEXUS-FDJ-Manager-v1.html`).
4. **Migration Production `20261011220000`**, après le geste 3 seulement : préflight (registre 309, aides absentes, md5 des 6 commandes, code servi constaté), application par bloc gardé, constat (9 md5, registre 310).
5. **Recette Production en lecture seule**, puis constat passif au prochain quart.
6. *Optionnel, autorisation distincte* : régularisation tracée de `539e87bc` (fin MP NULL → 0). Elle n'est pas nécessaire au correctif.

Je ne fusionne, ne migre, ne déploie et n'écris rien en Production sans GO distinct.
