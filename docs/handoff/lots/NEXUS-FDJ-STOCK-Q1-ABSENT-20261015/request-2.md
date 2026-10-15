---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-FDJ-STOCK-Q1-ABSENT-20261015
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=50c634a8
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: constat-recette-test
    classe: VERIFIED
    valeur: recette A-F sur Test udljdqxerrbbbajxubfn via connecteur, annulee, Test propre
---
# Request 2 — implémentation de la reconstitution du stock de chaîne et recette sur Test

Réponse aux conditions 1 à 8 de decision-1 (APPROVED_WITH_CONDITIONS, closes: false). Le lot reste ouvert.

## Écart de base à déclarer
La branche d'implémentation `fdj-quart-absent-reconstitution-20261015` part de `origin/production`, pas du rail : le rail ne porte pas les migrations de continuité FDJ déjà déployées en Production. Rien n'est poussé sur `production` ni `main`.

## Livré (non poussé, commit 18dbc606 sur la branche d'implémentation)
Migration `20261015100000_fdj_stock_chaine_reconstitue_quart_absent.sql` :
- table dédiée `fdj_stock_chaine_reconstitue` (provenance, quart source, valeur reconstituée, comptage réel conservé à côté, statut, horodatage, auteur) — condition 1 ;
- colonne `site` (les tables FDJ de Production n'ont pas de `site_id`), RLS en lecture limitée au site, aucune policy d'écriture, aucun élargissement de droits — condition 2 ;
- aucune ligne dans `fdj_shifts`, `fdj_shift_counts`, caisse, ventes, réceptions, présences, clôtures — condition 3 ;
- jeux attendus lus en base (jeux actifs du site), aucun nombre en dur — condition 4 ;
- garde : `ouverture_validee` et tous les stocks initiaux attendus non NULL — condition 5 ;
- comptage réel conservé, valeur reconstituée conservée, statut `en_conflit` et écart signalé — condition 6 ;
- fonction `fdj_reconstituer_quart_absent(uuid)` en security definer, audit dans `fdj_audit_log`.

## Recette sur Test (condition 7)
Appliquée sur Test via le connecteur (le host direct a expiré le 15/10 ; le pooler reste interdit), puis annulée : Test est propre.
- A — quart absent, source complète et confirmée : 29 valeurs créées, 29 lignes d'audit.
- B — quart suivant incomplet : refus `comptage_initial_incomplet`, rien d'écrit.
- C — ouverture non confirmée : refus `ouverture_non_confirmee`, rien d'écrit.
- D — comptage réel contradictoire : les deux valeurs conservées, statut `en_conflit`, écart renseigné.
- E — isolation : shift d'un autre site refusé.
- F — idempotence : second appel sans doublon.

## Limites déclarées
- Isolation prouvée par le refus d'un shift d'un autre site ; un seul site a des managers sur Test, le select RLS sous une seconde session n'est pas testé.
- Transport par le connecteur, pas par psql.
- Le commentaire de fonction a été omis sur la copie Test (écart mineur).
- Le contrôle de date de la vérification A était erroné dans mon essai (mauvaise date) ; à corriger dans la recette versionnée.

## Restant, avant toute demande de promotion
Écrans employé et manager (bandeau « Quart 1 non effectué — stock de chaîne reconstitué à partir du quart 2 », distinction visuelle reconstitué/physique, absence opérationnelle séparée), fonctions moteur et épreuves avec mutations, recette SQL versionnée, entrée nexus-incidents. Les épreuves de manifeste et d'empreinte rougiront à l'ajout de la migration : attendu.

## Demande
Valider cette suite (écrans, moteur, recette versionnée). Aucune action sur Production, `main` ou `production` n'est demandée ; migration, fusion, déploiement et écriture du Q1 du 14/10 exigeront chacun un GO distinct de Frédéric.

## Statut de decision-1 (vérité du registre)
`decision-1` est déjà consommée (`ff3e7720`) mais elle l'a été sans exécution : le run de réveil 38667953549 l'a consommée sans rien exécuter (permissions refusées, aucune demande bloquante déposée). Les conditions 1 à 8 n'ont donc été exécutées qu'ici, par cette session Claude, et la preuve est ci-dessous. Cette demande ne rouvre pas decision-1 ; elle en apporte l'exécution.

## Preuve des conditions de decision-1
Condition par condition, avec la source de la preuve (migration 18dbc606, recette Test A–F ci-dessus) :
1. Table dédiée et provenance auditée : `fdj_stock_chaine_reconstitue` + lignes `fdj_audit_log` (29 pour 29 valeurs en recette A).
2. Isolation multisite : colonne `site`, policy select sur `current_employee_site_id()`, aucune policy d'écriture, `revoke all` puis `grant select` seul ; recette E (shift d'un autre site refusé). Limite : select RLS sous seconde session non testé.
3. Aucun enregistrement fictif : la fonction n'écrit que dans la table dédiée et `fdj_audit_log` (lecture du code, recette A).
4. Jeux attendus lus en base : comptage des `fdj_games` actifs du site, aucun 29 en dur.
5. Garde d'ouverture et de complétude : recettes B (incomplet) et C (non confirmé), toutes deux refusées sans écriture.
6. Comptage réel prioritaire sans effacer : recette D, deux valeurs conservées, `en_conflit`, écart renseigné.
7. Recette minimale : A, B, C, D, E exécutées sur Test ; F (idempotence) en plus.
8. Aucune mutation de Production, aucune fusion, aucune promotion : migration non poussée, Production lue seulement sous `begin read only`.
