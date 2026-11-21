# Rapport lot 1 : Dates courtes (v4, en cours)

Statut : documentation v4 rédigée. La migration, la recette et le retour arrière sont en cours de reprise sur le modèle v4. Aucun résultat v4 n'est annoncé. Rien sur Test ni en Production.

## Rôles vérifiés

renfort, manager, gerant, caissier, pompiste, vacataire ; créateur par `est_createur`. Vacataire refusé en attente d'arbitrage du pilote. La coquille `caissiere` est corrigée.

## Livrables prévus

- 7 tables : relevés, corrections, retraits, tournées, certifications, demandes de correction, correspondances.
- Vues ou fonctions : quantité d'un groupe, quantité courante, âge et étiquettes.
- Réglage « accès caissier ».
- Recette SQL et retour arrière.
- Qualification décrite, non déposée avant la relecture de Guardian.

## Historique

Le commit `31163058` porte l'ancien modèle hebdomadaire (136 contrôles, 0 KO). Il est obsolète et n'est pas présenté pour Test.

## Limites

- Banc pglite avec une doublure, pas un Supabase réel.
- Un superutilisateur contourne FORCE RLS.
- Concurrence testée en séquence.
- Les vraies tables peuvent avoir d'autres colonnes NOT NULL.
- Cas 11, 18, 19, 20 et 32 non joués.
- Rien n'est appliqué.
