-- =====================================================================
-- 20261016150000 — Poste le plus fréquent : « dernier poste » sous le seuil
-- (lot C, arbitrage de Frédéric du 16/10/2026). LECTURE SEULE.
--
-- CE QUE FAIT CETTE MIGRATION. Elle remplace (create or replace, même
-- signature) public.poste_le_plus_frequent(uuid) créée par 20261016120000.
-- Une seule règle change : entre 1 et 4 prises de poste éligibles, la
-- fonction rend le DERNIER poste pris (état `dernier_poste`) au lieu de
-- `historique_insuffisant`. Sans aucune prise éligible, l'état reste
-- `historique_insuffisant`. À partir de 5, rien ne change (`dominant`,
-- `aucune_dominante`).
--
-- Tout le reste est repris tel quel de 20261016120000 : source, exclusions,
-- fenêtre de 90 jours, seuil de 5, déduplication, droits, RLS.
--
-- COMPATIBILITÉ. L'écran en Production ne connaît pas `dernier_poste` : il
-- n'affiche alors rien, comme pour tout état inconnu. La migration peut donc
-- précéder le code. Elle n'écrit rien, ne change aucune table, aucune
-- politique RLS, aucun déclencheur.
-- =====================================================================

begin;

create or replace function public.poste_le_plus_frequent(p_employee uuid default null)
returns table (poste text, retenus int, eligibles int, etat text)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_appelant uuid := auth.uid();
  v_cible    uuid;
  v_role     text;
  v_total    int;
  v_max      int;
  v_ex_aequo int;
  v_poste    text;
  v_dernier  text;
begin
  if v_appelant is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  v_cible := coalesce(p_employee, v_appelant);

  -- La RLS de `employees` décide si l'appelant peut lire cette fiche.
  select e.role into v_role from public.employees e where e.id = v_cible;
  if not found then
    if v_cible <> v_appelant then
      raise exception 'fiche non accessible' using errcode = '42501';
    end if;
    return query select null::text, 0, 0, 'non_applicable'::text;
    return;
  end if;
  if v_role in ('manager', 'gerant') then
    return query select null::text, 0, 0, 'non_applicable'::text;
    return;
  end if;

  with prises as (
    select distinct s.heure_debut, s.role
      from public.shifts s
     where s.employee_id = v_cible
       and s.heure_debut >= now() - interval '90 days'
       and s.site_id is distinct from 'site-fantome-test'
       and s.statut in ('en_cours', 'clos_sans_pointage', 'termine')
       and s.confirmed_by in ('employe', 'manager')
       and s.role in ('pompiste', 'caissiere', 'renfort')
  ), par_poste as (
    select p.role, count(*)::int n from prises p group by p.role
  )
  select coalesce(sum(n), 0)::int,
         coalesce(max(n), 0)::int,
         count(*) filter (where n = (select max(n) from par_poste))::int,
         (select pp.role from par_poste pp order by pp.n desc, pp.role limit 1)
    into v_total, v_max, v_ex_aequo, v_poste
    from par_poste;

  if v_total = 0 then
    return query select null::text, 0, 0, 'historique_insuffisant'::text;
  elsif v_total < 5 then
    -- Moins de 5 prises : le dernier poste pris, jamais présenté comme le
    -- plus fréquent. Mêmes filtres que ci-dessus.
    select s.role into v_dernier
      from public.shifts s
     where s.employee_id = v_cible
       and s.heure_debut >= now() - interval '90 days'
       and s.site_id is distinct from 'site-fantome-test'
       and s.statut in ('en_cours', 'clos_sans_pointage', 'termine')
       and s.confirmed_by in ('employe', 'manager')
       and s.role in ('pompiste', 'caissiere', 'renfort')
     order by s.heure_debut desc, s.role
     limit 1;
    return query select v_dernier, 0, v_total, 'dernier_poste'::text;
  elsif v_ex_aequo > 1 then
    return query select null::text, v_max, v_total, 'aucune_dominante'::text;
  else
    return query select v_poste, v_max, v_total, 'dominant'::text;
  end if;
end
$$;

revoke all on function public.poste_le_plus_frequent(uuid) from public;
revoke all on function public.poste_le_plus_frequent(uuid) from anon;
grant execute on function public.poste_le_plus_frequent(uuid) to authenticated;

do $ctrl$
declare
  v_def text;
begin
  select pg_get_functiondef('public.poste_le_plus_frequent(uuid)'::regprocedure) into v_def;
  if not exists (select 1 from pg_proc
                  where oid = 'public.poste_le_plus_frequent(uuid)'::regprocedure
                    and not prosecdef) then
    raise exception 'poste_le_plus_frequent doit rester SECURITY INVOKER';
  end if;
  if has_function_privilege('anon', 'public.poste_le_plus_frequent(uuid)', 'execute') then
    raise exception 'anon ne doit pas pouvoir exécuter poste_le_plus_frequent';
  end if;
  if not has_function_privilege('authenticated', 'public.poste_le_plus_frequent(uuid)', 'execute') then
    raise exception 'authenticated doit pouvoir exécuter poste_le_plus_frequent';
  end if;
  if v_def !~ 'confirmed_by' or v_def ~ '''legacy''' or v_def !~ 'dernier_poste' then
    raise exception 'définition inattendue';
  end if;
end
$ctrl$;

commit;
