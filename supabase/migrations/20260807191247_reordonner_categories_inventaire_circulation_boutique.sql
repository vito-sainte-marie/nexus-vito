-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807191247 · reordonner_categories_inventaire_circulation_boutique
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 07/08/2026, demande de Frédéric : ordre_affichage des catégories mis à jour
-- pour suivre le sens de circulation réel de l'employé en boutique :
-- Dépôt (Boissons, Huiles, Lave-glace) -> Boutique (Viennoiserie, Pains) ->
-- fin de trajet près de la caisse (Journaux, CBD, Cigarettes).
-- Gaz, Glaçons et Jaugeage Carburant ne sont pas touchés : gérés par le
-- pompiste sur un trajet séparé (piste), confirmé par Frédéric comme déjà OK.
-- Seul le site réel vito-sainte-marie est modifié (site-fantome-test exclu,
-- c'est un site de test sans rapport avec l'exploitation réelle).
update public.inventaire_categories set ordre_affichage = 4 where site = 'vito-sainte-marie' and nom = 'Boissons chaudes / Bières';
update public.inventaire_categories set ordre_affichage = 5 where site = 'vito-sainte-marie' and nom = 'Huiles';
update public.inventaire_categories set ordre_affichage = 6 where site = 'vito-sainte-marie' and nom = 'Lave-glace & Liquide de refroidissement';
update public.inventaire_categories set ordre_affichage = 7 where site = 'vito-sainte-marie' and nom = 'Viennoiserie';
update public.inventaire_categories set ordre_affichage = 8 where site = 'vito-sainte-marie' and nom = 'Pains / Sandwichs';
update public.inventaire_categories set ordre_affichage = 9 where site = 'vito-sainte-marie' and nom = 'Journaux';
update public.inventaire_categories set ordre_affichage = 10 where site = 'vito-sainte-marie' and nom = 'CBD';
update public.inventaire_categories set ordre_affichage = 11 where site = 'vito-sainte-marie' and nom = 'Cigarettes';
