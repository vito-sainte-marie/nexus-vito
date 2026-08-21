-- Migration 1 : pont_reception_carburant_releves (déjà appliquée, voir v2.204)
-- Migration 2 : carburant_chaine_temporelle_mesure_le (appliquée le 21/08/2026)

alter table carburant_releves add column if not exists mesure_le timestamptz;
alter table carburant_releve_versions add column if not exists mesure_le timestamptz;

alter table carburant_controles add column if not exists reference_mesure_le timestamptz;
alter table carburant_controles add column if not exists fenetre_debut timestamptz;
alter table carburant_controles add column if not exists fenetre_fin timestamptz;

-- Rétro-remplissage manuel des 11 lignes carburant_releves existantes (mesure_le = created_at
-- sauf pour le relevé du 20/08/2026 sur vito-sainte-marie, rétro-corrigé à l'heure réelle du
-- jaugeage post-livraison : 2026-08-20T15:01:16.151Z). Détail exécuté via execute_sql, non
-- rejouable tel quel (dépend des données existantes au moment de l'exécution).
