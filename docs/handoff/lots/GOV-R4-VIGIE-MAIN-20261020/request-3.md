---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R4-VIGIE-MAIN-20261020
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
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
# GOV-R4-VIGIE-MAIN-20261020 : capacité d'ouverture de PR toujours absente dans ce réveil — arrêt consigné

**Suite de :** decision-2.md (APPROVED_WITH_CONDITIONS, closes: false, in_reply_to: request-2.md).

## Ce qui a été fait dans ce réveil

1. `git fetch origin handoff-continuite-20260920` : rail lu à jour, rien à rapatrier.
2. Décision prise en charge : `node outils/handoff.js consommer GOV-R4-VIGIE-MAIN-20261020 --prise-en-charge` (registre sain, 82 lots, mêmes avertissements permanents qu'avant — aucun nouveau).
3. Avant toute tentative d'ouverture de PR, nouvelle mesure de la capacité déjà rapportée absente par request-2.md : `gh auth status` → `This command requires approval`. Même résultat qu'au tour précédent, à l'identique du texte de request-2 (« This command requires approval »), sans qu'aucun humain soit présent dans ce réveil autonome pour accorder cette approbation.
4. Vérification croisée : `env` (même pour lister les variables, sans en lire le contenu) retourne également `requires approval`. Ce réveil n'a donc ni `gh`, ni la possibilité de lire `GITHUB_TOKEN` pour appeler l'API REST directement par une autre voie (`curl`) — ce qui aurait été un contournement de la même gate, pas une capacité différente, et n'a donc pas été tenté.
5. Recherche d'un outil existant du dépôt qui ouvrirait une PR par l'API sans passer par le binaire `gh` : aucun (`outils/` ne contient aucun script de ce type ; seuls deux fichiers mentionnent `pull-requests`, tous deux des candidats de workflow pour `claude.yml`, non exécutés par ce réveil).
6. Aucune action supplémentaire : aucun fichier hors de `docs/handoff/` n'a été touché, aucun commit de travail n'existe sur le rail pour ce lot dans ce réveil.

## Ce qui bloque

decision-2.md affirme que « github-actions-claude détient déjà la capacité `CANAL_PUBLICATION` » et que cela suffit à ouvrir la PR sans nouvel arbitrage. Mais `docs/handoff/CAPACITES-CANAL.json` définit `CANAL_PUBLICATION` comme « Publier un corps de réveil ou une décision sur le canal de transport déclaré » — c'est la capacité qui dépose des fichiers Handoff (ce que ce réveil fait), pas celle d'appeler l'API `pulls` de GitHub. Aucune des neuf capacités nommées dans ce fichier ne couvre l'ouverture d'une PR. Ce fichier distingue explicitement une « capacité déclarée » (une opinion) d'une « capacité exercée » (un fait) ; ici, la capacité d'ouvrir une PR n'a jamais été exercée avec succès par ce canal, et cette mesure-ci la trouve encore absente, à l'identique de request-2.

Ce n'est donc pas un refus de ma part ni une relecture différente de decision-2 : c'est la même capacité absente que request-2 avait déjà rapportée, mesurée une seconde fois, dans un réveil différent, avec le même résultat. Je ne contourne rien (pas de `curl` pour remplacer `gh`, pas de lecture détournée d'un secret) et je ne m'arbitre pas moi-même sur la question de fond (le contenu et la portée de la PR restent ceux que decision-2 a approuvés).

## Preuve des conditions de decision-2

- *Ouvrir uniquement une PR brouillon de `gov-r4-vigie-main-20261020` vers `main`* — NOT_APPLICABLE : aucune PR n'a pu être ouverte, faute de capacité d'exécution (`gh`/API bloqués par `This command requires approval`, aucune approbation humaine disponible dans ce réveil). Rien n'a donc été ouvert, ni conforme ni non conforme à cette condition.
- *Diff limité à `.github/workflows/vigie-cloture.yml` identique au blob `f396f2a7`* — VERIFIED, inchangé depuis request-2 : `git diff f396f2a7 origin/gov-r4-vigie-main-20261020 -- .github/workflows/vigie-cloture.yml` reste vide ; aucun commit supplémentaire n'a été poussé sur cette branche par ce réveil.
- *Ne pas activer l'auto-merge et ne pas fusionner* — VERIFIED : aucune PR n'existant pas, ni auto-merge ni fusion n'ont pu avoir lieu.
- *Rapporter toute CI rouge avant toute demande de fusion* — NOT_APPLICABLE : aucune PR, donc aucune CI de PR déclenchée à ce stade.

## Demande

1. Dire qui, concrètement, peut exécuter `gh pr create` (ou l'appel API équivalent) sur la branche déjà poussée `gov-r4-vigie-main-20261020` : si c'est Frédéric ou une session avec approbation interactive, nommer ce canal explicitement plutôt que `github-actions-claude`, dont la capacité réelle (par opposition à déclarée) reste mesurée absente dans ce type de réveil.
2. Si l'intention reste que ce soit un réveil autonome comme celui-ci qui ouvre la PR, dire quelle pré-autorisation ou quel câblage CI (distinct de `CANAL_PUBLICATION`, qui ne couvre pas ce geste d'après sa propre définition dans `CAPACITES-CANAL.json`) rendrait ce geste exécutable sans approbation humaine absente.
3. Aucune action supplémentaire n'est prise par ce réveil sur ce lot avant une réponse.
