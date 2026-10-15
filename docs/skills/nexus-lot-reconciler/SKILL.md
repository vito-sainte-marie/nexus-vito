---
name: nexus-lot-reconciler
description: Audit et réconciliation du portefeuille des lots NEXUS (Handoff nexus-handoff/2, dépôt vito-sainte-marie/nexus-vito). À utiliser pour dresser le registre réel des lots, confronter statut déclaré et statut prouvé, repérer lots fantômes, doublons, remplacés, bloqués, orphelins ou clos à tort, et préparer un plan de nettoyage soumis à arbitrage. Déclencher sur « audit des lots », « réconciliation », « portefeuille », « quels lots sont vraiment finis », « nettoyer les lots / branches / PR », « état du Handoff », après la clôture d'un lot, lors du contrôle hebdomadaire ou avant une promotion Production. Lecture seule par défaut ; ne clôt, ne fusionne et ne supprime jamais rien de lui-même.
---

# NEXUS Lot Reconciler

## Règle de fonctionnement

nexus-lot-reconciler est un observateur non bloquant du cycle de développement NEXUS. Il intervient après les événements de validation ou lors des contrôles périodiques. Il ne modifie jamais le statut d'un lot actif, n'interrompt aucune exécution Handoff et n'ajoute aucune condition de passage aux workflows existants. Toute opération de nettoyage est différée jusqu'à stabilisation des objets concernés et autorisation conforme au protocole.

Principe : un lot ne reste pas ouvert parce que personne n'a actualisé son statut, et il ne devient pas terminé parce qu'un exécutant affirme avoir fini. Le skill cherche les preuves avant de conclure.

## Ce que le skill ne fait jamais

- Fermer une issue ou une PR, fusionner, supprimer une branche ou un fichier, modifier `STATE.json`, un manifeste, une migration ou un workflow, écrire dans Supabase, déployer. Ces gestes passent par l'autorisation décrite dans `references/autorisations.md`.
- Acquérir un verrou, réserver le rail ou faire attendre Claude. L'audit lit pendant que Claude développe.
- Proposer quoi que ce soit sur un lot en exécution Handoff (`lot_actif` ou demande en vol).
- Créer un lot Handoff pour chaque anomalie. Un incident est transmis au skill `nexus-incidents`, selon son contrat.
- Ajouter un déclencheur GitHub Actions ou un contrôle bloquant dans la CI.
- Fermer l'issue #28 (canal déclaré dans `docs/handoff/CANAUX.json`) ou fusionner la PR #30 (marquée « canal relais permanent, NE PAS FUSIONNER ») sans décision de Frédéric.
- Interpréter `CLOSES:true` comme une autorisation de fermeture GitHub.
- Déclarer NEXUS « propre » si une divergence non résolue subsiste.

## Quand l'utiliser

| Déclencheur | Mode | Effet sur Claude |
| --- | --- | --- |
| Après la clôture effective d'un lot | `audit-domain` ciblé sur ce lot et ses dépendances | aucun |
| Chaque lundi, après le rapport agents de 6 h | `audit-since <date du dernier audit>` | lecture seule |
| Avant une promotion Production | audit des lots candidats | rapport consultatif, jamais un GO |

Pas d'audit après chaque commit, commentaire ou réveil. Phase actuelle : **observation** (lectures et rapports seulement, aucun déclenchement automatique). La phase 2 (réconciliation périodique) puis la phase 3 (nettoyage assisté) s'ouvrent sur décision de Frédéric.

## Où l'exécuter

Le canal décide de ce qui est prouvable (`docs/handoff/CAPACITES-CANAL.json`) :

- **Session Claude avec API GitHub et connecteur Supabase en lecture** : tous les modes.
- **Claude de GitHub (`github-actions-claude`)** : pas de Supabase, pas de détail des runs. Seul `audit-handoff` y est complet ; les autres sources y restent au niveau D.

Une source inaccessible donne le niveau D. Elle n'est jamais déduite.

## Modes

- `audit-handoff` : chaîne Demande → Arbitrage → Exécutant → Exécution → Preuves → Validation → Clôture, sur le rail.
- `audit-all` : registre complet. Commencer par le registre brut, puis un domaine à la fois.
- `audit-domain <domaine>` : un module métier (Carburants, FDJ, Paye, Inventaire, Pointage…) ou un lot.
- `audit-since <date>` : changements depuis une date, comparés au registre précédent.
- `propose-cleanup` : plan de nettoyage, chaque action avec son autorité.
- `apply-approved-cleanup` : uniquement les actions autorisées une par une ; revérifier l'objet juste avant l'écriture (`verifierAvantEcriture`) et suspendre en cas d'écart.
- `verify-cleanup` : contrôle après nettoyage.

## Méthode

1. **Valider les références.** Branche canonique du rail (lire `docs/handoff/AUTORITES-DE-BRANCHE.json` et `STATE.json`, ne jamais supposer), têtes de `main`, `production` et du rail, canal #28. Noter les SHA : chaque verdict porte le SHA auquel il a été établi.
2. **Prendre un instantané GitHub en lecture** : PR (toutes, avec branche de tête et base), branches, et pour chaque branche sans PR fusionnée, la comparaison avec le rail, `production` et `main` (`GET repos/{o}/{r}/compare/{base}...{branche}` : `behind` ou `identical` = déjà intégrée). Format dans `references/sources.md`.
3. **Lancer le script** (lecture seule, sortie hors du dépôt) :

   ```
   node scripts/reconcilier.js audit-handoff --depot <clone> --rail origin/<rail> --github <instantane.json> --sortie <dossier>
   ```

   Il lit le rail au SHA par `git cat-file`, apparie chaque décision à sa demande par `in_reply_to` (les numéros ne correspondent pas), date chaque fichier, et n'applique une règle qu'aux fichiers postérieurs à son entrée en vigueur (`REGLES_DATEES`).
4. **Vérifier à la main chaque anomalie « à traiter »** sur le fichier source avant de la rapporter. Le script trie ; il ne conclut pas.
5. **Qualifier** chaque lot : statut déclaré, statut constaté, niveau de preuve (`references/statuts-et-preuves.md`), urgence U0 à U3.
6. **Rapprocher** : un préfixe commun ou une PR partagée est un indice, jamais une preuve. Un remplacement n'est proposé que si tous les critères de l'ancien lot sont couverts au niveau A (`evaluerRemplacement`).
7. **Rédiger le rapport** au format ci-dessous, puis transmettre les incidents à `nexus-incidents`.

## Urgence

- **U0** : défaut qui empêche une opération autorisée, rupture de sécurité, risque de corruption de données, mécanisme indispensable en panne.
- **U1** : fonction métier à finaliser (calculs financiers, paie, inventaires, validations, opérations courantes).
- **U2** : amélioration planifiable.
- **U3** : dette documentaire ou nettoyage différable.

L'ancienneté seule ne donne jamais U0. (U et non P, pour ne pas confondre avec les mesures P1 à P8 du lot de réparation.)

## Rapport

Titre : `NEXUS : AUDIT ET RÉCONCILIATION DES LOTS`, daté, avec les SHA audités.

1. **Synthèse** : lots recensés, réellement actifs, terminés mais ouverts, partiels, bloqués, doublons, remplacés, obsolètes, inconnus.
2. **Registre** : `| ID | Objectif | État déclaré | État constaté | Urgence | Preuves | Action proposée |`, chaque preuve citée (fichier, commit, PR, run).
3. **Nettoyage proposé** : objet, motif, preuves, conséquences, dépendances, risque, action exacte, autorité requise.
4. **Plan d'exécution**, par dépendance : corrections qui débloquent, clôtures justifiées, rapprochements documentaires, nettoyages différés, décisions humaines.
5. **Synthèse factuelle** : prouvé, incertain, nettoyable après autorisation, à garder ouvert, prochaine action recommandée.

Écrire selon le protocole de Frédéric : faits, identifiants, phrases courtes, aucun tiret cadratin, aucune formule rassurante.

## Fichiers

Le skill complet vit dans le dépôt, sous `docs/skills/nexus-lot-reconciler/` (une fois déposé sur le rail). Si `scripts/` ou `references/` manquent à côté de ce fichier, les lire depuis ce dossier du dépôt, au SHA du rail.

- `scripts/reconcilier.js` : script de contrôle déterministe, lecture seule ; fonctions pures exportées.
- `tests/recette.js` : les 12 scénarios du cahier des charges et 3 contrôles complémentaires (`node tests/recette.js`).
- `references/statuts-et-preuves.md` : statuts constatés, niveaux de preuve, codes d'anomalie.
- `references/autorisations.md` : qui autorise quel geste.
- `references/sources.md` : sources, canaux, format de l'instantané GitHub, limites connues.
