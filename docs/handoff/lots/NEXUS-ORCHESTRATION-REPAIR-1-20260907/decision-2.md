---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-ORCHESTRATION-REPAIR-1-20260907
seq: 2
author: NEXUS Orchestrator
branch: config-par-environnement
decision: REJECTED
closes: true
in_reply_to: request-2.md
---

# Décision — REPAIR-1 clos comme tentative incomplète, sans faux succès

## Verdict

`request-2.md` apporte des preuves utiles, mais ne satisfait pas les conditions obligatoires de `decision-1.md`. Le lot ne peut donc pas être déclaré réparé.

Vérification directe du HEAD canonique `config-par-environnement` au 07/09/2026 :

- `outils/guardians-router.js` : **absent** du canon ;
- `outils/verifier-apprentissage.js` : **absent** du canon ;
- `.github/workflows/tests.yml` : **ne déclenche pas** ces deux contrôles ;
- le `request-2.md` reconnaît lui-même que le rapatriement sur `config-par-environnement`, le câblage CI et la régression sur l'arbre canonique complet n'ont pas été réalisés.

Les preuves ciblées 9/9 + 9/9 et la mutation négative sont acceptées comme preuves de valeur du delta sur la branche Claude, mais **ne valent pas intégration canonique**.

## Pourquoi `closes: true`

Le lot est fermé comme **tentative incomplète / non intégrée**, et non comme succès. Le laisser `ATTENTE_DECISION` bloque aujourd'hui le protocole à lot actif unique et empêche la publication, par `outils/handoff.js`, du retour Carburants déjà préparé et versionné sous `docs/handoff/en-attente/`.

Le fermer ne supprime aucune dette et ne requalifie aucun travail en `TERMINE`. Cela sépare proprement :

1. l'arbitrage du rapport REPAIR-1 historique ;
2. la poursuite Carburants actuellement prête ;
3. un futur lot d'orchestration dédié pour intégrer réellement les Guardians/apprentissage et automatiser la recette navigateur Test.

## Ce qui est conservé

Le travail suivant reste une **source de delta candidate**, pas une version active :

- `outils/guardians-router.js` ;
- `outils/verifier-apprentissage.js` ;
- `outils/recette-navigateur-test.js` ;
- `test_guardians_router_20260907.js` ;
- `test_verifier_apprentissage_20260907.js` ;
- snippet de câblage CI documenté dans `request-2.md`.

Lors du futur lot, repartir du HEAD canonique courant et comparer fichier par fichier. Aucun cherry-pick/merge aveugle.

## Dette à reprendre dans un futur lot d'orchestration

Critères de sortie obligatoires :

1. outils Guardians/apprentissage présents sur `config-par-environnement` ;
2. tests ciblés verts sur ce HEAD ;
3. mutation négative rouge puis restauration verte ;
4. `.github/workflows/tests.yml` de la branche canonique exécute réellement les contrôles ;
5. régression complète sur l'arbre canonique sans nouvel échec ;
6. recette navigateur Test automatisée seulement si les secrets Test sont injectés via un mécanisme sûr ;
7. aucun secret/PIN/service_role dans dépôt ou logs ;
8. aucun accès Production.

## Suite immédiate autorisée

Aucun nouveau travail de code n'est demandé à Claude pour REPAIR-1.

Claude peut uniquement :

1. consommer cette `decision-2.md` via le protocole Handoff afin de fermer proprement REPAIR-1 ;
2. une fois le verrou libéré, publier **par `outils/handoff.js demande`**, sans réécriture manuelle, le fichier déjà préparé `docs/handoff/en-attente/CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906-request-4.md` ;
3. revenir ensuite à l'arbitrage Carburants.

## Invariants

- aucun changement `main` ;
- aucun changement `production` ;
- aucun Supabase Production / NEXUS Production ;
- aucune exposition de secret ;
- aucun fichier applicatif modifié par cette décision ;
- ne pas déplacer/copier manuellement le `request-4` depuis `en-attente` vers `lots/` : la publication doit passer par l'outil Handoff.

**REJECTED, closes: true** signifie ici : REPAIR-1 n'est pas validé comme réparation réussie, mais son cycle est clos proprement pour éviter qu'un lot incomplet ne bloque indéfiniment le registre.