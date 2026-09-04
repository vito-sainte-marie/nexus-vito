-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260813214735 · client_comptes_parametres_credentials_envoi_email
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 13/08/2026 — Envoi automatique des factures par e-mail (demande de Frédéric).
-- Adresse d'expédition Gmail + mot de passe d'application, configurables par
-- site dans NEXUS-Parametres-Comptes-Clients-v1.html. Protégés uniquement par
-- les policies RLS déjà en place sur client_comptes_parametres
-- (nexus_clients_ecriture_ok / nexus_clients_lecture_ok : manager/gérant du
-- site, ou créateur) — même niveau de confiance que le reste du module
-- Comptes Clients, aucune table séparée ni chiffrement applicatif ajouté pour
-- cette V1. Voir NEXUS-Data-Dictionary-v2 pour la note de portée/limite.
alter table client_comptes_parametres
  add column adresse_expedition_email text,
  add column mot_de_passe_app_email text;

comment on column client_comptes_parametres.adresse_expedition_email is 'Adresse Gmail utilisée pour envoyer les factures aux clients (ex: vito.saintemarie2@gmail.com).';
comment on column client_comptes_parametres.mot_de_passe_app_email is 'Mot de passe d''application Gmail (pas le mot de passe du compte) — utilisé uniquement côté serveur (Edge Function nexus-envoyer-facture), jamais affiché en clair après saisie côté client.';
