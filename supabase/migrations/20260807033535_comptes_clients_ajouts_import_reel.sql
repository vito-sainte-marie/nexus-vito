-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807033535 · comptes_clients_ajouts_import_reel
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Ajouts déclenchés par l'import du vrai fichier NEXUS_Comptes_Clients_Parametrage_v1.xlsx
-- (07/08/2026) : le fichier distingue le nom d'expéditeur affiché sur
-- l'e-mail (ex. "Station Vito Sainte Marie") du nom du signataire dans le
-- corps du message (ex. "Frédéric Bragance") — les deux existaient
-- fusionnés dans client_comptes_parametres.expediteur_nom au départ.
-- Le fichier définit aussi plusieurs modèles nommés (STD_FACTURE,
-- STD_FACTURE_BONS, ALERTE_DOC), d'où l'ajout d'un code identifiant par
-- modèle et du modèle choisi par client.

alter table client_comptes_parametres add column if not exists nom_expediteur_email text;

alter table email_templates add column if not exists code text;
create unique index if not exists idx_email_templates_site_code on email_templates(site, code) where code is not null;

alter table client_preferences add column if not exists modele_message_code text;
