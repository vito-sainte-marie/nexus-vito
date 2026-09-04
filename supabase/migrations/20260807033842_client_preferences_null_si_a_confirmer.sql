-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807033842 · client_preferences_null_si_a_confirmer
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Un mode de facturation ou de remise des bons "à confirmer" dans le
-- fichier source ne doit jamais être deviné (Oui/Non) — NULL doit rester
-- un état possible et distinct de false, le temps que le manager tranche.
alter table client_preferences alter column facture_envoi_email drop not null;
alter table client_preferences alter column facture_remise_main_propre drop not null;
alter table client_preferences alter column bons_joindre_email drop not null;
alter table client_preferences alter column bons_ne_pas_envoyer drop not null;
alter table client_preferences alter column bons_remise_main_propre drop not null;
