-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260825014008 · carburant_commande_config_maximum_camion
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 25/08/2026 — Audit développeur "NEXUS Règles du moteur de commande
-- carburant" (§3, §15-16) : "Camion - capacité maximale 36 000 L. Aucune
-- recommandation ne peut dépasser 36 000 L au total." Ce plafond était
-- absent de carburant_commande_config (seul minimum_camion_litres
-- existait) — le moteur avait donc un plancher mais aucun plafond
-- explicite, laissant théoriquement passer une recommandation multi-
-- carburant dépassant la capacité physique du camion. Valeur par défaut du
-- camion de référence du site pilote (36 000 L), appliquée à tous les
-- sites existants — même discipline que minimum_camion_litres, éditable
-- par site si un fournisseur/camion différent l'exige un jour.
UPDATE station_config
SET carburant_commande_config = carburant_commande_config || '{"maximum_camion_litres": 36000}'::jsonb
WHERE carburant_commande_config IS NOT NULL
  AND NOT (carburant_commande_config ? 'maximum_camion_litres');
