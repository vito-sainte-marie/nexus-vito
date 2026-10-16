---
protocol: nexus-handoff/2
kind: request
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 4
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
  - id: brief-rail
    classe: VERIFIED
    valeur: brief-integral.md@5e0ee849
  - id: audit
    classe: VERIFIED
    valeur: audit-initial.md
---
# FAST TRACK — Parcours Pompiste : brief intégral déposé, levée de la condition 3 demandée

Auteur : Claude. Le blocage de request-3 (BLOCKER « brief intégral manquant », OWNER_NEXT Frédéric,
ACTION_NEXT « publier le brief sur l'issue #28 ») est levé par l'action demandée, faite le 16/10/2026 :

- brief intégral (17,5 Ko, de « # NEXUS — GO TEST » jusqu'à la livraison attendue) déposé sur le rail :
  `docs/handoff/lots/FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016/brief-integral.md` (commit 5e0ee849) ;
- le même texte posté sur l'issue #28 (commentaire 6226761259).
Aucun texte n'est ici paraphrasé : le brief fait foi.

## Ce que cette demande apporte
1. **Condition 3 de decision-1 satisfaite** : le brief intégral est lisible sur le rail (persistance,
   intégration au parcours, critères de recette — 20 scénarios —, interdits).
2. **Livrable A (audit initial)** déposé : `audit-initial.md` dans le même dossier (état réel, composants
   réutilisables, écarts, risques de régression, 7 décisions techniques).
3. **Plan d'exécution Test seulement** : branche dédiée issue de la lignée rail
   `pompiste-releves-piste-test-20261016`, aucune PR vers `main`/`production` ; migration Test-only
   (tables `carburant_index_releves`, `carburant_index_valeurs`, historique append-only), présentée
   explicitement avant application ; tests automatisés ; déploiement alias Test ; recette navigateur mobile
   (Safari iOS = NON TESTÉ si indisponible) ; livrables C, D, E.

## Arbitrages métier restants (non bloquants pour démarrer sur Test ; valeurs provisoires déclarées)
1. Seuil de 4000 L : constante paramétrable, indicative, non bloquante.
2. Qui régularise un désaccord Q1/Q2 : lecture seule des deux valeurs et auteurs ; régularisation réservée aux managers.
3. Durée de conservation des photos et brouillons : à définir.
4. OCR : traitement différé via le worker local existant (gratuit), saisie manuelle toujours possible.
5. Remise en service du GNR : hors périmètre de ce lot.
6. Quart sans Q2 : la déclaration reste « fin Q1 » seule.

## Demande
Lever la condition 3 de decision-1 et confirmer l'autorisation de développer sur Test dans ce périmètre.
Hors périmètre, non demandé : fusion vers `main`, déploiement ou migration Production, données réelles,
OCR payant. Ce lot reste ouvert (`closes: false`).
