-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803173432 · simplifier_montant_ventes_piste_global
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Simplification (03/08/2026, demande de Frédéric — "mets moi le montant
-- des ventes pistes global, ça suffit") : un seul champ montant plutôt que
-- 3 par carburant. Aucune ligne n'utilisait encore montant_gazole/sp95/gnr
-- (vérifié : 0 lignes) — remplacement propre, sans donnée à migrer.
alter table audits_caisse
  drop column if exists montant_gazole,
  drop column if exists montant_sp95,
  drop column if exists montant_gnr,
  add column if not exists montant_ventes_piste numeric;

comment on column audits_caisse.montant_ventes_piste is 'Montant global des ventes piste tel qu''affiché sur le ticket pupitre/master — prime sur litrage×prix quand renseigné.';
