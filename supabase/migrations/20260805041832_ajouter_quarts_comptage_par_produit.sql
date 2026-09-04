-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260805041832 · ajouter_quarts_comptage_par_produit
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Langage commerce plutôt que logistique (05/08/2026, demande de
-- Frédéric) : un manager configure "Comptage : matin seulement" pour la
-- viennoiserie plutôt que de connaître le vocabulaire ERP. NULL = compté
-- aux deux quarts (comportement historique, zéro régression).
ALTER TABLE inventaire_regles_produit
  ADD COLUMN IF NOT EXISTS quarts_comptage text[] DEFAULT NULL;
COMMENT ON COLUMN inventaire_regles_produit.quarts_comptage IS 'Quarts où ce produit doit être compté : NULL = matin et soir (défaut), ou un sous-ensemble de {matin, soir}.';
