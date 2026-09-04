-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260809225230 · fdj_alertes_activation_sans_carnet_confie
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


alter table fdj_alertes drop constraint fdj_alertes_type_check;
alter table fdj_alertes add constraint fdj_alertes_type_check check (type in ('stock_initial_modifie', 'activation_sans_carnet_confie'));
alter table fdj_alertes add column if not exists motif text;
alter table fdj_alertes alter column shift_precedent_id drop not null;
