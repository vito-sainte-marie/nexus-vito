---
protocol: nexus-handoff/2
kind: request
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=55285d8b production=3a014991
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 154-fichiers
---
# FAST TRACK — Parcours Pompiste : brief intégral manquant, condition de decision-1 non prouvée

Auteur : Claude, réveil CI sur le rail `handoff-continuite-20260920`. decision-1.md
(APPROVED_WITH_CONDITIONS) a été pris en charge (`consommer --prise-en-charge`,
commit `c2110b71`). Cette demande dépose l'arrêt : aucune implémentation n'a été
écrite, et cette demande consomme decision-1 par la voie « arrêt » du protocole
de consommation en deux temps (PROTOCOL.md, INC-20261015-001).

## Preuve des conditions de decision-1

Les six conditions de `CONDITIONS` (decision-1.md) sont reprises une à une.

1. **« Développement, déploiement et recette limités à Test sur branche dédiée,
   sans main ni Production »** — classe NOT_APPLICABLE. Rien n'a été développé,
   déployé ni recetté dans ce tour : aucun commit hors `docs/handoff/` n'existe
   sur ce rail depuis `decision-1.md`. La condition n'est donc pas violée, faute
   d'action à juger.
2. **« ne pas inventer les éléments absents du brief »** — classe VERIFIED.
   Aucun élément du brief n'a été inventé : ce dépôt se limite à constater
   l'absence, pas à la combler par hypothèse.
3. **« disposer du brief intégral avant toute implémentation dépendant de la
   persistance, d'une migration, de l'intégration finale ou des critères de
   recette »** — classe VERIFIED, et NON PROUVÉE au sens où elle bloque :
   `request-1.md` constatait déjà que « le brief reçu est tronqué… s'arrête en
   plein milieu, à "L'interface doit être : – Élégante, contemporaine" ».
   Recherche faite dans ce tour : aucun fichier du dépôt, aucun commit depuis
   `67b85dfd` (HEAD de request-1) ne porte la suite du brief — recherche
   `grep -r pompiste` sur `docs/`, `supabase/migrations`, et lecture de
   `git log --all --since=2026-10-15` : rien de nouveau sur le sujet hors les
   échanges Handoff déjà connus. La suite du brief (critères d'interface
   restants, persistance, intégration, critères de recette, interdits) reste
   donc absente. Or presque toute implémentation utile ici — stockage des
   relevés, intégration au parcours de prise/fin de poste, critères de recette —
   dépend explicitement d'une de ces quatre choses. Cette condition est la
   porte : tant qu'elle n'est pas remplie, aucune des trois suivantes n'est
   atteignable.
4. **« toute migration éventuelle est Test uniquement et respecte site_id, RLS
   et l'isolation multisite »** — classe NOT_APPLICABLE. Aucune migration
   n'a été écrite (condition 3 non remplie) : rien à vérifier.
5. **« conserver l'index physique à sept chiffres et rendre toute présentation
   à six chiffres explicite sans troncature aveugle »** — classe NOT_APPLICABLE.
   Aucune implémentation d'affichage n'existe encore.
6. **« présenter 1191213 comme référence GNR historique et non comme relevé
   employé »** — classe NOT_APPLICABLE. Même raison que 5.

## Ce qui bloque

La condition 3 est une gate déclarée par l'arbitre lui-même, pas une gate
humaine au sens de `PROTOCOL.md`, mais elle a le même effet pratique :
sans le reste du brief de Frédéric, implémenter quoi que ce soit de substantiel
reviendrait soit à inventer (interdit par condition 2), soit à bâtir sur une
persistance ou une intégration que personne n'a validée. Ce dépôt ne contourne
pas la condition : il consigne l'arrêt et redemande le texte manquant.

## Demande

Le texte intégral du brief de Frédéric au-delà de « L'interface doit être :
– Élégante, contemporaine » — en particulier les critères d'interface
restants, le modèle de persistance envisagé (ou son absence), les règles
d'intégration finale au parcours de prise de poste / fin de quart existant,
les critères de recette attendus, et les interdits qui suivaient dans le
brief original.

Ce lot reste ouvert (`closes: false`) : le développement reprendra dès
réception du brief complet, sans qu'aucune nouvelle décision d'arbitrage ne
soit requise sur le principe déjà tranché par decision-1 (GO Test).
