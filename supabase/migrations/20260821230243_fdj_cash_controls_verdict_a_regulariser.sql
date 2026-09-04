-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821230243 · fdj_cash_controls_verdict_a_regulariser
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Refonte des statuts de contrôle FDJ (21/08/2026, demande de Frédéric) :
-- le manager ne choisit plus librement un "Statut du contrôle" parmi 7
-- valeurs qui pouvaient contredire l'écart affiché (ex: écart = +1,00 €
-- et "Conforme" choisis en même temps). Le statut est désormais DÉRIVÉ
-- automatiquement de l'écart + du verdict du contrôle. Un seul nouveau
-- cas métier réel apparaît : "Écart à régulariser" (l'écart existe,
-- n'est pas encore expliqué/justifié, une action reste due) — distinct
-- de l'ancien 'regularise' (passé : "a été régularisé").
alter table public.fdj_cash_controls drop constraint fdj_cash_controls_resultat_controle_check;
alter table public.fdj_cash_controls add constraint fdj_cash_controls_resultat_controle_check
  check (resultat_controle is null or resultat_controle = any (array['conforme','avec_ecart','a_revoir','non_comparable','a_regulariser']));

alter table public.fdj_cash_controls drop constraint fdj_cash_controls_statut_check;
alter table public.fdj_cash_controls add constraint fdj_cash_controls_statut_check
  check (statut = any (array['provisoire','a_controler','en_attente','expliquee','regularise','valide_avec_ecart','conforme','a_regulariser']));
