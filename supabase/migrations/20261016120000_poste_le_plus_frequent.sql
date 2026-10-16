-- =====================================================================
-- 20261016120000 — Poste le plus fréquent (lot B), LECTURE SEULE.
--
-- CE QUE FAIT CETTE MIGRATION. Elle crée UNE fonction de lecture,
-- public.poste_le_plus_frequent(p_employee uuid default null), qui rend au
-- plus une ligne (poste, retenus, eligibles, etat) pour l'écran de prise de
-- poste. Elle n'écrit rien, ne change aucune table, aucune politique RLS,
-- aucun déclencheur.
--
-- RÈGLE (arbitrages du 16/10/2026, cadrage lot B §8 et §12).
--   • Source : `shifts.role` des prises de poste CONFIRMÉES (confirmed_by = employe
--     ou manager, jamais auto), statuts en_cours / clos_sans_pointage / termine. Aucun départ
--     pointé n'est exigé : aujourd'hui `heure_fin` est NULL sur tout quart
--     clos sans pointage, la source est déclarative.
--   • Exclus : le statut `legacy` (import antérieur au 04/09), le site
--     fantôme de test, les rôles techniques (seuls pompiste, caissiere et
--     renfort comptent).
--   • Fenêtre : 90 jours glissants. Seuil : 5 prises de poste éligibles.
--   • On compte des PRISES DE POSTE distinctes — jamais des durées. Seuls
--     les doublons techniques sont exclus : même (heure_debut, role) pour un
--     même employé. Aucune déduplication par proximité horaire.
--   • États : `dominant` (un poste strictement en tête), `aucune_dominante`
--     (égalité en tête), `historique_insuffisant` (< 5), `non_applicable`
--     (manager, gérant, fiche introuvable).
--
-- DROITS. SECURITY INVOKER : la fonction subit la RLS de l'appelant.
--   `select_shifts` et `select_employees` laissent l'employé lire ses
--   propres lignes, et un manager/gérant celles de son site. Un appelant qui
--   vise une fiche qu'il ne peut pas lire reçoit 42501, jamais un calcul
--   partiel. `anon` n'a aucun droit d'exécution.
--
-- CE QUE LA FONCTION NE FAIT PAS. Elle ne présélectionne rien, ne touche ni
-- les habilitations (`rolesDisponibles()`), ni la FDJ, ni Verify, ni le
-- Planning, ni la Paye.
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

  if v_total < 5 then
    return query select null::text, 0, v_total, 'historique_insuffisant'::text;
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
  if v_def !~ 'confirmed_by' or v_def ~ '''legacy''' then
    raise exception 'définition inattendue';
  end if;
end
$ctrl$;

commit;
