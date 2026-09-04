-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817185027 · carburant_reception_visite_lignes_cout_achat_sprint_c8
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Sprint C8 "Économique" (audit Carburants — Réceptions, deltas et effet
-- économique du stock, §10 modèle de données minimal + §6/§7 CMP/stock
-- hérité). Le coût d'achat par litre n'est PAS connu par l'employé au
-- moment de la réception (le BL ne porte généralement pas le prix, la
-- facture arrive souvent après) -- ces colonnes sont donc nullable et
-- destinées à être complétées A POSTERIORI par le manager, sur une ligne
-- de réception déjà posée (carburant_reception_visite_lignes, Sprint C4).
-- Aucune nouvelle politique RLS nécessaire : l'UPDATE sur cette table est
-- déjà restreint à manager/gérant + site (vérifié en direct lors du
-- Sprint C5 "Robustesse").
ALTER TABLE carburant_reception_visite_lignes
  ADD COLUMN IF NOT EXISTS cout_achat_par_litre numeric,
  ADD COLUMN IF NOT EXISTS cout_saisi_par text,
  ADD COLUMN IF NOT EXISTS cout_saisi_le timestamptz;

COMMENT ON COLUMN carburant_reception_visite_lignes.cout_achat_par_litre IS
  'Sprint C8 : coût d''achat facturé par litre pour cette ligne de réception, saisi a posteriori par un manager (jamais par l''employé, qui n''a pas cette donnée au moment de la livraison). NULL tant que non saisi -- alimente le calcul du CMP (nexus-carburant-moteur.js::calculerCmpProgressif).';
COMMENT ON COLUMN carburant_reception_visite_lignes.cout_saisi_par IS 'Sprint C8 : nom du manager ayant saisi le coût d''achat.';
COMMENT ON COLUMN carburant_reception_visite_lignes.cout_saisi_le IS 'Sprint C8 : horodatage de la saisie du coût d''achat (peut être bien postérieur à la date de la visite elle-même).';
