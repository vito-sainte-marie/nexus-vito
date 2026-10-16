---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONSIGNATION-FUSION-LOTC-20261016
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
wake_to: ChatGPT
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
  - id: merge-fusion-133
    classe: VERIFIED
    valeur: 3a014991eb19bd228af4d74cf5ea1a64a1bcda1b
  - id: deploiement-pages
    classe: VERIFIED
    valeur: run 38963505885 success
---
# Consignation — fusion de #133 et déploiement Production du 16/10/2026 (lot C, « Dernier poste »)

Auteur : Claude. Cette demande **consigne des faits déjà accomplis** ; elle ne demande aucune autorisation de geste Production et n'en donne aucune.

## Pourquoi un lot distinct

Le lot `NEXUS-CONSIGNATION-MIGRATION-LOTC-20261016` est clos (decision-1 APPROVED, `closes: true`, consommée) : on n'y ajoute rien. Il consignait la migration seule ; ce lot consigne la suite prévue par l'ordre du dossier de promotion (`docs/deploiement/promotion-dernier-poste-production-20261016.md` §3, étape 4).

## Faits

- Autorisations de Frédéric en session, le 16/10/2026 : « si ok go fusion » (conditionnée à une CI verte du rail sur `346e80fd`), puis « si fusion go deploiement et active l'auto merge ».
- Condition remplie avant la fusion : CI du rail verte sur `346e80fd` (run « Tests » 38963038283, `non-regression` réussi).
- Fusion : PR #133 fusionnée dans `production` le 2026-10-16T20:36:48Z, commit de fusion `3a014991eb19bd228af4d74cf5ea1a64a1bcda1b`, méthode merge commit, avec `--match-head-commit faa0a9d9dee5a496c1b3e2c5a7b7fceab99defcc` (état `CLEAN`, tous les contrôles passés). `production` passe de `d4c271fe` à `3a014991`.
- Auto-merge : **non activé**. Demandé par Frédéric, mais sans objet : la PR était déjà `CLEAN` avec tous les contrôles passés, donc fusionnée directement.
- Déploiement : le push sur `production` a lancé « Déploiement Production (GitHub Pages) » (run 38963505885). Le job « Construire et éprouver l'artefact » est passé ; « Déployer sur GitHub Pages » attendait l'approbation de l'environnement `github-pages`. Cette approbation a été donnée par Claude, avec le GO de déploiement de Frédéric en commentaire. Run terminé en succès à 20:46:54Z. Le run « Tests » (38963506025) du même commit est réussi.
- Contrôle du contenu servi (lecture seule) : `https://app.nexusconseil.net/NEXUS-Prise-De-Poste-v1.html` répond 200 et contient « Dernier poste » et `dernier_poste`. La page servie diffère du fichier du dépôt par la réécriture des balises `<script>` faite au déploiement ; elle n'a pas été comparée ligne à ligne au-delà de ce point.
- Ordre respecté : migration (consignée dans le lot précédent) avant le code.

## Ce que ce dépôt ne dit pas

- La recette navigateur humaine du site réel n'est pas faite : cas < 5 prises (« Dernier poste »), cas « dominant » du lot B, changement de quart.
- La preuve de l'empreinte de l'artefact servi n'a pas été mesurée au-delà du contrôle ci-dessus.
- Le registre de migrations de Production n'a pas été relu après le déploiement.
- Aucune autre autorisation de fusion, déploiement ou mutation Production n'existe.

## Question posée

Prendre acte de cette consignation et clore le lot (`closes: true`). Aucun geste Production n'est demandé.
