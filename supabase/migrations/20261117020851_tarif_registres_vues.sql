-- NEXUS Scanner, politique tarifaire T2 : vues de l'état courant (security_invoker), applicable après les migrations 20261117020430 et 20261117020652.
-- security_invoker : chaque vue applique les permissions de la personne connectée (RLS des tables sous-jacentes).
-- Version 2 (examen du 16/11/2026, 20 h 22) : exceptions effectives par priorité, vue des incohérences.

-- Ordre obligatoire : 100000, 100100, 100200, puis 100300 en dernier. Rejouer ce fichier après 100300 rétablirait
-- la vue des exceptions sans le filtre des comptes actifs : refusé.

-- Prérequis : la migration s'arrête avant toute écriture si un objet attendu manque (aucune identité de projet n'est supposée).
do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.import_batches', 'public.tarif_familles', 'public.tarif_rattachements', 'public.tarif_seuils', 'public.tarif_reglages', 'public.tarif_exceptions', 'public.tarif_prix_decides', 'public.tarif_prix_application', 'public.tarif_regimes_prix', 'public.tarif_controles_reglementaires', 'public.tarif_decisions']) as o where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261117020851 (appliquer 20261117020430 et 20261117020652 avant) : objets absents : %', v_manque;
  end if;
end $prerequis$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'compte_actif_obligatoire') then
    raise exception 'ordre_migrations : 20261118100300 est déjà appliquée, 20261118100200 ne se rejoue pas après elle';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_regimes_prix','tarif_controles_reglementaires'] loop
    execute format('create or replace view %I with (security_invoker = true) as
      select t.* from %I t
      where t.annule_le is null
        and not exists (select 1 from %I c where c.remplace_id = t.id and c.annule_le is null)', 'v_' || t || '_actifs', t, t);
    execute format('revoke all on %I from anon, public, authenticated, service_role', 'v_' || t || '_actifs');
    execute format('grant select on %I to authenticated, service_role', 'v_' || t || '_actifs');
  end loop;
end $$;

create or replace view v_tarif_prix_application_actifs with (security_invoker = true) as
  select a.* from tarif_prix_application a where a.annule_le is null;
revoke all on v_tarif_prix_application_actifs from anon, public, authenticated, service_role;
grant select on v_tarif_prix_application_actifs to authenticated, service_role;

-- Exceptions effectives : UNE ligne par (site, référence), choisie par priorité.
--   1. Décision du gérant dans tarif_exceptions (validee ou levee) : elle fait foi, et neutralise produits_appel.
--   2. Sinon, produit d'appel déjà enregistré dans produits_appel : il reste VALIDÉ, même si une candidature ou un refus
--      existe pour la même référence. Ces derniers sont signalés à côté, sans effet.
--   3. Sinon, candidature ou refus du registre (sans effet sur le moteur, qui n'applique que « validee »).
-- Rapprochement d'une ligne produits_appel (libellé seul) : même libellé normalisé, ou même clé.
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

-- Incohérences d'intégrité à surveiller (lecture seule) : références qui visent une famille ou un prix décidé devenu inactif.
create or replace view v_tarif_incoherences with (security_invoker = true) as
  select r.site, 'rattachement vers une famille inactive'::text as incoherence, r.id as ligne_id, r.cle, r.famille_code as cible
  from v_tarif_rattachements_actifs r
  where not exists (select 1 from v_tarif_familles_actifs f where f.site = r.site and f.famille_code = r.famille_code)
  union all
  select s.site, 'seuil d''une famille inactive', s.id, s.cle, s.cible_niveau
  from v_tarif_seuils_actifs s
  where s.niveau = 'famille' and not exists (select 1 from v_tarif_familles_actifs f where f.site = s.site and f.famille_code = s.cible_niveau)
  union all
  select a.site, 'application visant un prix décidé inactif', a.id, null, a.prix_decide_id::text
  from v_tarif_prix_application_actifs a
  where not exists (select 1 from v_tarif_prix_decides_actifs p where p.id = a.prix_decide_id);
revoke all on v_tarif_incoherences from anon, public, authenticated, service_role;
grant select on v_tarif_incoherences to authenticated, service_role;
