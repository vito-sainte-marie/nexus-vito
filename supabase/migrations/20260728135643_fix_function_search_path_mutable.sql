-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260728135643 · fix_function_search_path_mutable
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter function public.assigner_controles_tenue_depuis_message(uuid, uuid) set search_path = public;
alter function public.assigner_justifications_caisse_depuis_message(uuid, uuid) set search_path = public;
alter function public.calculer_caisse_sante(text, date) set search_path = public;
alter function public.calculer_horaires_quart(text, text, date) set search_path = public;
alter function public.current_employee_role() set search_path = public;
alter function public.current_employee_site_id() set search_path = public;
alter function public.generer_message_caisse_ecart_non_justifie(text) set search_path = public;
alter function public.generer_message_caisse_ecart_recurrent(text) set search_path = public;
alter function public.generer_message_controle_tenue_absent(text) set search_path = public;
alter function public.generer_planning_mensuel(text, date, uuid) set search_path = public;
alter function public.heures_ouverture_publique(text, date) set search_path = public;
alter function public.je_suis_createur() set search_path = public;
alter function public.stats_fondateur() set search_path = public;
alter function public.verifier_depassements_heures(text, date) set search_path = public;
