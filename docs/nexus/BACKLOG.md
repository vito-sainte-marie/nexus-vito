# NEXUS — Backlog canonique

Ce fichier est la mémoire durable des observations terrain, anomalies, besoins et évolutions futures. Il ne remplace pas le Handoff : il alimente les futurs lots.

## États

- `TERRAIN` : observation réelle non encore arbitrée.
- `A_ETUDIER` : besoin compris, solution à définir ou dépendances à analyser.
- `PRET_POUR_DEV` : périmètre et critères d'acceptation suffisamment définis pour ouvrir un lot.
- `TERMINE` : correction validée avec preuve.

## Priorité immédiate — continuité et sécurité

| ID | État | Priorité | Sujet | Critère de sortie |
|---|---|---:|---|---|
| CONT-001 | PRET_POUR_DEV | P0 | Continuité NEXUS indépendante des conversations/sessions | Reprise possible depuis dépôt canonique uniquement |
| SEC-001 | PRET_POUR_DEV | P0 | Fermer `est_pompiste_du_jour` timezone + `en_cours` et les 7 policies dépendantes | Preuves comportementales Test vertes, registre aide conforme |
| ARCH-001 | A_ETUDIER | P0 | Terminer isolation multisite/site explicite | Aucun chemin actif ne peut dériver silencieusement un site ou croiser les données clients |
| SHIFT-001 | A_ETUDIER | P0 | Lifecycle des prises de poste et clôture des services | Un service courant est unique, borné et clôturé selon contrat métier |

## Observations terrain à traiter

| ID | État | Priorité | Module | Observation / besoin | Critère d'acceptation initial |
|---|---|---:|---|---|---|
| INV-001 | TERRAIN | P0 | Inventaire | Passage mode test → inventaire réel peu clair | L'utilisateur sait sans ambiguïté s'il est en test ou en réel |
| INV-002 | TERRAIN | P0 | Inventaire | Cigarettes : caisse gérée par l'employé, bureau réservé manager | La caissière ne voit ni ne gère le stock bureau |
| INV-003 | TERRAIN | P1 | Inventaire | Libellés « stock par emplacement » / « transfert interne » peu cohérents avec la signature NEXUS | Vocabulaire simple, métier et contextualisé |
| PAYE-001 | TERRAIN | P0 | PAYE / Absences | Vanessa en congé maternité nécessite plusieurs lignes | Une absence longue se saisit sur une période du/au en une action |
| PAYE-002 | TERRAIN | P1 | PAYE | Besoin d'actions de date à date | Sélection de période disponible pour les opérations concernées |
| PAYE-003 | TERRAIN | P1 | PAYE | Les écarts Verify doivent remonter clairement dans NEXUS PAYE | Variables visibles avec source et statut d'arbitrage |
| CARB-001 | TERRAIN | P0 | Carburants Performance | Après livraison, une estimation ancienne comme « mardi Q2 » peut rester affichée | Projection recalculée avec livraison effectuée ou attendue explicitement distinguée |
| CARB-002 | TERRAIN | P0 | Carburants Performance | Couverture doit être lisible en jour/semaine/quart plutôt qu'en jours décimaux | Affichage métier cohérent sur tous les écrans concernés |
| CARB-003 | TERRAIN | P1 | Carburants / Verify | Les états contrôle caisse / jaugeage doivent rester visibles et cohérents | Bandeaux et liens Verify présents selon état réel |
| EMP-001 | TERRAIN | P0 | Employés / Shift | Prise de poste doit être séparée par date/quart/site | Aucun service d'un autre quart/site/date ne peut être réutilisé par erreur |
| EMP-002 | TERRAIN | P0 | Employés / Shift | Services historiques restent `en_cours` faute de clôture fiable | Mécanisme de clôture conforme au lifecycle validé |

## Règle d'entrée

Toute nouvelle observation terrain importante de Frédéric doit être ajoutée ici avant d'être considérée comme durablement capturée.

## Règle de sortie

Un item ne passe à `TERMINE` que si :

1. la correction est intégrée sur le rail autorisé ;
2. les tests/recettes nécessaires sont passés ;
3. la preuve est enregistrée ;
4. aucun invariant NEXUS n'a été cassé ;
5. lorsqu'une validation terrain est nécessaire, Frédéric l'a confirmée.