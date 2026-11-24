-- Lot RLS-1 (Guardian #160, priorités 1 et 2). Aucune donnée modifiée.
-- 1. Les 12 vues view_fdj_* passent en security_invoker : elles lisaient jusqu'ici avec les droits de leur propriétaire,
--    donc sans RLS, et montraient toutes les stations. Désormais la RLS des tables fdj_* s'applique à l'appelant
--    (politique « même station » déjà présente sur les six tables de base : rien à ajouter).
-- 2. evaluations_employes et controles_tenue : l'employé ne lit que ses lignes ; manager et gérant, toute leur station ;
--    le créateur seulement si sites.acces_createur_autorise. Les politiques d'écriture (manager/gérant, même station) ne bougent pas.
-- Idempotente. Une garde fait échouer la migration si un objet attendu manque.

do $garde$
declare v text; t text;
begin
  foreach v in array array['view_fdj_daily_summary','view_fdj_discrepancy_daily','view_fdj_employee_daily','view_fdj_employee_price_tier_daily',
    'view_fdj_game_daily','view_fdj_game_daily_mouvements','view_fdj_game_daily_ventes','view_fdj_monthly_summary','view_fdj_price_tier_daily',
    'view_fdj_shift_facts','view_fdj_weekly_summary','view_fdj_yearly_summary'] loop
    if to_regclass('public.' || v) is null then raise exception 'RLS-1 : vue % absente, arrêt', v; end if;
  end loop;
  foreach t in array array['fdj_cash_controls','fdj_games','fdj_shift_counts','fdj_shifts','fdj_imported_history','fdj_stock_movements',
    'evaluations_employes','controles_tenue'] loop
    if to_regclass('public.' || t) is null then raise exception 'RLS-1 : table % absente, arrêt', t; end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'RLS-1 : RLS inactive sur %, arrêt', t; end if;
  end loop;
  foreach t in array array['fdj_cash_controls','fdj_games','fdj_shift_counts','fdj_shifts','fdj_imported_history','fdj_stock_movements'] loop
    if not exists (select 1 from pg_policy p where p.polrelid = ('public.' || t)::regclass and p.polcmd::text in ('r','*')) then
      raise exception 'RLS-1 : aucune politique SELECT sur %, la vue deviendrait vide, arrêt', t;
    end if;
  end loop;
  if to_regprocedure('public.current_employee_role()') is null or to_regprocedure('public.current_employee_site_id()') is null
     or to_regprocedure('public.je_suis_createur()') is null then
    raise exception 'RLS-1 : fonctions d''aide RLS absentes, arrêt';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='sites' and column_name='acces_createur_autorise') then
    raise exception 'RLS-1 : sites.acces_createur_autorise absente, arrêt';
  end if;
end
$garde$;

alter view public.view_fdj_daily_summary set (security_invoker = true);
alter view public.view_fdj_discrepancy_daily set (security_invoker = true);
alter view public.view_fdj_employee_daily set (security_invoker = true);
alter view public.view_fdj_employee_price_tier_daily set (security_invoker = true);
alter view public.view_fdj_game_daily set (security_invoker = true);
alter view public.view_fdj_game_daily_mouvements set (security_invoker = true);
alter view public.view_fdj_game_daily_ventes set (security_invoker = true);
alter view public.view_fdj_monthly_summary set (security_invoker = true);
alter view public.view_fdj_price_tier_daily set (security_invoker = true);
alter view public.view_fdj_shift_facts set (security_invoker = true);
alter view public.view_fdj_weekly_summary set (security_invoker = true);
alter view public.view_fdj_yearly_summary set (security_invoker = true);

drop policy if exists select_evaluations_employes on public.evaluations_employes;
create policy select_evaluations_employes on public.evaluations_employes for select to authenticated
  using (
    employee_id = (select auth.uid())
    or ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = evaluations_employes.site and s.acces_createur_autorise = true))
  );

drop policy if exists select_controles_tenue on public.controles_tenue;
create policy select_controles_tenue on public.controles_tenue for select to authenticated
  using (
    employee_id = (select auth.uid())
    or ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = controles_tenue.site and s.acces_createur_autorise = true))
  );

do $verif$
declare v text;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname like 'view\_fdj\_%' and c.relkind = 'v'
             and not coalesce(c.reloptions @> array['security_invoker=true'], false) loop
    raise exception 'RLS-1 : la vue % n''est pas en security_invoker, arrêt', v;
  end loop;
end
$verif$;
