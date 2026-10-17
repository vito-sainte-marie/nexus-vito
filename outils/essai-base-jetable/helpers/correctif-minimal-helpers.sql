-- Correctif minimal PROPOSÉ (non appliqué ailleurs que sur la base jetable) :
-- placer pg_temp en DERNIER dans le search_path des trois helpers partagés.
-- « employees » non qualifié se résout alors vers public.employees avant toute
-- table temporaire. Aucun corps de fonction, aucun droit, aucune politique ne
-- change. Ce fichier ouvre une transaction et ne la termine pas : le fichier
-- joué ensuite (usurpation ou preuve RLS) l'annule par son ROLLBACK final.
begin;
alter function public.current_employee_site_id() set search_path = pg_catalog, public, pg_temp;
alter function public.current_employee_role() set search_path = pg_catalog, public, pg_temp;
alter function public.je_suis_createur() set search_path = pg_catalog, public, pg_temp;
