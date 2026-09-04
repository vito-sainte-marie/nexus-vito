-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260828034804 · carburant_commandes_ajout_note_reception_controlee
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Complément immédiat de la migration précédente (point 22) : `raison`
-- porte déjà un sens précis (justification de la RECOMMANDATION NEXUS,
-- posée par creerPropositionCommande) — jamais le réutiliser pour la note
-- du contrôle de réception, deux informations différentes qui se
-- perdraient l'une l'autre si elles partageaient la même colonne
-- (Article 11 : une seule vérité par donnée, pas une colonne à double
-- sens).
alter table public.carburant_commandes add column if not exists reception_controle_note text;
