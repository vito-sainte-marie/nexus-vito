-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260828114213 · carburant_commande_config_minimum_camion_3000l
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 28/08/2026, retour de Frédéric (refonte qualitative Carburants, v2.260) —
-- "Minimum de livraison par commande : 3 000 L" est un vrai paramètre
-- station/fournisseur, pas 10 000 L (placeholder jamais confirmé par un
-- fournisseur réel). Correction globale décidée par Frédéric ("Oui,
-- correction globale à 3 000 L (recommandé)") : le seuil change partout où
-- il s'applique (mode normal ET fin de mois/camion-complet), l'algorithme
-- de complétion (optimiserCommandeMultiCarburant) restant inchangé — seule
-- la VALEUR de la constante est corrigée.

-- 1) Valeur par défaut de la colonne (nouveaux sites futurs).
alter table station_config
  alter column carburant_commande_config
  set default jsonb_build_object(
    'cutoff_heure', '11:00',
    'jours_livraison_iso', jsonb_build_array(1, 2, 3, 4, 5),
    'minimum_camion_litres', 3000,
    'compartiments_disponibles_litres', jsonb_build_array(2000, 5000, 7000),
    'stock_securite_jours', 3
  );

-- 2) Sites existants (vito-sainte-marie + site-fantome-test) — mise à jour
--    ciblée de la seule clé minimum_camion_litres, jamais un remplacement
--    de l'objet entier (préserve stock_securite_jours_normal/fin_mois,
--    maximum_camion_litres, etc. déjà en place sur vito-sainte-marie).
update station_config
set carburant_commande_config = jsonb_set(
  carburant_commande_config, '{minimum_camion_litres}', '3000'::jsonb
)
where (carburant_commande_config->>'minimum_camion_litres') = '10000';
