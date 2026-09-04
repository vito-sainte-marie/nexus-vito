-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260824125119 · ajouter_motif_et_reference_precedente_fdj_stock_references
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table fdj_stock_references add column if not exists motif text null;
alter table fdj_stock_references add column if not exists reference_precedente_id uuid null references fdj_stock_references(id);
comment on column fdj_stock_references.motif is 'Motif de la réconciliation, saisi par le manager quand le contrôle physique révèle un écart contre le stock théorique (avant/après déjà portés par bureau_reel/caisse_reel vs stock_theorique_*_avant sur fdj_stock_reference_lignes). Optionnel quand le recomptage confirme exactement le théorique (aucun écart, rien à motiver). Ajouté v2.233, 24/08/2026, demande de Frédéric : "chaîne de traçabilité complète des mouvements et fonction de réconciliation physique".';
comment on column fdj_stock_references.reference_precedente_id is 'Pointeur explicite vers le point de référence que cette réconciliation remplace -- jamais déduit implicitement du tri par date (ambigu si deux références partagent la même date). NULL uniquement pour la toute première référence jamais posée sur le site. L''historique antérieur n''est jamais effacé : l''ancienne référence reste en base, seulement supplantée. Ajouté v2.233, 24/08/2026.';
