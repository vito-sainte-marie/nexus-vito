# Borner la durée d'un run Claude — `.github/workflows/claude.yml` sur `main`

**À appliquer par Frédéric sur `main`.** Je n'ai pas de chemin d'écriture vers
`main` : la fiche est le véhicule, exactement comme
`outils/reveil-refus-audible-claude-yml-a-appliquer-sur-main.md`.

## Le défaut mesuré

Mesuré le 03/10/2026 à 12:41 UTC pendant l'audit de la boucle Handoff demandé
par Frédéric (issue 28, commentaire `5968733390`).

`claude.yml` **ne porte ni `timeout-minutes` ni `concurrency`** :

    git show origin/main:.github/workflows/claude.yml | grep -n 'timeout\|concurrency'
    (aucune sortie)

Conséquences, dans l'ordre de gravité :

1. **Un run qui ne conclut pas occupe la limite GitHub par défaut, 360 minutes.**
   Enveloppe réelle des dix derniers runs `claude.yml` non `skipped` :
   2, 7, 7, 7, 11, 13, 15, 17 minutes (et deux échecs à 0). Le run
   `37119851536`, déclenché par la demande de 11:30:04 UTC, était à
   **71 minutes dans l'étape 6** (`anthropics/claude-code-action`) au moment de
   la mesure, sans branche `claude/issue-28-20261003*` créée, et avec un
   `updatedAt` de run figé à 11:30:11 UTC. Les étapes 1 à 5 sont `success`,
   dont « Résoudre le rail NEXUS désigné » : **la désignation du rail a
   fonctionné**, c'est l'action elle-même qui ne rend pas la main.
2. **Rien ne distingue « Claude travaille » de « le run est coincé ».**
   `node outils/handoff.js veiller <LOT_ID>` répond déjà correctement
   (« relance humaine (secours v1) requise après extinction ») — mais
   *après extinction*. Sans borne de durée, l'extinction peut arriver six
   heures plus tard, et pendant ce temps l'état est muet. C'est la forme déjà
   rencontrée d'un état qui refuse de conclure et ne rougit donc jamais.
3. **Deux demandes rapprochées lancent deux runs concurrents.** Le `skipped`
   observé sur le run jumeau (`37119866929`) vient du filtre d'auteur et de
   contenu de `claude.yml`, pas d'un `concurrency` — il n'y en a pas.

## Le correctif

Une seule ligne, au niveau du job, juste après `runs-on` (ligne 71 de la
version mesurée) :

```yaml
jobs:
  claude:
    if: >-
      …
    runs-on: ubuntu-latest
    timeout-minutes: 45
```

45 minutes : près de trois fois le plus long run réussi récent (17 min), et
huit fois moins que les 360 minutes par défaut. Un run qui dépasse échoue
visiblement au lieu de dormir, et l'étape « Rendre le refus de rail audible »
reste intacte.

## Ce que ce correctif n'est pas

- Ce n'est **pas** la réparation de la boucle Handoff. Le transport
  Claude → rail est armé et prouvé (`NEXUS_RAPATRIEMENT_ARME: oui`, et la
  ligne `[EXECUTE] rapatriement-claude-vers-rail (TRANSPORTE)` du journal du
  run 37059253822). Le blocage réel est l'**arbitrage** : le lot
  `NEXUS-CONTINUITE-TERRAIN-2-20260922` porte `request-1` … `request-20` et
  seulement `decision-1` … `decision-10`, statut `ATTENTE_DECISION`, dernière
  décision consommée le 2026-09-24T13:52:56Z.
- Ce n'est **pas** un élargissement de surface de sécurité : aucune
  permission, aucun jeton, aucun secret n'est touché. La borne **réduit** la
  fenêtre pendant laquelle un run détient `contents: write`.
- Je n'ajoute **pas** `concurrency` dans la même fiche : annuler un run en vol
  détruirait du travail non rapatrié, et la décision d'arbitrer entre deux
  demandes rapprochées appartient à Frédéric, pas à une règle implicite.
