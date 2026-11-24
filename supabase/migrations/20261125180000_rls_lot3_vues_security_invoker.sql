-- Lot RLS-3 (Guardian #160, P0 sécurité). Aucune donnée modifiée.
-- Les 4 dernières vues privilégiées de public passent en security_invoker : elles lisaient avec les droits de leur propriétaire
-- (postgres), donc sans RLS. v_caisse_ecart_a_traiter montrait à tout `authenticated` les écarts de caisse et les noms des employés
-- de toutes les stations. Désormais la RLS des tables sous-jacentes s'applique à l'appelant ; aucune politique à ajouter
-- (voir docs/rls_lot3_releve_lecteurs.md : manager et gérant gardent leur station, l'employé tombe à 0 ligne sur les écarts de caisse).
-- Idempotente. Une garde fait échouer la migration si un objet attendu manque.

do $garde$
declare v text; t text;
begin
  foreach v in array array['v_caisse_ecart_a_traiter','nexus_stock_etat_v2','nexus_stock_etat_v3','view_inventaire_dernier_controle_produit'] loop
    if not exists (select 1 from pg_class c where c.oid = to_regclass('public.' || v) and c.relkind = 'v') then
      raise exception 'RLS-3 : vue % absente, arrêt', v;
    end if;
  end loop;
  foreach t in array array['audits_caisse','employees','inventaire_comptages','inventaire_categories_zones_stock',
    'inventaire_stock_localise_releves','inventaire_mouvements'] loop
    if to_regclass('public.' || t) is null then raise exception 'RLS-3 : table % absente, arrêt', t; end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'RLS-3 : RLS inactive sur %, arrêt', t; end if;
    if not exists (select 1 from pg_policy p where p.polrelid = ('public.' || t)::regclass and p.polcmd::text in ('r','*')) then
      raise exception 'RLS-3 : aucune politique SELECT sur %, la vue deviendrait vide, arrêt', t;
    end if;
  end loop;
  if to_regclass('public.nexus_stock_etat') is null then raise exception 'RLS-3 : nexus_stock_etat absente, arrêt'; end if;
  if not coalesce((select c.reloptions @> array['security_invoker=true'] from pg_class c where c.oid = 'public.nexus_stock_etat'::regclass), false) then
    raise exception 'RLS-3 : nexus_stock_etat n''est pas en security_invoker, arrêt';
  end if;
end
$garde$;

alter view public.v_caisse_ecart_a_traiter set (security_invoker = true);
alter view public.nexus_stock_etat_v2 set (security_invoker = true);
alter view public.nexus_stock_etat_v3 set (security_invoker = true);
alter view public.view_inventaire_dernier_controle_produit set (security_invoker = true);

do $verif$
declare v text;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'v'
             and c.relname in ('v_caisse_ecart_a_traiter','nexus_stock_etat_v2','nexus_stock_etat_v3','view_inventaire_dernier_controle_produit')
             and not coalesce(c.reloptions @> array['security_invoker=true'], false) loop
    raise exception 'RLS-3 : la vue % n''est pas en security_invoker, arrêt', v;
  end loop;
end
$verif$;
