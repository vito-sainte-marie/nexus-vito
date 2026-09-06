-- SITE-EXPLICITE-1 / INSERT-SITE-GUARD (06/09/2026)
--
-- Dernière face du même motif. Les deux policies d'INSERT restées ouvertes
-- après MUTATION-SITE-GUARD présentent la faiblesse déjà corrigée sur leurs
-- faces UPDATE et DELETE :
--
--   advisor_rules.manager_insert_advisor_rules   → `with check` = rôle seul
--   apprentissage_snapshots.employee_own_snapshot_upsert → `with check` = auteur seul
--
-- Créer était donc plus permissif que modifier. Un manager pouvait créer une
-- règle GLOBALE — influençant tous les commerces — qu'il n'aurait ensuite pas
-- eu le droit d'administrer. C'est l'incohérence que ce lot ferme :
--
--   **on ne crée pas une portée qu'on n'aurait pas le droit d'administrer.**
--
-- Aucune donnée réattribuée, aucun privilège élargi, aucune policy UPDATE ou
-- DELETE touchée.

-- ── 1. advisor_rules ────────────────────────────────────────────────────
-- Cohérent avec le contrat UPDATE/DELETE arbitré : un manager n'administre
-- que les règles LOCALES de SON site. Il ne peut donc créer ni une règle
-- globale (`site_id is null`), ni une règle pour un autre commerce.
--
-- `site_id = current_employee_site_id()` est faux quand `site_id` est null :
-- la règle globale est exclue sans clause spéciale, et aucun `null` ne peut
-- être confondu avec « autorisé ». Les règles globales restent créées par
-- migration — mécanisme explicitement transverse et audité.
drop policy if exists manager_insert_advisor_rules on public.advisor_rules;
create policy manager_insert_advisor_rules on public.advisor_rules
  for insert to public
  with check (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site_id = (select public.current_employee_site_id())
  );

comment on policy manager_insert_advisor_rules on public.advisor_rules is
  'INSERT-SITE-GUARD — un manager crée une règle LOCALE sur son site, jamais une règle globale ni celle d''un autre commerce. Créer était plus permissif qu''administrer : on ne crée pas une portée qu''on ne pourrait pas ensuite modifier.';

-- ── 2. apprentissage_snapshots ──────────────────────────────────────────
-- L'auteur ET le site, comme sur la face UPDATE. La table est écrite par
-- `upsert` : sans cette garde, le chemin d'insertion restait ouvert alors que
-- celui de mise à jour venait d'être fermé.
drop policy if exists employee_own_snapshot_upsert on public.apprentissage_snapshots;
create policy employee_own_snapshot_upsert on public.apprentissage_snapshots
  for insert to public
  with check (
    employee_id = (select auth.uid())
    and site_id = (select public.current_employee_site_id())
  );

comment on policy employee_own_snapshot_upsert on public.apprentissage_snapshots is
  'INSERT-SITE-GUARD — l''auteur et le site. La table est écrite par upsert : fermer l''UPDATE sans l''INSERT n''aurait rien fermé.';

-- ── Contrôle fail-closed ────────────────────────────────────────────────
-- Les quatre faces des deux tables doivent désormais contrôler le site. Ce
-- contrôle vaut aussi relecture des policies fermées au lot précédent : si
-- l'une d'elles était perdue, la migration s'arrêterait.
do $$
declare
  v_defaut text := '';
  v_nom text; v_ctrl text;
begin
  foreach v_nom in array array[
    'manager_insert_advisor_rules','manager_update_advisor_rules','manager_delete_advisor_rules',
    'employee_own_snapshot_upsert','employee_own_snapshot_update'] loop
    select coalesce(pg_get_expr(p.polwithcheck,p.polrelid), pg_get_expr(p.polqual,p.polrelid))
      into v_ctrl from pg_policy p where p.polname = v_nom;
    if v_ctrl is null then v_defaut := v_defaut || v_nom || ' (absente) ';
    elsif v_ctrl not like '%current_employee_site_id%' then
      v_defaut := v_defaut || v_nom || ' (sans contrôle de site) ';
    end if;
  end loop;

  if v_defaut <> '' then
    raise exception 'INSERT-SITE-GUARD interrompu : %', v_defaut;
  end if;
end;
$$;
