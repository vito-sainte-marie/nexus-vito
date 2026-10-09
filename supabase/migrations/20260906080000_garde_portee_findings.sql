-- SITE-EXPLICITE-1 / STATIC-GUARD-FINDINGS (06/09/2026)
--
-- Les trois occurrences trouvées par la garde statique d'ADR-0001 à sa
-- première exécution. Aucune n'avait été vue en six lots de recherche
-- manuelle — c'est l'argument de l'instrument.
--
--   progression_badge_awards.employee_own_badge_insert   (INSERT)
--   progression_points_ledger.employee_own_points_insert (INSERT)
--   inventaire_quart_employes.update_inventaire_quart_employes (UPDATE)
--
-- Aucune donnée réattribuée. Aucun privilège élargi. Aucun default retiré.

-- ── 1 et 2. progression_badge_awards / progression_points_ledger ────────
--
-- Contrat métier, lu dans `NEXUS-Progression-v1.html` : l'employé inscrit SON
-- badge et SES points, sur SON site — l'écriture est explicitement exclue de
-- la vue manager (`if (!vueManager …)`). Aucun chemin manager n'insère.
--
-- `site_id` y est `NOT NULL` **sans défaut** : le client fournit donc le site,
-- et rien ne le vérifiait. Un employé pouvait inscrire un badge ou des points
-- sur un autre commerce — de la reconnaissance, donc potentiellement de la
-- rémunération, portée au mauvais endroit.
drop policy if exists employee_own_badge_insert on public.progression_badge_awards;
create policy employee_own_badge_insert on public.progression_badge_awards
  for insert to public
  with check (
    employee_id = (select auth.uid())
    and site_id = (select public.current_employee_site_id())
  );

comment on policy employee_own_badge_insert on public.progression_badge_awards is
  'STATIC-GUARD-FINDINGS — l''auteur ET le site. site_id est NOT NULL sans défaut : le client le fournissait sans contrôle.';

drop policy if exists employee_own_points_insert on public.progression_points_ledger;
create policy employee_own_points_insert on public.progression_points_ledger
  for insert to public
  with check (
    employee_id = (select auth.uid())
    and site_id = (select public.current_employee_site_id())
  );

comment on policy employee_own_points_insert on public.progression_points_ledger is
  'STATIC-GUARD-FINDINGS — même contrat que les badges : les points d''un employé s''inscrivent sur son commerce.';

-- ── 3. inventaire_quart_employes ────────────────────────────────────────
--
-- Cette table n'a PAS de colonne site, et il ne faut pas lui en ajouter une :
-- sa portée est INDIRECTE, portée par `quart_id → inventaire_quarts.site`.
-- C'est le contrat normal, pas une lacune de schéma. La correction protège ce
-- contrat, elle n'uniformise pas le schéma.
--
-- Son INSERT contrôlait déjà cette portée ; son UPDATE ne contrôlait que
-- l'acteur. Deux conséquences : un manager d'un autre commerce pouvait
-- modifier la ligne, et surtout un `update` pouvait **rattacher la ligne au
-- quart d'un autre site** en changeant `quart_id`.
--
-- Le `using` borne les lignes visibles à celles dont le quart est du site ;
-- le `with check` fait la même vérification sur la NOUVELLE valeur de
-- `quart_id` — c'est lui qui interdit le rattachement ailleurs. Les deux sont
-- nécessaires et ne disent pas la même chose.
--
-- Les acteurs restent inchangés : l'employé pour sa propre ligne, le manager
-- ou le gérant pour celles de son commerce (rouverture de clôture).
drop policy if exists update_inventaire_quart_employes on public.inventaire_quart_employes;
create policy update_inventaire_quart_employes on public.inventaire_quart_employes
  for update to public
  using (
    exists (
      select 1 from public.inventaire_quarts q
       where q.id = inventaire_quart_employes.quart_id
         and q.site = (select public.current_employee_site_id())
    )
    and (
      employee_id = (select auth.uid())
      or (select public.current_employee_role()) = any (array['manager','gerant'])
    )
  )
  with check (
    exists (
      select 1 from public.inventaire_quarts q
       where q.id = inventaire_quart_employes.quart_id
         and q.site = (select public.current_employee_site_id())
    )
    and (
      employee_id = (select auth.uid())
      or (select public.current_employee_role()) = any (array['manager','gerant'])
    )
  );

comment on policy update_inventaire_quart_employes on public.inventaire_quart_employes is
  'STATIC-GUARD-FINDINGS — portée INDIRECTE préservée : le quart référencé doit appartenir au site du compte, avant comme après la mise à jour. Le with check est ce qui interdit de rattacher la ligne au quart d''un autre commerce. Aucune colonne site n''est ajoutée : la portée par quart_id est le contrat, pas une lacune.';

-- ── Contrôle fail-closed ────────────────────────────────────────────────
do $$
declare
  v_defaut text := '';
  v_nom text; v_ctrl text;
begin
  foreach v_nom in array array['employee_own_badge_insert','employee_own_points_insert'] loop
    select pg_get_expr(p.polwithcheck,p.polrelid) into v_ctrl from pg_policy p where p.polname=v_nom;
    if v_ctrl is null or v_ctrl not like '%current_employee_site_id%' then
      v_defaut := v_defaut || v_nom || ' ';
    end if;
  end loop;

  -- La portée indirecte se vérifie autrement : par la présence du recoupement
  -- avec `inventaire_quarts`, des DEUX côtés de la policy.
  select pg_get_expr(p.polqual,p.polrelid) into v_ctrl
    from pg_policy p where p.polname='update_inventaire_quart_employes';
  if v_ctrl is null or v_ctrl not like '%inventaire_quarts%' then
    v_defaut := v_defaut || 'update_inventaire_quart_employes (using) ';
  end if;
  select pg_get_expr(p.polwithcheck,p.polrelid) into v_ctrl
    from pg_policy p where p.polname='update_inventaire_quart_employes';
  if v_ctrl is null or v_ctrl not like '%inventaire_quarts%' then
    v_defaut := v_defaut || 'update_inventaire_quart_employes (with check) ';
  end if;

  if v_defaut <> '' then
    raise exception 'STATIC-GUARD-FINDINGS interrompu : % sans contrôle de portée', v_defaut;
  end if;
end;
$$;
