-- SITE-EXPLICITE-1 / MUTATION-SITE-GUARD (06/09/2026)
--
-- CE QUE LA MATRICE UPDATE A PROUVÉ, par comportement :
--
--   advisor_rules            (manager)          : DEPLACEE vers « site-fantome-test »
--   apprentissage_snapshots  (employé ordinaire): 1 DEPLACEE
--
-- Une ligne correctement créée pouvait ensuite changer de site. C'est la
-- troisième occurrence d'un même motif — après `mission_progress` — et le
-- motif mérite d'être nommé : **on contrôle l'auteur et on oublie le lieu.**
--
-- PÉRIMÈTRE STRICT. Cette migration ferme l'UPDATE et le DELETE d'
-- `advisor_rules`, et l'UPDATE d'`apprentissage_snapshots`. Elle ne touche
-- AUCUNE policy d'INSERT — y compris celles qui présentent la même faiblesse,
-- signalées au Handoff sans être corrigées ici.
--
-- Aucune donnée n'est réattribuée. Aucun privilège n'est élargi.

-- ── 1. advisor_rules — le contrat global / local ────────────────────────
--
-- Deux natures de règles, et c'est la distinction que la correction doit
-- porter :
--
--   * règle GLOBALE (`site_id is null`) — elle gouverne TOUS les commerces.
--     Les 31 règles actuelles sont de ce type, créées par la migration de
--     référentiel A15. Aucun écran ne les modifie : le balayage applicatif ne
--     trouve aucune écriture sur `advisor_rules`.
--     Contrat retenu : **une règle globale n'est pas mutable par un manager
--     de site.** Laisser le manager du commerce A modifier une règle qui
--     décide aussi pour le commerce B serait une fuite d'influence, pas une
--     commodité d'administration. Elles restent administrées par migration,
--     ce qui est déjà leur mode d'existence.
--
--   * règle LOCALE (`site_id = un site`) — elle ne gouverne que ce commerce.
--     Contrat retenu : le manager de CE site la mute, et **son site ne change
--     pas**.
--
-- `site_id = current_employee_site_id()` est faux quand `site_id` est null :
-- les règles globales sortent donc du périmètre de mutation sans clause
-- supplémentaire, et sans qu'un `null` puisse être confondu avec « autorisé ».

drop policy if exists manager_update_advisor_rules on public.advisor_rules;
create policy manager_update_advisor_rules on public.advisor_rules
  for update to public
  using (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site_id = (select public.current_employee_site_id())
  )
  with check (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site_id = (select public.current_employee_site_id())
  );

comment on policy manager_update_advisor_rules on public.advisor_rules is
  'MUTATION-SITE-GUARD — le rôle est conservé, le site est ajouté. Une règle globale (site_id null) n''est pas mutable par un manager de site : elle décide aussi pour les autres commerces.';

drop policy if exists manager_delete_advisor_rules on public.advisor_rules;
create policy manager_delete_advisor_rules on public.advisor_rules
  for delete to public
  using (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site_id = (select public.current_employee_site_id())
  );

comment on policy manager_delete_advisor_rules on public.advisor_rules is
  'MUTATION-SITE-GUARD — supprimer une règle qui gouverne d''autres commerces n''est pas une opération de site.';

-- Défense en profondeur : même si une policy venait à être élargie un jour,
-- la PORTÉE d'une règle ne se change pas par une mise à jour. Une règle
-- globale ne devient pas locale, une règle locale ne change pas de site.
-- Un trigger n'est PAS contourné par une migration : il s'applique à tout
-- UPDATE, y compris exécuté par `postgres`. Changer la portée d'une règle
-- demande donc de désactiver explicitement ce trigger — un geste visible dans
-- le SQL, et c'est précisément l'effet recherché. (Constaté à l'usage : le
-- montage d'une fixture de preuve a lui-même été refusé par ce trigger.)
create or replace function public.nexus_portee_advisor_immuable()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.site_id is distinct from old.site_id then
    raise exception
      'Portée de la règle Advisor % immuable : « % » → « % » refusé. Changer la portée d''une règle est une décision de référentiel, pas une mise à jour.',
      old.code, coalesce(old.site_id,'(globale)'), coalesce(new.site_id,'(globale)')
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.nexus_portee_advisor_immuable() is
  'MUTATION-SITE-GUARD — la portée d''une règle Advisor ne change pas par UPDATE, quelle que soit la policy en vigueur.';

drop trigger if exists nexus_portee_advisor_immuable on public.advisor_rules;
create trigger nexus_portee_advisor_immuable
  before update of site_id on public.advisor_rules
  for each row
  execute function public.nexus_portee_advisor_immuable();

-- ── 2. apprentissage_snapshots ──────────────────────────────────────────
--
-- `USING (employee_id = auth.uid())` seul : l'auteur restait l'auteur, mais le
-- site pouvait changer. Exactement la forme du défaut de `mission_progress`.
--
-- Le `with check` est écrit EXPLICITEMENT plutôt que laissé au repli sur
-- `using`. PostgreSQL applique bien `using` à la nouvelle ligne quand
-- `with check` est absent — mais s'appuyer sur ce repli est ce qui a rendu la
-- faiblesse invisible à la relecture. Ce qui est écrit se lit.
drop policy if exists employee_own_snapshot_update on public.apprentissage_snapshots;
create policy employee_own_snapshot_update on public.apprentissage_snapshots
  for update to public
  using (
    employee_id = (select auth.uid())
    and site_id = (select public.current_employee_site_id())
  )
  with check (
    employee_id = (select auth.uid())
    and site_id = (select public.current_employee_site_id())
  );

comment on policy employee_own_snapshot_update on public.apprentissage_snapshots is
  'MUTATION-SITE-GUARD — l''auteur ET le site. Avant : seul l''auteur était contrôlé, la ligne pouvait être déplacée vers un autre commerce.';

-- ── Contrôle fail-closed ────────────────────────────────────────────────
do $$
declare
  v_defaut text := '';
  v_nom text; v_ctrl text;
begin
  foreach v_nom in array array['manager_update_advisor_rules','manager_delete_advisor_rules',
                               'employee_own_snapshot_update'] loop
    select coalesce(pg_get_expr(p.polwithcheck,p.polrelid), pg_get_expr(p.polqual,p.polrelid))
      into v_ctrl from pg_policy p where p.polname = v_nom;
    if v_ctrl is null then v_defaut := v_defaut || v_nom || ' (absente) ';
    elsif v_ctrl not like '%current_employee_site_id%' then
      v_defaut := v_defaut || v_nom || ' (sans contrôle de site) ';
    end if;
  end loop;

  if not exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
                  where c.relname='advisor_rules' and t.tgname='nexus_portee_advisor_immuable') then
    v_defaut := v_defaut || 'trigger de portée absent ';
  end if;

  if v_defaut <> '' then
    raise exception 'MUTATION-SITE-GUARD interrompu : %', v_defaut;
  end if;
end;
$$;
