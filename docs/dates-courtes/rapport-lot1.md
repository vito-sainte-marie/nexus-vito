# Dates courtes, Lot 1 : rapport

## Rôles vérifiés
`employees.role` prend les valeurs `caissier`, `pompiste`, `renfort`, `manager`, `gerant`, `vacataire`.
Une première annonce sur #160 écrivait `caissiere` et omettait `vacataire` : c'était une erreur de ma part, corrigée ici.
« Créateur » n'est pas un rôle : c'est le drapeau `employees.est_createur`, valable seulement sur les stations où `sites.acces_createur_autorise` est vrai (helper `je_suis_createur()`). La migration reprend ce schéma tel quel.

## Livrables
- Migration `supabase/migrations/20261121120000_dates_courtes_lot1.sql` : 6 tables en ajout seul, 1 vue, 20 fonctions accordées à `authenticated` (les 3 fonctions de déclencheur `avant_*` ne le sont pas). Rien pour `anon`, aucune suppression, mises à jour limitées aux colonnes d'annulation. Garde ORDRE-MIGRATION-CODE : `additive_compatible_avant_code`.
- Recette SQL `outils/recette/dates_courtes_lot1/01_recette_dates_courtes_lot1.sql` : un cas par transaction annulée, verdict OK ou KO avec valeur attendue et mesurée.
- Retour arrière `docs/deploiement/retour-arriere-dates-courtes-lot1-20261121.sql`, testé à blanc (20 fonctions et 7 objets avant, 0 après).

## Résultat mesuré
Banc local pglite : 136 contrôles, 136 OK, 0 KO.

## Choix techniques
- Plancher à zéro calculé dans le déclencheur d'insertion, par tournée.
- `provisoire` est calculé depuis le catalogue, jamais repris de la requête.
- `heure_geste` bornée de 45 jours en arrière à 5 minutes en avant : choix de ma part, absent de la fiche.
- Un retrait dont l'heure du geste tombe dans la tournée précédente est contrôlé contre cette tournée (cas c28 : il faut un relevé dans cette tournée).

## Écarts avec la fiche
Les bornes d'`heure_geste` ci-dessus. Aucun autre écart connu.

## Limites
- Validé sur un stub pglite, pas sur Supabase réel. Le rôle pglite est superutilisateur : le contournement de FORCE RLS n'est donc pas éprouvé.
- Le cas 5 (concurrence) est rejoué en séquence, pas en parallèle réel.
- La garde d'identité Test est contournée sur le banc par un réglage explicite.
- Les tables réelles `products`, `sites` et `auth.users` peuvent porter d'autres colonnes NOT NULL que le stub.
- Non joués : cas 19, 20, 33 (Lot 3), 11 et 18 (Lot 2).
- Rien appliqué sur Test ni en Production.
