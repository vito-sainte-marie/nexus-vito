-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260809161651 · ajouter_ouverture_validee_fdj_shifts
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- ============================================================
-- 09/08/2026, demande de Frédéric : "les employés font l'inventaire de
-- leurs jeux en débutant leur quart et à la fin de leur quart" — même
-- principe que NEXUS Inventaire (ouverture puis clôture, jamais un seul
-- geste). ouverture_validee sépare le moment où l'employé confirme (ou
-- corrige) le stock de départ hérité du quart précédent, du moment où il
-- clôture (statut/valide_le, déjà existants, continuent de représenter la
-- clôture complète du quart).
-- ============================================================
alter table public.fdj_shifts
  add column ouverture_validee boolean not null default false,
  add column ouverture_validee_le timestamptz;
comment on column public.fdj_shifts.ouverture_validee is 'true dès que l''employé a validé ou corrigé le stock de départ hérité du quart précédent — distinct de statut=''valide'' qui représente la clôture complète du quart.';
