-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260903114744 · nexus_paye_items_types_evenement_rh
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Les événements RH groupés (03/09/2026) émettent deux nouveaux type_item
-- que la contrainte d'origine ne connaissait pas : toute décision manager sur
-- une carte d'absence échouait donc silencieusement à l'écriture.
alter table public.nexus_paye_items
  drop constraint if exists nexus_paye_items_type_item_check;

alter table public.nexus_paye_items
  add constraint nexus_paye_items_type_item_check
  check (type_item = any (array[
    'presence_exceptionnelle','absence_a_verifier','absence_a_qualifier','absence_qualifiee',
    'conge_paye','arret_maladie','retard','retard_incoherent','heure_supplementaire',
    'jour_ferie','acompte','dette','ecart_caisse','autre'
  ]));
