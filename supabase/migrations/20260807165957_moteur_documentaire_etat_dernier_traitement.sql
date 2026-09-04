-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807165957 · moteur_documentaire_etat_dernier_traitement
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Widget "État du moteur documentaire" (07/08/2026, demande de Frédéric) :
-- distinct du battement de cœur (toutes les ~30s, qu'il y ait du travail ou
-- non), dernier_traitement horodate la dernière fois qu'un document a
-- réellement été traité avec succès — permet d'afficher "Dernier
-- traitement : 12:41" sans confondre avec le simple fait que le worker est
-- vivant.
alter table public.moteur_documentaire_etat add column if not exists dernier_traitement timestamptz;
comment on column public.moteur_documentaire_etat.dernier_traitement is 'Horodatage du dernier document traité avec succès par le worker — distinct de dernier_battement (heartbeat régulier, avec ou sans travail).';
