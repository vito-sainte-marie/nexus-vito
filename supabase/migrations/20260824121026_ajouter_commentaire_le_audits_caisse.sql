-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260824121026 · ajouter_commentaire_le_audits_caisse
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- v2.231 (24/08/2026) — Traçabilité "traité/résolu" (audit "Cockpit
-- Améliorations Développeur" §12 : "NEXUS trace l'action et la preuve
-- éventuelle... Cycle de vie explicite et auditable").
--
-- Constat : marquerCaisseJustifiee() (NEXUS-Cockpit-v2.html et
-- NEXUS-Brief-v1.html, écriture identique dupliquée dans les deux) écrit
-- un texte de trace dans audits_caisse.commentaire ("Justifié depuis le
-- Cockpit par X le JJ/MM/AAAA") mais AUCUNE colonne horodatée dédiée
-- n'existe pour savoir QUAND cette action a eu lieu -- valide_le existe
-- déjà, mais appartient à un tout autre mécanisme (la "validation" d'un
-- audit depuis NEXUS-Verify-v1.html, avec ecart_piste_valide/
-- ecart_boutique_valide/commentaire_validation, jamais mélangé avec la
-- case "Justifié"). Sans horodatage dédié, impossible de faire apparaître
-- cette action dans le Journal NEXUS ("Aujourd'hui en chiffres") --
-- exactement le manque que l'audit vise avec "auditable".
alter table audits_caisse add column if not exists commentaire_le timestamptz null;

comment on column audits_caisse.commentaire_le is 'Horodatage de l''écriture de commentaire (ex. case "Justifié" du Cockpit/Brief) -- distinct de valide_le (validation d''audit depuis Verify). Ajouté v2.231, 24/08/2026.';
