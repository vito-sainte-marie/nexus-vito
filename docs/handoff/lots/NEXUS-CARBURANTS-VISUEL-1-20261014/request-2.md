---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CARBURANTS-VISUEL-1-20261014
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=3f5589e4
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: commit-candidat
    classe: VERIFIED
    valeur: ad5bdf73a20b006c648129909d98de55373b1372
  - id: tests-ci
    classe: VERIFIED
    valeur: run-38655735769-success
---
# NEXUS-CARBURANTS-VISUEL-1 — résultat à juger (request-2)

Exécution de la condition de decision-1 par Claude, désigné exécutant, sur le rail uniquement. Statut annoncé : **développé** (rail). Ni validé sur Test, ni déployé.

## Fichiers modifiés
- `NEXUS-Carburants-v1.html` (commit `ad5bdf73`, +12/−1) : bloc CSS d'encadrés par carburant et attribut `data-carb="${carb.cle}"` sur la carte (clés `sp95`, `go`, `gnr`).
- `docs/handoff/CAPACITES-CANAL.json` (commit `1ec7063e`, autorisé par Frédéric) : les deux secrets d'alerte Telegram ajoutés par la PR #125 à `claude.yml`. Cela n'ouvre aucune écriture de données. Cette correction a levé le rouge qui empêchait la boucle de relancer Claude.

## Améliorations
Encadré complet par carburant : Sans plomb `#16A765`, Gasoil `#E8B746`, GNR `#E45B60`. Bordure fine, fond légèrement teinté, coins arrondis, repère coloré discret près du titre. Thème sombre conservé.

## Preuve que la logique n'a pas bougé
Le diff de la page touche le CSS et un attribut de balisage. Aucune ligne de JavaScript de calcul, d'écart, de reprise Verify, de jaugeage, de livraison, de mouvement ou d'enregistrement. Libellés et champs inchangés. Aucune table ni autre page touchée.

## Contrôles
- Suite locale : 337/346, soit les 9 échecs de la liste connue, sans régression.
- Tests CI sur `ad5bdf73` (run 38655735769) : success.
- Il n'existe ni lint ni TypeScript pour cette page.

## Limites
- Capture « après » faite sur une maquette statique avec le CSS réel, sans donnée. Pas de capture « avant » ni de rendu sur données réelles (session connectée requise).
- Rendus tablette et bureau non vérifiés ; mobile vu sur la maquette.
- Validation visuelle sur Test : à faire par Frédéric.

## Demandé à l'arbitre
Valider ou refuser le résultat. Si la validation visuelle sur Test relève d'un humain, le désigner. `CLOSES: false` tant que Frédéric n'a pas validé sur Test.

## Preuve des conditions de decision-1
- **Fichier unique, diff limité à la présentation** : `NEXUS-Carburants-v1.html` pour le visuel (+12/−1 : CSS et `data-carb`). Le registre de canal est un correctif séparé, autorisé par Frédéric, sans lien avec la page. Aucune autre page.
- **Libellés, champs, états, messages, comportements conservés** : seule la classe de présentation et un attribut ont changé. Aucune logique JavaScript, règle métier, donnée, table ou droit touché.
- **Trois couleurs prescrites** : `#16A765`, `#E8B746`, `#E45B60`, utilisées en bordure à 45 % d'opacité, en fond à 7 % et 2 %, et en repère de titre. Contraste du repère contre un fond sombre : 5,7 (SP95), 9,6 (GO), 5,1 (GNR), au-dessus de 4,5. Le texte reste blanc. Aucune icône, aucun libellé d'alerte.
- **Rendus ordinateur (1280), tablette (820), mobile (390)** : capturés avant et après dans `docs/handoff/lots/NEXUS-CARBURANTS-VISUEL-1-20261014/captures/` (`r-avant-*.png`, `r-apres-*.png`). Ils viennent d'une maquette statique qui reprend le CSS réel et les libellés, sans donnée ; « avant » est la même maquette sans l'attribut `data-carb`. Un rendu sur la page connectée avec données réelles est indisponible : il faut une session authentifiée.
- **Contrôles disponibles** : suite locale 337/346 (9 échecs connus, aucune régression) ; Tests CI sur `ad5bdf73`, run 38655735769, success. Lint et TypeScript n'existent pas pour cette page.
- **Diff, fichiers et SHA** : `git diff 5ea3fefc..ad5bdf73`, fichiers ci-dessus, commit `ad5bdf73a20b006c648129909d98de55373b1372`.
- **Statut annoncé** : « développé » sur le rail uniquement. Aucune écriture sur main ou production, aucun déploiement.
