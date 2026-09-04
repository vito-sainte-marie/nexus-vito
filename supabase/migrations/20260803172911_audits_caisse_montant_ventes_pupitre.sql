-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803172911 · audits_caisse_montant_ventes_pupitre
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Montant des ventes carburant issu directement du ticket pupitre/master
-- (03/08/2026, demande de Frédéric) : plus fiable qu'un simple litrage ×
-- prix mensuel arrondi (le pupitre calcule ses propres montants
-- transaction par transaction, qui peuvent différer de quelques centimes).
-- Distinct de litrage_gazole/sp95/gnr (toujours les litres réels, utilisés
-- par NEXUS Tempo indépendamment de la méthode de calcul de vente_piste) et
-- de prix_gazole/sp95/gnr (le prix mensuel, seulement rempli quand c'est
-- LUI qui a servi à calculer vente_piste — jamais les deux sources en même
-- temps pour un même carburant, voir calculerVentePiste()).
alter table audits_caisse
  add column if not exists montant_gazole numeric,
  add column if not exists montant_sp95 numeric,
  add column if not exists montant_gnr numeric;

comment on column audits_caisse.montant_gazole is 'Montant des ventes gazole tel qu''affiché sur le ticket pupitre/master — prime sur litrage×prix quand renseigné.';
comment on column audits_caisse.montant_sp95 is 'Montant des ventes SP95 tel qu''affiché sur le ticket pupitre/master — prime sur litrage×prix quand renseigné.';
comment on column audits_caisse.montant_gnr is 'Montant des ventes GNR tel qu''affiché sur le ticket pupitre/master — prime sur litrage×prix quand renseigné.';
