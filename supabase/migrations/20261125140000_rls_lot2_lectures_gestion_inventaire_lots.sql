-- Lot RLS-2 (Guardian #160, priorités 3 et 4). Aucune donnée modifiée.
-- 1. Douze tables sans écran employé : la lecture passe de « toute la station » à manager et gérant de la station ;
--    le créateur seulement si sites.acces_createur_autorise. Relevé des lecteurs : docs/rls_lot2_releve_lecteurs.md.
--    Les politiques d'écriture (déjà manager/gérant, même station) ne bougent pas.
-- 2. controles_stock : l'insertion passe de « tout employé de la station » à manager et gérant (Scanner-Stock est une page de gestion).
-- 3. inventaire_lots : la politique ALL « même station » est remplacée par INSERT, UPDATE et DELETE réservés à manager et gérant.
--    La lecture (même station ou lecture clients autorisée) ne change pas.
-- 4. Politique recette_ci_site_test (rôle nexus_ci_recette) sur audits_caisse et carburant_releves : supprimée hors Test.
--    Test se reconnaît à l'identifiant système de sa base (7678069749886157684), comme la garde des recettes.
-- Idempotente. Une garde fait échouer la migration si un objet attendu manque.

do $garde$
declare t text;
begin
  foreach t in array array['campagnes_nexus','campagnes_nexus_imports','carburant_sonde_alertes','moteur_documentaire_etat','employee_contraintes','employee_indisponibilites','controles_stock','panier_moyen_quotidien','stock_releves','marge_exceptions','product_locations','product_photos','inventaire_lots','audits_caisse','carburant_releves'] loop
    if to_regclass('public.' || t) is null then raise exception 'RLS-2 : table % absente, arrêt', t; end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'RLS-2 : RLS inactive sur %, arrêt', t; end if;
  end loop;
  if to_regprocedure('public.current_employee_role()') is null or to_regprocedure('public.current_employee_site_id()') is null
     or to_regprocedure('public.je_suis_createur()') is null then
    raise exception 'RLS-2 : fonctions d''aide RLS absentes, arrêt';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='sites' and column_name='acces_createur_autorise') then
    raise exception 'RLS-2 : sites.acces_createur_autorise absente, arrêt';
  end if;
end
$garde$;

drop policy if exists select_campagnes_nexus on public.campagnes_nexus;
drop policy if exists select_gestion_campagnes_nexus on public.campagnes_nexus;
create policy select_gestion_campagnes_nexus on public.campagnes_nexus for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = campagnes_nexus.site and s.acces_createur_autorise = true)));

drop policy if exists select_campagnes_nexus_imports on public.campagnes_nexus_imports;
drop policy if exists select_gestion_campagnes_nexus_imports on public.campagnes_nexus_imports;
create policy select_gestion_campagnes_nexus_imports on public.campagnes_nexus_imports for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = campagnes_nexus_imports.site and s.acces_createur_autorise = true)));

drop policy if exists select_carburant_sonde_alertes on public.carburant_sonde_alertes;
drop policy if exists select_gestion_carburant_sonde_alertes on public.carburant_sonde_alertes;
create policy select_gestion_carburant_sonde_alertes on public.carburant_sonde_alertes for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = carburant_sonde_alertes.site and s.acces_createur_autorise = true)));

drop policy if exists select_moteur_documentaire_etat on public.moteur_documentaire_etat;
drop policy if exists select_gestion_moteur_documentaire_etat on public.moteur_documentaire_etat;
create policy select_gestion_moteur_documentaire_etat on public.moteur_documentaire_etat for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = moteur_documentaire_etat.site and s.acces_createur_autorise = true)));

drop policy if exists lecture_meme_site on public.employee_contraintes;
drop policy if exists select_gestion_employee_contraintes on public.employee_contraintes;
create policy select_gestion_employee_contraintes on public.employee_contraintes for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = employee_contraintes.site_id and s.acces_createur_autorise = true)));

drop policy if exists lecture_meme_site on public.employee_indisponibilites;
drop policy if exists select_gestion_employee_indisponibilites on public.employee_indisponibilites;
create policy select_gestion_employee_indisponibilites on public.employee_indisponibilites for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = employee_indisponibilites.site_id and s.acces_createur_autorise = true)));

drop policy if exists select_controles_stock on public.controles_stock;
drop policy if exists select_gestion_controles_stock on public.controles_stock;
create policy select_gestion_controles_stock on public.controles_stock for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = controles_stock.site and s.acces_createur_autorise = true)));

drop policy if exists select_panier_moyen_quotidien on public.panier_moyen_quotidien;
drop policy if exists select_gestion_panier_moyen_quotidien on public.panier_moyen_quotidien;
create policy select_gestion_panier_moyen_quotidien on public.panier_moyen_quotidien for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = panier_moyen_quotidien.site and s.acces_createur_autorise = true)));

drop policy if exists select_stock_releves on public.stock_releves;
drop policy if exists select_gestion_stock_releves on public.stock_releves;
create policy select_gestion_stock_releves on public.stock_releves for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = stock_releves.site and s.acces_createur_autorise = true)));

drop policy if exists lecture_meme_site on public.marge_exceptions;
drop policy if exists select_gestion_marge_exceptions on public.marge_exceptions;
create policy select_gestion_marge_exceptions on public.marge_exceptions for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = marge_exceptions.site and s.acces_createur_autorise = true)));

drop policy if exists lecture_meme_site on public.product_locations;
drop policy if exists select_gestion_product_locations on public.product_locations;
create policy select_gestion_product_locations on public.product_locations for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = product_locations.site and s.acces_createur_autorise = true)));

drop policy if exists lecture_meme_site on public.product_photos;
drop policy if exists select_gestion_product_photos on public.product_photos;
create policy select_gestion_product_photos on public.product_photos for select to authenticated
  using (((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = product_photos.site and s.acces_createur_autorise = true)));

drop policy if exists authenticated_inserts_controles_stock on public.controles_stock;
drop policy if exists insert_gestion_controles_stock on public.controles_stock;
create policy insert_gestion_controles_stock on public.controles_stock for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));

drop policy if exists ecriture_inventaire_lots on public.inventaire_lots;
drop policy if exists insert_gestion_inventaire_lots on public.inventaire_lots;
drop policy if exists update_gestion_inventaire_lots on public.inventaire_lots;
drop policy if exists delete_gestion_inventaire_lots on public.inventaire_lots;
create policy insert_gestion_inventaire_lots on public.inventaire_lots for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy update_gestion_inventaire_lots on public.inventaire_lots for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy delete_gestion_inventaire_lots on public.inventaire_lots for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));

do $recette$
begin
  if (select system_identifier from pg_control_system()) <> 7678069749886157684 then
    drop policy if exists recette_ci_site_test on public.audits_caisse;
    drop policy if exists recette_ci_site_test on public.carburant_releves;
  end if;
end
$recette$;

do $verif$
declare t text; n int;
begin
  foreach t in array array['campagnes_nexus','campagnes_nexus_imports','carburant_sonde_alertes','moteur_documentaire_etat','employee_contraintes','employee_indisponibilites','controles_stock','panier_moyen_quotidien','stock_releves','marge_exceptions','product_locations','product_photos'] loop
    select count(*) into n from pg_policy p where p.polrelid = ('public.' || t)::regclass and p.polcmd = 'r'
      and pg_get_expr(p.polqual, p.polrelid) not like '%current_employee_role%';
    if n > 0 then raise exception 'RLS-2 : % garde une lecture non réservée à la gestion, arrêt', t; end if;
  end loop;
  if exists (select 1 from pg_policy p where p.polrelid = 'public.inventaire_lots'::regclass and p.polcmd = '*') then
    raise exception 'RLS-2 : inventaire_lots garde une politique ALL, arrêt';
  end if;
  if (select system_identifier from pg_control_system()) <> 7678069749886157684
     and exists (select 1 from pg_policy where polname = 'recette_ci_site_test') then
    raise exception 'RLS-2 : recette_ci_site_test subsiste hors Test, arrêt';
  end if;
end
$verif$;
