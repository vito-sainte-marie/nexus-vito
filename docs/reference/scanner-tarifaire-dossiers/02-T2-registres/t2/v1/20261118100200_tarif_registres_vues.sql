-- NEXUS Scanner, politique tarifaire T2 : vues de l'état courant (PROJET, NON EXÉCUTÉ).
-- security_invoker : chaque vue applique les permissions de la personne connectée (RLS des tables sous-jacentes).

do $$
declare t text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_regimes_prix','tarif_controles_reglementaires'] loop
    execute format('create or replace view %I with (security_invoker = true) as
      select t.* from %I t
      where t.annule_le is null
        and not exists (select 1 from %I c where c.remplace_id = t.id and c.annule_le is null)', 'v_' || t || '_actifs', t, t);
    execute format('revoke all on %I from anon, public', 'v_' || t || '_actifs');
    execute format('grant select on %I to authenticated', 'v_' || t || '_actifs');
  end loop;
end $$;

create or replace view v_tarif_prix_application_actifs with (security_invoker = true) as
  select a.* from tarif_prix_application a where a.annule_le is null;
revoke all on v_tarif_prix_application_actifs from anon, public;
grant select on v_tarif_prix_application_actifs to authenticated;

-- Exceptions effectives : registre tarifaire, plus les produits d'appel déjà enregistrés et non repris (sans copie).
-- Une ligne de produits_appel couverte par une exception tarifaire de même libellé (quel que soit son statut) n'apparaît plus.
create or replace view v_tarif_exceptions_effectives with (security_invoker = true) as
  select e.site, e.article, e.code_barres, e.cle, e.type, e.statut, e.motif, e.cond_prix_ttc, e.cond_tolerance_cout, e.cond_cout_reference,
         'tarif_exceptions'::text as source, e.id as source_id, e.saisi_le
  from v_tarif_exceptions_actifs e
  union all
  select pa.site, pa.article, null::text, tarif_cle_reference(null, pa.article), 'produit_appel', 'validee',
         'enregistré dans produits_appel le ' || to_char(pa.ajoute_le at time zone s.timezone, 'DD/MM/YYYY'),
         null::numeric, null::numeric, null::numeric, 'produits_appel', pa.id, pa.ajoute_le
  from produits_appel pa join sites s on s.site_id = pa.site
  where not exists (select 1 from v_tarif_exceptions_actifs e
                    where e.site = pa.site and lower(regexp_replace(btrim(e.article), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(pa.article), '\s+', ' ', 'g')));
revoke all on v_tarif_exceptions_effectives from anon, public;
grant select on v_tarif_exceptions_effectives to authenticated;
