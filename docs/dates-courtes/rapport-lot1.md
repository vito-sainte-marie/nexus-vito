# Rapport lot 1 : Dates courtes (v4)

Statut : migration, recette et retour arrière v4 livrés dans la même PR (#352, brouillon). Recette pglite 118 contrôles, 118 OK, 0 KO. Rien appliqué sur Test ni en Production.

## Contenu de la migration 20261121120000

- 9 tables en ajout seul, FORCE RLS, aucun droit `anon` ni `public` : tournées, relevés, corrections, retraits, démarques, correspondances, accès caissier, certifications, demandes de correction.
- 32 fonctions pour `authenticated` : enregistrer, créer, terminer, certifier, demander et répondre à une correction, comptabiliser et annuler une démarque, régler l'accès caissier, quantités courantes, version de tournée, triggers.
- Tournées individuelles simultanées (EN_COURS, TERMINEE_A_CERTIFIER, CORRECTION_DEMANDEE, CERTIFIEE). Par article, la tournée du dernier relevé effectif fait foi, sans addition entre tournées. Plancher à zéro : une correction sous zéro est refusée (`plancher_zero`).
- Démarque comptabilisée (commentaire Guardian 7071552453) : quantité, heure du geste, auteur, motif facultatif, liens vers retrait et tournée, clé d'idempotence. Autorisée seulement depuis « retiré physiquement », cumul ≤ quantité retirée. Droit vérifié côté serveur : manager, gérant, créateur autorisés ; renfort, caissier, pompiste, vacataire refusés. Aucune écriture comptable, aucun lien Decenium ni `inventaire_mouvements`, aucune valeur en euros.

## Rôles vérifiés

renfort, manager, gerant, caissier, pompiste, vacataire ; créateur par `est_createur` et `sites.acces_createur_autorise` (faux par défaut). Vacataire refusé en attente d'arbitrage du pilote.

## Recette

118/118. Les cas ajoutés pour la démarque : manager autorisé, renfort refusé, quantité au-dessus du retiré refusée, rejeu réseau sans doublon. Retour arrière : avant 32 fonctions et 9 tables, après 0 et 0, rejouable sans erreur.

## Limites

- Banc pglite avec une doublure, pas un Supabase réel.
- Un superutilisateur contourne FORCE RLS : pas de preuve RLS réelle hors superutilisateur.
- Concurrence rejouée en séquence.
- Écrans des lots 2 à 4 non couverts.
- Les vraies tables peuvent avoir d'autres colonnes NOT NULL.
- Rien n'est appliqué : Test par Guardian, Production sur GO distinct du pilote.
