-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260731124721 · move_pg_net_out_of_public_schema
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- pg_net n'est pas encore utilisé (réservé à un futur connecteur HTTP sortant) —
-- le déplacer hors du schéma public par hygiène, signalé par l'audit sécurité.
drop extension if exists pg_net;
create extension if not exists pg_net schema extensions;
