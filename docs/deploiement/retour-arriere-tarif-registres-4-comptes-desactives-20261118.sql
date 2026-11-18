-- Retour arrière de 20261117021059_tarif_registres_comptes_desactives.sql : ne retire que ses propres objets. Ordre de retrait : 6, 5, 4, 3, 2, 1 (jamais l'inverse).
-- Ne perd aucune donnée. Rétablit la vue des exceptions telle que la migration 20261117020851 la définit (sans le filtre des comptes actifs).
begin;
drop policy if exists compte_actif_obligatoire on tarif_familles;
drop policy if exists compte_actif_obligatoire on tarif_rattachements;
drop policy if exists compte_actif_obligatoire on tarif_seuils;
drop policy if exists compte_actif_obligatoire on tarif_reglages;
drop policy if exists compte_actif_obligatoire on tarif_exceptions;
drop policy if exists compte_actif_obligatoire on tarif_prix_decides;
drop policy if exists compte_actif_obligatoire on tarif_prix_application;
drop policy if exists compte_actif_obligatoire on tarif_regimes_prix;
drop policy if exists compte_actif_obligatoire on tarif_controles_reglementaires;
drop policy if exists compte_actif_obligatoire on tarif_decisions;
drop view if exists v_tarif_exceptions_effectives;
create view v_tarif_exceptions_effectives with (security_invoker = true) as
with registre as (
  select e.site, e.article, e.code_barres, e.cle, e.type, e.statut, e.motif, e.cond_prix_ttc, e.cond_tolerance_cout, e.cond_cout_reference,
         e.id, e.saisi_le, lower(regexp_replace(btrim(coalesce(e.article, '')), '\s+', ' ', 'g')) as libelle_norm
  from v_tarif_exceptions_actifs e
),
appel as (
  select pa.site, pa.article, pa.id, pa.ajoute_le, s.timezone, lower(regexp_replace(btrim(pa.article), '\s+', ' ', 'g')) as libelle_norm
  from produits_appel pa join sites s on s.site_id = pa.site
),
candidats as (
  -- priorité 1 : décision du gérant
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions'::text as source, r.id as source_id, r.saisi_le, 1 as priorite, null::text as en_attente
  from registre r where r.statut in ('validee', 'levee')
  union all
  -- priorité 2 : produit d'appel enregistré, non couvert par une décision du gérant
  select a.site, a.article, null, tarif_cle_reference(null, a.article), 'produit_appel', 'validee',
         'enregistré dans produits_appel le ' || to_char(a.ajoute_le at time zone a.timezone, 'DD/MM/YYYY'),
         null::numeric, null::numeric, null::numeric, 'produits_appel', a.id, a.ajoute_le, 2,
         (select string_agg(r.statut || ' du ' || to_char(r.saisi_le at time zone a.timezone, 'DD/MM/YYYY'), ', ')
            from registre r where r.site = a.site and r.statut in ('candidate', 'refusee')
              and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  from appel a
  where not exists (select 1 from registre r where r.site = a.site and r.statut in ('validee', 'levee')
                      and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  union all
  -- priorité 3 : candidature ou refus sans produit d'appel enregistré
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions', r.id, r.saisi_le, 3, null
  from registre r
  where r.statut in ('candidate', 'refusee')
    and not exists (select 1 from appel a where a.site = r.site and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
)
select site, article, code_barres, cle, type, statut, motif, cond_prix_ttc, cond_tolerance_cout, cond_cout_reference, source, source_id, saisi_le,
       en_attente as candidature_ou_refus_sans_effet
from candidats;
revoke all on v_tarif_exceptions_effectives from anon, public, authenticated, service_role;
grant select on v_tarif_exceptions_effectives to authenticated, service_role;
commit;
